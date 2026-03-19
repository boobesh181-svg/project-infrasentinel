"""Add verification infrastructure schema and enum expansions.

Revision ID: 20260317_0010
Revises: 20260313_0009
Create Date: 2026-03-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260317_0010"
down_revision: Union[str, None] = "20260313_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'SITE_ENGINEER'")
    op.execute("ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'CONTRACTOR_MANAGER'")
    op.execute("ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'ESG_ANALYST'")
    op.execute("ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'AUDITOR'")
    op.execute("ALTER TYPE material_status_enum ADD VALUE IF NOT EXISTS 'UNDER_REVIEW'")

    op.create_table(
        "suppliers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("contact_email", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
    )
    op.create_index("ix_suppliers_organization_id", "suppliers", ["organization_id"])
    op.create_index("ix_suppliers_name", "suppliers", ["name"])

    material_status = postgresql.ENUM(name="material_status_enum", create_type=False)

    op.create_table(
        "material_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "supplier_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("suppliers.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("material_type", sa.String(length=255), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 6), nullable=False),
        sa.Column("unit", sa.String(length=64), nullable=False),
        sa.Column("delivery_date", sa.Date(), nullable=False),
        sa.Column("status", material_status, nullable=False, server_default="DRAFT"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "parent_event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("material_events.id", ondelete="RESTRICT"),
            nullable=True,
        ),
    )
    op.create_index("ix_material_events_organization_id", "material_events", ["organization_id"])
    op.create_index("ix_material_events_project_id", "material_events", ["project_id"])
    op.create_index("ix_material_events_status", "material_events", ["status"])

    op.create_table(
        "material_event_evidence",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "material_event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("material_events.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("file_url", sa.String(length=500), nullable=False),
        sa.Column("file_hash", sa.String(length=64), nullable=False),
        sa.Column("file_type", sa.String(length=100), nullable=False),
        sa.Column("evidence_type", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="ACTIVE"),
    )
    op.create_index(
        "ix_material_event_evidence_organization_id",
        "material_event_evidence",
        ["organization_id"],
    )
    op.create_index(
        "ix_material_event_evidence_material_event_id",
        "material_event_evidence",
        ["material_event_id"],
    )

    op.create_table(
        "emission_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "material_event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("material_events.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("factor_value_snapshot", sa.Numeric(14, 6), nullable=False),
        sa.Column("factor_source_snapshot", sa.String(length=255), nullable=False),
        sa.Column("factor_reference_snapshot", sa.String(length=500), nullable=False),
        sa.Column("calculation_method", sa.String(length=255), nullable=False),
        sa.Column("emission_value", sa.Numeric(14, 6), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="CALCULATED"),
    )
    op.create_index("ix_emission_records_organization_id", "emission_records", ["organization_id"])
    op.create_index("ix_emission_records_material_event_id", "emission_records", ["material_event_id"])
    op.create_index("ix_emission_records_status", "emission_records", ["status"])

    op.create_table(
        "verification_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "emission_record_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("emission_records.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "verifier_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column(
            "approver_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_notes", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="UNDER_REVIEW"),
    )
    op.create_index("ix_verification_records_organization_id", "verification_records", ["organization_id"])
    op.create_index("ix_verification_records_emission_record_id", "verification_records", ["emission_record_id"])
    op.create_index("ix_verification_records_status", "verification_records", ["status"])

    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "generated_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("report_type", sa.String(length=50), nullable=False, server_default="VERIFICATION"),
        sa.Column("report_period_start", sa.Date(), nullable=False),
        sa.Column("report_period_end", sa.Date(), nullable=False),
        sa.Column("format", sa.String(length=10), nullable=False),
        sa.Column("file_url", sa.String(length=500), nullable=False),
        sa.Column("generation_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="GENERATED"),
    )
    op.create_index("ix_reports_organization_id", "reports", ["organization_id"])
    op.create_index("ix_reports_project_id", "reports", ["project_id"])
    op.create_index("ix_reports_status", "reports", ["status"])


def downgrade() -> None:
    op.drop_index("ix_reports_status", table_name="reports")
    op.drop_index("ix_reports_project_id", table_name="reports")
    op.drop_index("ix_reports_organization_id", table_name="reports")
    op.drop_table("reports")

    op.drop_index("ix_verification_records_status", table_name="verification_records")
    op.drop_index("ix_verification_records_emission_record_id", table_name="verification_records")
    op.drop_index("ix_verification_records_organization_id", table_name="verification_records")
    op.drop_table("verification_records")

    op.drop_index("ix_emission_records_status", table_name="emission_records")
    op.drop_index("ix_emission_records_material_event_id", table_name="emission_records")
    op.drop_index("ix_emission_records_organization_id", table_name="emission_records")
    op.drop_table("emission_records")

    op.drop_index("ix_material_event_evidence_material_event_id", table_name="material_event_evidence")
    op.drop_index("ix_material_event_evidence_organization_id", table_name="material_event_evidence")
    op.drop_table("material_event_evidence")

    op.drop_index("ix_material_events_status", table_name="material_events")
    op.drop_index("ix_material_events_project_id", table_name="material_events")
    op.drop_index("ix_material_events_organization_id", table_name="material_events")
    op.drop_table("material_events")

    op.drop_index("ix_suppliers_name", table_name="suppliers")
    op.drop_index("ix_suppliers_organization_id", table_name="suppliers")
    op.drop_table("suppliers")
