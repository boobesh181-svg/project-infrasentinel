"""Add immutable record triggers.

Revision ID: 20260312_0007
Revises: 20260312_0006
Create Date: 2026-03-12
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260312_0007"
down_revision: Union[str, None] = "20260312_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION immutable_record_guard()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'Immutable record cannot be modified.';
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE TRIGGER audit_logs_immutable_update
        BEFORE UPDATE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION immutable_record_guard();
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_logs_immutable_delete
        BEFORE DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION immutable_record_guard();
        """
    )

    op.execute(
        """
        CREATE TRIGGER evidence_files_immutable_update
        BEFORE UPDATE ON evidence_files
        FOR EACH ROW EXECUTE FUNCTION immutable_record_guard();
        """
    )
    op.execute(
        """
        CREATE TRIGGER evidence_files_immutable_delete
        BEFORE DELETE ON evidence_files
        FOR EACH ROW EXECUTE FUNCTION immutable_record_guard();
        """
    )

    op.execute(
        """
        CREATE TRIGGER emission_factors_immutable_update
        BEFORE UPDATE ON emission_factors
        FOR EACH ROW EXECUTE FUNCTION immutable_record_guard();
        """
    )
    op.execute(
        """
        CREATE TRIGGER emission_factors_immutable_delete
        BEFORE DELETE ON emission_factors
        FOR EACH ROW EXECUTE FUNCTION immutable_record_guard();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS emission_factors_immutable_delete ON emission_factors")
    op.execute("DROP TRIGGER IF EXISTS emission_factors_immutable_update ON emission_factors")
    op.execute("DROP TRIGGER IF EXISTS evidence_files_immutable_delete ON evidence_files")
    op.execute("DROP TRIGGER IF EXISTS evidence_files_immutable_update ON evidence_files")
    op.execute("DROP TRIGGER IF EXISTS audit_logs_immutable_delete ON audit_logs")
    op.execute("DROP TRIGGER IF EXISTS audit_logs_immutable_update ON audit_logs")
    op.execute("DROP FUNCTION IF EXISTS immutable_record_guard")
