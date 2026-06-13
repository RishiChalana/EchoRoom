"""phase9a_session_name_audience_wpm

Revision ID: a3f8d2b1c9e7
Revises: ccf46ca114f2
Create Date: 2026-06-13 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a3f8d2b1c9e7'
down_revision: Union[str, None] = 'ccf46ca114f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Add name column to sessions (nullable, no default)
    op.add_column('sessions', sa.Column('name', sa.String(200), nullable=True))

    # 2) Rename audience_profile text values (stored as plain Text, not PG enum)
    op.execute("UPDATE sessions SET audience_profile = 'interview' WHERE audience_profile = 'executive'")
    op.execute("UPDATE sessions SET audience_profile = 'presentation' WHERE audience_profile = 'students'")

    # 3) Add wpm column to session_reports (nullable int)
    op.add_column('session_reports', sa.Column('wpm', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('session_reports', 'wpm')

    # Restore old audience_profile values
    op.execute("UPDATE sessions SET audience_profile = 'executive' WHERE audience_profile = 'interview'")
    op.execute("UPDATE sessions SET audience_profile = 'students' WHERE audience_profile = 'presentation'")

    op.drop_column('sessions', 'name')
