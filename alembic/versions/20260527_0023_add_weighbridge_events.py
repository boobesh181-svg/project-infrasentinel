"""Add weighbridge events.

Revision ID: 20260527_0023
Revises: 20260527_0022
Create Date: 2026-05-27
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260527_0023"
down_revision: Union[str, None] = "20260527_0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    weighbridge_status_enum = postgresql.ENUM(
        "GROSS_CAPTURED",
        "TARE_CAPTURED",
        "VERIFIED",
        "MISMATCH",
        name="weighbridge_status_enum",
    )
    weighbridge_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "weighbridge_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("delivery_event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("delivery_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supplier_invoices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("gross_weight", sa.Float(), nullable=False),
        sa.Column("tare_weight", sa.Float(), nullable=True),
        sa.Column("net_weight", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(length=32), nullable=False, server_default="kg"),
        sa.Column("gross_captured_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("tare_captured_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expected_quantity", sa.Float(), nullable=True),
        sa.Column("mismatch_percent", sa.Float(), nullable=True),
        sa.Column("mismatch_threshold", sa.Float(), nullable=False, server_default=sa.text("0.05")),
        sa.Column("anomaly_flags", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("status", postgresql.ENUM(name="weighbridge_status_enum", create_type=False), nullable=False, server_default="GROSS_CAPTURED"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_index("ix_weighbridge_events_org_id", "weighbridge_events", ["organization_id"])
    op.create_index("ix_weighbridge_events_delivery_id", "weighbridge_events", ["delivery_event_id"])
    op.create_index("ix_weighbridge_events_invoice_id", "weighbridge_events", ["invoice_id"])
    op.create_index("ix_weighbridge_events_status", "weighbridge_events", ["status"])


def downgrade() -> None:
    op.drop_index("ix_weighbridge_events_status", table_name="weighbridge_events")
    op.drop_index("ix_weighbridge_events_invoice_id", table_name="weighbridge_events")
    op.drop_index("ix_weighbridge_events_delivery_id", table_name="weighbridge_events")
    op.drop_index("ix_weighbridge_events_org_id", table_name="weighbridge_events")
    op.drop_table("weighbridge_events")

    weighbridge_status_enum = postgresql.ENUM(name="weighbridge_status_enum")
    weighbridge_status_enum.drop(op.get_bind(), checkfirst=True)
