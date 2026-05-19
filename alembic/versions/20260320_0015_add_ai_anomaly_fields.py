"""Add AI anomaly detection fields to material entries.

Revision ID: 20260320_0015
Revises: 20260320_0014
Create Date: 2026-03-20
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260320_0015"
down_revision: Union[str, None] = "20260320_0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("material_entries", sa.Column("ai_risk_score", sa.Numeric(10, 4), nullable=True))
    op.add_column("material_entries", sa.Column("ai_risk_level", sa.String(length=16), nullable=True))
    op.add_column("material_entries", sa.Column("ai_anomaly_reason", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("material_entries", "ai_anomaly_reason")
    op.drop_column("material_entries", "ai_risk_level")
    op.drop_column("material_entries", "ai_risk_score")
