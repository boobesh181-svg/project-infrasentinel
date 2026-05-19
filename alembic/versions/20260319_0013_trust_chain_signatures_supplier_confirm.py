"""Add trust chain, digital signatures, and supplier confirmations.

Revision ID: 20260319_0013
Revises: 20260319_0012
Create Date: 2026-03-19
"""

from __future__ import annotations

from datetime import timezone
import hashlib
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260319_0013"
down_revision: Union[str, None] = "20260319_0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _serialize_event(entity_type: str, entity_id: str, action: str, performed_by: str, timestamp: object) -> str:
    ts = timestamp
    if hasattr(ts, "isoformat"):
        ts_str = ts.astimezone(timezone.utc).isoformat() if getattr(ts, "tzinfo", None) else ts.isoformat()
    else:
        ts_str = str(ts)
    payload = {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "action": action,
        "performed_by": performed_by,
        "timestamp": ts_str,
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def upgrade() -> None:
    op.add_column("audit_logs", sa.Column("previous_hash", sa.String(length=64), nullable=True))
    op.add_column("audit_logs", sa.Column("current_hash", sa.String(length=64), nullable=True))

    bind = op.get_bind()
    trigger_disabled = False
    try:
        bind.execute(sa.text("ALTER TABLE audit_logs DISABLE TRIGGER ALL"))
        trigger_disabled = True
    except Exception:
        # Some deployments restrict trigger toggling; continue and attempt backfill directly.
        pass

    audit_logs = sa.table(
        "audit_logs",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("entity_type", sa.String()),
        sa.column("entity_id", postgresql.UUID(as_uuid=True)),
        sa.column("action", sa.String()),
        sa.column("performed_by_id", postgresql.UUID(as_uuid=True)),
        sa.column("timestamp", sa.DateTime(timezone=True)),
        sa.column("previous_hash", sa.String()),
        sa.column("current_hash", sa.String()),
    )

    rows = list(
        bind.execute(
            sa.select(
                audit_logs.c.id,
                audit_logs.c.entity_type,
                audit_logs.c.entity_id,
                audit_logs.c.action,
                audit_logs.c.performed_by_id,
                audit_logs.c.timestamp,
            ).order_by(audit_logs.c.timestamp.asc(), audit_logs.c.id.asc())
        )
    )

    backfill_succeeded = True
    previous_hash = "0" * 64
    try:
        for row in rows:
            serialized = _serialize_event(
                row.entity_type,
                str(row.entity_id),
                row.action,
                str(row.performed_by_id),
                row.timestamp,
            )
            current_hash = hashlib.sha256((previous_hash + serialized).encode("utf-8")).hexdigest()
            bind.execute(
                sa.update(audit_logs)
                .where(audit_logs.c.id == row.id)
                .values(previous_hash=previous_hash, current_hash=current_hash)
            )
            previous_hash = current_hash
    except Exception:
        # Immutable-record guards can block historical updates; keep columns nullable in that case.
        backfill_succeeded = False

    if backfill_succeeded:
        op.alter_column("audit_logs", "previous_hash", nullable=False)
        op.alter_column("audit_logs", "current_hash", nullable=False)

    if trigger_disabled:
        try:
            bind.execute(sa.text("ALTER TABLE audit_logs ENABLE TRIGGER ALL"))
        except Exception:
            pass

    op.create_index("ix_audit_logs_current_hash", "audit_logs", ["current_hash"], unique=False)

    op.add_column("material_entries", sa.Column("signature", sa.Text(), nullable=True))
    op.add_column("material_entries", sa.Column("signature_algorithm", sa.String(length=64), nullable=True))

    op.create_table(
        "user_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("public_key", sa.String(length=5000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_user_keys_user_id", "user_keys", ["user_id"])

    supplier_confirmation_status_enum = postgresql.ENUM(
        "PENDING",
        "CONFIRMED",
        "DISPUTED",
        name="supplier_confirmation_status_enum",
        create_type=False,
    )
    supplier_confirmation_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "supplier_confirmations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "entry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("material_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("supplier_name", sa.String(length=255), nullable=False),
        sa.Column("supplier_email", sa.String(length=255), nullable=False),
        sa.Column("status", supplier_confirmation_status_enum, nullable=False, server_default="PENDING"),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_supplier_confirmations_entry_id", "supplier_confirmations", ["entry_id"])


def downgrade() -> None:
    op.drop_index("ix_supplier_confirmations_entry_id", table_name="supplier_confirmations")
    op.drop_table("supplier_confirmations")
    postgresql.ENUM(name="supplier_confirmation_status_enum").drop(op.get_bind(), checkfirst=True)

    op.drop_index("ix_user_keys_user_id", table_name="user_keys")
    op.drop_table("user_keys")

    op.drop_column("material_entries", "signature_algorithm")
    op.drop_column("material_entries", "signature")

    op.drop_index("ix_audit_logs_current_hash", table_name="audit_logs")
    op.drop_column("audit_logs", "current_hash")
    op.drop_column("audit_logs", "previous_hash")
