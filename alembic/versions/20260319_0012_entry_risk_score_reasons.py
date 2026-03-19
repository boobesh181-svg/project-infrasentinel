"""Adjust entry risk scoring schema for fraud engine.

Revision ID: 20260319_0012
Revises: 20260318_0011
Create Date: 2026-03-19
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260319_0012"
down_revision: Union[str, None] = "20260318_0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE entry_risk_scores
        ALTER COLUMN risk_score TYPE integer
        USING ROUND(risk_score)::integer
        """
    )

    op.add_column(
        "entry_risk_scores",
        sa.Column(
            "reasons",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("entry_risk_scores", "reasons")

    op.execute(
        """
        ALTER TABLE entry_risk_scores
        ALTER COLUMN risk_score TYPE numeric(10,4)
        USING risk_score::numeric(10,4)
        """
    )
