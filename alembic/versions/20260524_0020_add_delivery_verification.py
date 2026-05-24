"""Add delivery_events, evidence_assets, and verification_results tables.

Revision ID: 20260524_0020
Revises: 20260320_0015
Create Date: 2026-05-24
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260524_0020"
down_revision: Union[str, None] = "20260320_0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "delivery_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("camera_id", sa.String(length=128), nullable=True),
        sa.Column("vehicle_plate", sa.String(length=64), nullable=True),
        sa.Column("supplier", sa.String(length=255), nullable=True),
        sa.Column("expected_quantity", sa.Float(), nullable=True),
        sa.Column("detected_quantity", sa.Float(), nullable=True),
        sa.Column("gps_lat", sa.Float(), nullable=True),
        sa.Column("gps_lng", sa.Float(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False, server_default="INGESTED"),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_delivery_events_site_id", "delivery_events", ["site_id"])
    op.create_index("ix_delivery_events_vehicle_plate", "delivery_events", ["vehicle_plate"])

    op.create_table(
        "evidence_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("delivery_event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("delivery_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_name", sa.String(length=512), nullable=False),
        sa.Column("file_type", sa.String(length=64), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("file_hash", sa.String(length=128), nullable=True),
        sa.Column("storage_path", sa.String(length=1024), nullable=True),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_evidence_delivery_id", "evidence_assets", ["delivery_event_id"])

    op.create_table(
        "verification_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("delivery_event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("delivery_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analyzer", sa.String(length=128), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("reasoning", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_verification_delivery_id", "verification_results", ["delivery_event_id"])


def downgrade() -> None:
    op.drop_index("ix_verification_delivery_id", table_name="verification_results")
    op.drop_table("verification_results")
    op.drop_index("ix_evidence_delivery_id", table_name="evidence_assets")
    op.drop_table("evidence_assets")
    op.drop_index("ix_delivery_events_vehicle_plate", table_name="delivery_events")
    op.drop_index("ix_delivery_events_site_id", table_name="delivery_events")
    op.drop_table("delivery_events")
