"""Persist private trip plans with optimistic version checks."""
from alembic import op
import sqlalchemy as sa
revision = '20260914_trip_plans'
down_revision = 'd035defcc88c'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('trip_plans', sa.Column('trip_id', sa.Uuid(), sa.ForeignKey('trips.id', ondelete='CASCADE'), primary_key=True), sa.Column('itinerary', sa.JSON(), nullable=False), sa.Column('packing', sa.JSON(), nullable=False), sa.Column('revision', sa.Integer(), nullable=False))

def downgrade():
    op.drop_table('trip_plans')
