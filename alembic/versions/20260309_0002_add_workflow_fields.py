"""add workflow fields

Revision ID: 20260309_0002
Revises: 20260309_0001
Create Date: 2026-03-09 00:02:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260309_0002"
down_revision = "20260309_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_role_enum = postgresql.ENUM(
        "ADMIN",
        "VERIFIER",
        "CREATOR",
        name="user_role_enum",
    )
    material_state_enum = postgresql.ENUM(
        "DRAFT",
        "SUBMITTED",
        "VERIFIED",
        "APPROVED",
        "LOCKED",
        name="material_state_enum",
    )
    user_role_enum.create(op.get_bind(), checkfirst=True)
    material_state_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "users",
        sa.Column(
            "role",
            postgresql.ENUM(name="user_role_enum", create_type=False),
            nullable=False,
            server_default="CREATOR",
        ),
    )

    op.add_column(
        "material_entries",
        sa.Column("origin_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "material_entries",
        sa.Column(
            "revision_number", sa.Integer(), nullable=False, server_default="1"
        ),
    )
    op.add_column(
        "material_entries",
        sa.Column(
            "state",
            postgresql.ENUM(name="material_state_enum", create_type=False),
            nullable=False,
            server_default="DRAFT",
        ),
    )
    op.add_column(
        "material_entries",
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "material_entries",
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "material_entries",
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "material_entries",
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "material_entries",
        sa.Column("verified_by_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "material_entries",
        sa.Column("approved_by_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "material_entries",
        sa.Column("locked_by_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_material_entries_origin_id",
        "material_entries",
        "material_entries",
        ["origin_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_material_entries_verified_by_id",
        "material_entries",
        "users",
        ["verified_by_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_material_entries_approved_by_id",
        "material_entries",
        "users",
        ["approved_by_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_material_entries_locked_by_id",
        "material_entries",
        "users",
        ["locked_by_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_material_entries_origin_id", "material_entries", ["origin_id"])
    op.create_index("ix_material_entries_state", "material_entries", ["state"])
    op.create_index(
        "ix_material_entries_verified_by_id",
        "material_entries",
        ["verified_by_id"],
    )
    op.create_index(
        "ix_material_entries_approved_by_id",
        "material_entries",
        ["approved_by_id"],
    )
    op.create_index(
        "ix_material_entries_locked_by_id",
        "material_entries",
        ["locked_by_id"],
    )

    op.add_column(
        "notifications",
        sa.Column("material_entry_id", sa.Integer(), nullable=False),
    )
    op.create_foreign_key(
        "fk_notifications_material_entry_id",
        "notifications",
        "material_entries",
        ["material_entry_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_notifications_material_entry_id", "notifications", ["material_entry_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_material_entry_id", table_name="notifications")
    op.drop_constraint(
        "fk_notifications_material_entry_id",
        "notifications",
        type_="foreignkey",
    )
    op.drop_column("notifications", "material_entry_id")

    op.drop_index("ix_material_entries_locked_by_id", table_name="material_entries")
    op.drop_index("ix_material_entries_approved_by_id", table_name="material_entries")
    op.drop_index("ix_material_entries_verified_by_id", table_name="material_entries")
    op.drop_index("ix_material_entries_state", table_name="material_entries")
    op.drop_index("ix_material_entries_origin_id", table_name="material_entries")
    op.drop_constraint(
        "fk_material_entries_locked_by_id",
        "material_entries",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_material_entries_approved_by_id",
        "material_entries",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_material_entries_verified_by_id",
        "material_entries",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_material_entries_origin_id",
        "material_entries",
        type_="foreignkey",
    )
    op.drop_column("material_entries", "locked_by_id")
    op.drop_column("material_entries", "approved_by_id")
    op.drop_column("material_entries", "verified_by_id")
    op.drop_column("material_entries", "locked_at")
    op.drop_column("material_entries", "approved_at")
    op.drop_column("material_entries", "verified_at")
    op.drop_column("material_entries", "submitted_at")
    op.drop_column("material_entries", "state")
    op.drop_column("material_entries", "revision_number")
    op.drop_column("material_entries", "origin_id")

    op.drop_column("users", "role")

    material_state_enum = postgresql.ENUM(name="material_state_enum")
    user_role_enum = postgresql.ENUM(name="user_role_enum")
    material_state_enum.drop(op.get_bind(), checkfirst=True)
    user_role_enum.drop(op.get_bind(), checkfirst=True)
