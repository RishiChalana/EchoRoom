"""add_audio_to_session_reports

Revision ID: a1b2c3d4e5f6
Revises: f2a3b4c5d6e7
Create Date: 2026-07-01 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('session_reports', sa.Column('audio_data', sa.LargeBinary(), nullable=True))
    op.add_column('session_reports', sa.Column('audio_content_type', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('session_reports', 'audio_content_type')
    op.drop_column('session_reports', 'audio_data')
