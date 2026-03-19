"""Add anti-corruption controls and BIM verification schema.

Revision ID: 20260318_0011
Revises: 20260317_0010
Create Date: 2026-03-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260318_0011"
down_revision: Union[str, None] = "20260317_0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'SUPPLIER'")
    op.execute("DROP TRIGGER IF EXISTS evidence_files_immutable_update ON evidence_files")

    op.add_column("material_entries", sa.Column("supplier_name", sa.String(length=255), nullable=True))
    op.add_column("material_entries", sa.Column("supplier_email", sa.String(length=255), nullable=True))
    op.add_column("material_entries", sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("material_entries", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "material_entries",
        sa.Column("audit_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "material_entries",
        sa.Column("temporal_anomaly", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("material_entries", sa.Column("bim_discrepancy_score", sa.Numeric(10, 4), nullable=True))
    op.add_column("material_entries", sa.Column("bim_validation_status", sa.String(length=32), nullable=True))

    op.add_column(
        "evidence_files",
        sa.Column(
            "content_type",
            sa.String(length=100),
            nullable=False,
            server_default="application/octet-stream",
        ),
    )
    op.add_column(
        "evidence_files",
        sa.Column("evidence_type", sa.String(length=64), nullable=False, server_default="other"),
    )
    op.add_column(
        "evidence_files",
        sa.Column("duplicate_flag", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_evidence_files_file_hash", "evidence_files", ["file_hash"])
    op.create_index("ix_evidence_files_duplicate_flag", "evidence_files", ["duplicate_flag"])

    acknowledgement_role_enum = postgresql.ENUM(
        "VERIFIER",
        "AUDITOR",
        "SUPPLIER",
        name="acknowledgement_role_enum",
        create_type=False,
    )
    acknowledgement_response_type_enum = postgresql.ENUM(
        "ACK",
        "DISPUTE",
        name="acknowledgement_response_type_enum",
        create_type=False,
    )
    risk_level_enum = postgresql.ENUM("LOW", "MEDIUM", "HIGH", name="risk_level_enum", create_type=False)
    bim_file_format_enum = postgresql.ENUM("IFC", "RVT", "GLTF", name="bim_file_format_enum", create_type=False)

    acknowledgement_role_enum.create(op.get_bind(), checkfirst=True)
    acknowledgement_response_type_enum.create(op.get_bind(), checkfirst=True)
    risk_level_enum.create(op.get_bind(), checkfirst=True)
    bim_file_format_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "evidence_acknowledgements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "material_entry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("material_entries.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("role", acknowledgement_role_enum, nullable=False),
        sa.Column("response_type", acknowledgement_response_type_enum, nullable=False),
        sa.Column("comment", sa.String(length=1000), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_evidence_ack_material_entry_id", "evidence_acknowledgements", ["material_entry_id"])
    op.create_index("ix_evidence_ack_user_id", "evidence_acknowledgements", ["user_id"])

    op.create_table(
        "entry_risk_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "entry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("material_entries.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("risk_score", sa.Numeric(10, 4), nullable=False),
        sa.Column("risk_level", risk_level_enum, nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_entry_risk_scores_entry_id", "entry_risk_scores", ["entry_id"])

    op.create_table(
        "bim_models",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("file_format", bim_file_format_enum, nullable=False),
        sa.Column(
            "uploaded_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_bim_models_project_id", "bim_models", ["project_id"])

    op.create_table(
        "bim_material_estimates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("material_type", sa.String(length=255), nullable=False),
        sa.Column("estimated_quantity", sa.Numeric(14, 6), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_bim_material_estimates_project_id", "bim_material_estimates", ["project_id"])
    op.create_index("ix_bim_material_estimates_material_type", "bim_material_estimates", ["material_type"])


def downgrade() -> None:
    op.drop_index("ix_bim_material_estimates_material_type", table_name="bim_material_estimates")
    op.drop_index("ix_bim_material_estimates_project_id", table_name="bim_material_estimates")
    op.drop_table("bim_material_estimates")

    op.drop_index("ix_bim_models_project_id", table_name="bim_models")
    op.drop_table("bim_models")

    op.drop_index("ix_entry_risk_scores_entry_id", table_name="entry_risk_scores")
    op.drop_table("entry_risk_scores")

    op.drop_index("ix_evidence_ack_user_id", table_name="evidence_acknowledgements")
    op.drop_index("ix_evidence_ack_material_entry_id", table_name="evidence_acknowledgements")
    op.drop_table("evidence_acknowledgements")

    op.drop_index("ix_evidence_files_duplicate_flag", table_name="evidence_files")
    op.drop_index("ix_evidence_files_file_hash", table_name="evidence_files")
    op.drop_column("evidence_files", "duplicate_flag")
    op.drop_column("evidence_files", "evidence_type")
    op.drop_column("evidence_files", "content_type")

    op.drop_column("material_entries", "bim_validation_status")
    op.drop_column("material_entries", "bim_discrepancy_score")
    op.drop_column("material_entries", "temporal_anomaly")
    op.drop_column("material_entries", "audit_required")
    op.drop_column("material_entries", "verified_at")
    op.drop_column("material_entries", "submitted_at")
    op.drop_column("material_entries", "supplier_email")
    op.drop_column("material_entries", "supplier_name")

    postgresql.ENUM(name="bim_file_format_enum").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="risk_level_enum").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="acknowledgement_response_type_enum").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="acknowledgement_role_enum").drop(op.get_bind(), checkfirst=True)

    op.execute(
        """
        CREATE TRIGGER evidence_files_immutable_update
        BEFORE UPDATE ON evidence_files
        FOR EACH ROW EXECUTE FUNCTION immutable_record_guard();
        """
    )
