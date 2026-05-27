"""Add delivery detection fields.

Revision ID: 20260527_0022
Revises: 20260526_0021
Create Date: 2026-05-27
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260527_0022"
down_revision: Union[str, None] = "20260526_0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("delivery_events", sa.Column("detected_plate", sa.String(length=64), nullable=True))
    op.add_column("delivery_events", sa.Column("detected_material_type", sa.String(length=255), nullable=True))
    op.add_column("delivery_events", sa.Column("detection_confidence", sa.Float(), nullable=True))
    op.add_column("delivery_events", sa.Column("anpr_confidence", sa.Float(), nullable=True))
    op.add_column("delivery_events", sa.Column("duplicate_vehicle", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("delivery_events", sa.Column("suspicious_flags", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.add_column("delivery_events", sa.Column("detected_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("delivery_events", "detected_at")
    op.drop_column("delivery_events", "suspicious_flags")
    op.drop_column("delivery_events", "duplicate_vehicle")
    op.drop_column("delivery_events", "anpr_confidence")
    op.drop_column("delivery_events", "detection_confidence")
    op.drop_column("delivery_events", "detected_material_type")
    op.drop_column("delivery_events", "detected_plate")
