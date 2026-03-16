"""add user password hash

Revision ID: 20260309_0003
Revises: 20260309_0002
Create Date: 2026-03-09 00:03:00

"""
from alembic import op
import sqlalchemy as sa


revision = "20260309_0003"
down_revision = "20260309_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(length=255), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("users", "password_hash")
