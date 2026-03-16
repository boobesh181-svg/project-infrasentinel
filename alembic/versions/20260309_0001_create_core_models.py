"""create core models

Revision ID: 20260309_0001
Revises: 
Create Date: 2026-03-09 00:01:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260309_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    response_type_enum = postgresql.ENUM(
        "NONE",
        "ACKNOWLEDGED",
        "DISPUTED",
        name="response_type_enum",
        create_type=False,
    )
    response_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False, unique=True),
    )
    op.create_index("ix_organizations_name", "organizations", ["name"])

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="RESTRICT",
        ),
    )
    op.create_index("ix_users_organization_id", "users", ["organization_id"])
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("organization_id", "name", name="uq_projects_org_name"),
    )
    op.create_index("ix_projects_organization_id", "projects", ["organization_id"])
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"])

    op.create_table(
        "emission_factors",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("material_name", sa.String(length=255), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("value", sa.Numeric(12, 6), nullable=False),
        sa.Column("unit", sa.String(length=64), nullable=False),
        sa.UniqueConstraint(
            "material_name",
            "version",
            name="uq_emission_factors_material_version",
        ),
    )
    op.create_index(
        "ix_emission_factors_material_name", "emission_factors", ["material_name"]
    )

    op.create_table(
        "material_entries",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("emission_factor_id", sa.Integer(), nullable=False),
        sa.Column("emission_factor_version", sa.Integer(), nullable=False),
        sa.Column("emission_factor_value", sa.Numeric(12, 6), nullable=False),
        sa.Column("emission_factor_unit", sa.String(length=64), nullable=False),
        sa.Column("emission_factor_material_name", sa.String(length=255), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 6), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["emission_factor_id"],
            ["emission_factors.id"],
            ondelete="RESTRICT",
        ),
    )
    op.create_index(
        "ix_material_entries_project_id", "material_entries", ["project_id"]
    )
    op.create_index("ix_material_entries_user_id", "material_entries", ["user_id"])
    op.create_index(
        "ix_material_entries_emission_factor_id",
        "material_entries",
        ["emission_factor_id"],
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=False),
        sa.Column("response_type", response_type_enum, nullable=False),
        sa.Column("response_deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.String(length=100), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("previous_state", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("new_state", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
    )
    op.create_index("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_actor_user_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")

    op.drop_index("ix_material_entries_emission_factor_id", table_name="material_entries")
    op.drop_index("ix_material_entries_user_id", table_name="material_entries")
    op.drop_index("ix_material_entries_project_id", table_name="material_entries")
    op.drop_table("material_entries")

    op.drop_index("ix_emission_factors_material_name", table_name="emission_factors")
    op.drop_table("emission_factors")

    op.drop_index("ix_projects_owner_id", table_name="projects")
    op.drop_index("ix_projects_organization_id", table_name="projects")
    op.drop_table("projects")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_organization_id", table_name="users")
    op.drop_table("users")

    op.drop_index("ix_organizations_name", table_name="organizations")
    op.drop_table("organizations")

    response_type_enum = sa.Enum(
        "NONE", "ACKNOWLEDGED", "DISPUTED", name="response_type_enum"
    )
    response_type_enum.drop(op.get_bind(), checkfirst=True)
