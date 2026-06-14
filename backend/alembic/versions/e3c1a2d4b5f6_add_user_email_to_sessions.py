"""add_user_email_to_sessions

Revision ID: e3c1a2d4b5f6
Revises: a3f8d2b1c9e7
Create Date: 2026-06-14 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e3c1a2d4b5f6'
down_revision: Union[str, None] = 'a3f8d2b1c9e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'sessions',
        sa.Column('user_email', sa.String(255), nullable=True),
    )
    op.create_index('ix_sessions_user_email', 'sessions', ['user_email'])


def downgrade() -> None:
    op.drop_index('ix_sessions_user_email', table_name='sessions')
    op.drop_column('sessions', 'user_email')
