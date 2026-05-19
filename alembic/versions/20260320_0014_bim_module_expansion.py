"""Expand BIM module models and material extraction table.

Revision ID: 20260320_0014
Revises: 20260319_0013
Create Date: 2026-03-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260320_0014"
down_revision: Union[str, None] = "20260319_0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    processing_status_enum = postgresql.ENUM(
        "UPLOADED",
        "PROCESSING",
        "PROCESSED",
        "FAILED",
        name="bim_processing_status_enum",
        create_type=False,
    )
    processing_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column("bim_models", sa.Column("model_name", sa.String(length=255), nullable=True))
    op.add_column("bim_models", sa.Column("file_hash", sa.String(length=64), nullable=True))
    op.add_column(
        "bim_models",
        sa.Column("processing_status", processing_status_enum, nullable=False, server_default="UPLOADED"),
    )
    op.add_column(
        "bim_models",
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.execute("UPDATE bim_models SET model_name = 'legacy.ifc' WHERE model_name IS NULL")
    op.execute("UPDATE bim_models SET file_hash = repeat('0', 64) WHERE file_hash IS NULL")

    op.alter_column("bim_models", "model_name", nullable=False)
    op.alter_column("bim_models", "file_hash", nullable=False)

    op.create_table(
        "bim_materials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "bim_model_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bim_models.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("material_name", sa.String(length=255), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 6), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=False),
        sa.Column("source_element", sa.String(length=255), nullable=True),
        sa.Column("confidence_score", sa.Numeric(6, 4), nullable=False, server_default=sa.text("0.8")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_bim_materials_bim_model_id", "bim_materials", ["bim_model_id"])
    op.create_index("ix_bim_materials_material_name", "bim_materials", ["material_name"])


def downgrade() -> None:
    op.drop_index("ix_bim_materials_material_name", table_name="bim_materials")
    op.drop_index("ix_bim_materials_bim_model_id", table_name="bim_materials")
    op.drop_table("bim_materials")

    op.drop_column("bim_models", "created_at")
    op.drop_column("bim_models", "processing_status")
    op.drop_column("bim_models", "file_hash")
    op.drop_column("bim_models", "model_name")

    postgresql.ENUM(name="bim_processing_status_enum").drop(op.get_bind(), checkfirst=True)
