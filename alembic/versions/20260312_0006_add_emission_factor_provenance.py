"""Add emission factor provenance fields.

Revision ID: 20260312_0006
Revises: 20260312_0005
Create Date: 2026-03-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260312_0006"
down_revision: Union[str, None] = "20260312_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "emission_factors",
        sa.Column("standard_name", sa.String(length=255), nullable=False),
    )
    op.add_column(
        "emission_factors",
        sa.Column("region", sa.String(length=255), nullable=False),
    )
    op.add_column(
        "emission_factors",
        sa.Column("source_document_url", sa.String(length=500), nullable=False),
    )
    op.add_column(
        "emission_factors",
        sa.Column("methodology_reference", sa.String(length=500), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("emission_factors", "methodology_reference")
    op.drop_column("emission_factors", "source_document_url")
    op.drop_column("emission_factors", "region")
    op.drop_column("emission_factors", "standard_name")
