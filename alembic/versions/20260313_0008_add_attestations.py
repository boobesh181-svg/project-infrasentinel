"""Add attestations table.

Revision ID: 20260313_0008
Revises: 20260312_0007
Create Date: 2026-03-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260313_0008"
down_revision: Union[str, None] = "20260312_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "attestations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "attestor_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("attestation_type", sa.String(length=50), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "entity_type",
            "entity_id",
            "attestor_user_id",
            name="uq_attestations_entity_attestor",
        ),
    )
    op.create_index("ix_attestations_entity_type", "attestations", ["entity_type"])
    op.create_index("ix_attestations_entity_id", "attestations", ["entity_id"])


def downgrade() -> None:
    op.drop_index("ix_attestations_entity_id", table_name="attestations")
    op.drop_index("ix_attestations_entity_type", table_name="attestations")
    op.drop_table("attestations")
