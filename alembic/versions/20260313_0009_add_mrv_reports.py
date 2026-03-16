"""Add MRV reports.

Revision ID: 20260313_0009
Revises: 20260313_0008
Create Date: 2026-03-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260313_0009"
down_revision: Union[str, None] = "20260313_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mrv_report_status_enum') THEN
                CREATE TYPE mrv_report_status_enum AS ENUM ('DRAFT', 'APPROVED', 'LOCKED');
            END IF;
        END
        $$;
        """
    )

    status_enum = postgresql.ENUM(
        "DRAFT",
        "APPROVED",
        "LOCKED",
        name="mrv_report_status_enum",
        create_type=False,
    )

    op.create_table(
        "mrv_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("report_period_start", sa.Date(), nullable=False),
        sa.Column("report_period_end", sa.Date(), nullable=False),
        sa.Column("total_emissions", sa.Float(), nullable=False),
        sa.Column("report_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("status", status_enum, nullable=False, server_default="DRAFT"),
    )
    op.create_index("ix_mrv_reports_project_id", "mrv_reports", ["project_id"])
    op.create_index(
        "ix_mrv_reports_period",
        "mrv_reports",
        ["report_period_start", "report_period_end"],
    )


def downgrade() -> None:
    op.drop_index("ix_mrv_reports_period", table_name="mrv_reports")
    op.drop_index("ix_mrv_reports_project_id", table_name="mrv_reports")
    op.drop_table("mrv_reports")
    op.execute("DROP TYPE IF EXISTS mrv_report_status_enum")
