"""Add supplier invoices and delivery links.

Revision ID: 20260526_0021
Revises: 20260524_0020
Create Date: 2026-05-26
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260526_0021"
down_revision: Union[str, None] = "20260524_0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    invoice_status_enum = postgresql.ENUM(
        "EXTRACTED",
        "NEEDS_REVIEW",
        "CONFIRMED",
        "FAILED",
        name="invoice_status_enum",
    )
    invoice_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "supplier_invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("supplier_name", sa.String(length=255), nullable=True),
        sa.Column("invoice_number", sa.String(length=128), nullable=True),
        sa.Column("material_type", sa.String(length=255), nullable=True),
        sa.Column("expected_quantity", sa.Numeric(14, 6), nullable=True),
        sa.Column("vehicle_number", sa.String(length=64), nullable=True),
        sa.Column("invoice_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("extraction_confidence", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("extraction_status", postgresql.ENUM(name="invoice_status_enum", create_type=False), nullable=False, server_default="EXTRACTED"),
        sa.Column("extraction_errors", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_type", sa.String(length=128), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("file_hash", sa.String(length=64), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("correction_notes", sa.String(length=500), nullable=True),
        sa.Column("corrected_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("corrected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_supplier_invoices_org_id", "supplier_invoices", ["organization_id"])
    op.create_index("ix_supplier_invoices_supplier_name", "supplier_invoices", ["supplier_name"])
    op.create_index("ix_supplier_invoices_invoice_number", "supplier_invoices", ["invoice_number"])
    op.create_index("ix_supplier_invoices_vehicle_number", "supplier_invoices", ["vehicle_number"])
    op.create_index("ix_supplier_invoices_invoice_timestamp", "supplier_invoices", ["invoice_timestamp"])

    op.create_table(
        "invoice_delivery_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supplier_invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("delivery_event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("delivery_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("match_confidence", sa.Float(), nullable=True),
        sa.Column("match_reason", sa.String(length=255), nullable=True),
        sa.Column("matched_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_invoice_delivery_links_invoice_id", "invoice_delivery_links", ["invoice_id"])
    op.create_index("ix_invoice_delivery_links_delivery_event_id", "invoice_delivery_links", ["delivery_event_id"])


def downgrade() -> None:
    op.drop_index("ix_invoice_delivery_links_delivery_event_id", table_name="invoice_delivery_links")
    op.drop_index("ix_invoice_delivery_links_invoice_id", table_name="invoice_delivery_links")
    op.drop_table("invoice_delivery_links")

    op.drop_index("ix_supplier_invoices_invoice_timestamp", table_name="supplier_invoices")
    op.drop_index("ix_supplier_invoices_vehicle_number", table_name="supplier_invoices")
    op.drop_index("ix_supplier_invoices_invoice_number", table_name="supplier_invoices")
    op.drop_index("ix_supplier_invoices_supplier_name", table_name="supplier_invoices")
    op.drop_index("ix_supplier_invoices_org_id", table_name="supplier_invoices")
    op.drop_table("supplier_invoices")

    invoice_status_enum = postgresql.ENUM(name="invoice_status_enum")
    invoice_status_enum.drop(op.get_bind(), checkfirst=True)
