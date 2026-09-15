"""Expiring, revocable trip-link capabilities (hashes only)."""
from alembic import op
import sqlalchemy as sa
revision = '20260914_trip_shares'
down_revision = '20260914_trip_plans'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('trip_shares',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('trip_id', sa.Uuid(), sa.ForeignKey('trips.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(64), nullable=False),
        sa.Column('permission', sa.String(8), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_trip_shares_trip_id', 'trip_shares', ['trip_id'])
    op.create_index('ix_trip_shares_token_hash', 'trip_shares', ['token_hash'], unique=True)

def downgrade():
    op.drop_table('trip_shares')
