"""Add evidence file storage.

Revision ID: 20260312_0005
Revises: 20260311_0004
Create Date: 2026-03-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260312_0005"
down_revision: Union[str, None] = "20260311_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "evidence_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "material_entry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("material_entries.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("file_hash", sa.String(length=64), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column(
            "uploaded_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_evidence_files_material_entry_id",
        "evidence_files",
        ["material_entry_id"],
    )
    op.create_index(
        "ix_evidence_files_uploaded_by",
        "evidence_files",
        ["uploaded_by"],
    )


def downgrade() -> None:
    op.drop_index("ix_evidence_files_uploaded_by", table_name="evidence_files")
    op.drop_index("ix_evidence_files_material_entry_id", table_name="evidence_files")
    op.drop_table("evidence_files")
