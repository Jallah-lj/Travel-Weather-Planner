"""Explicit Supabase identity mapping; deny browser Data API access to app tables."""
from alembic import op
import sqlalchemy as sa
revision = '20260915_supabase'
down_revision = '20260914_trip_shares'
branch_labels = None
depends_on = None
TABLES = ('users','profiles','destinations','trips','trip_destinations','weather_snapshots','weather_forecasts','activities','itineraries','itinerary_items','packing_lists','packing_items','weather_alerts','notifications','saved_destinations','search_history','ai_conversations','ai_messages','audit_logs','trip_plans','trip_shares')

def upgrade():
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('supabase_subject', sa.Uuid(), nullable=True))
        batch.create_unique_constraint('uq_users_supabase_subject', ['supabase_subject'])
    if op.get_bind().dialect.name == 'postgresql':
        for table in TABLES:
            op.execute(f'ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY')
            for role in ('anon', 'authenticated'):
                op.execute(f"DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname='{role}') THEN REVOKE ALL ON public.{table} FROM {role}; END IF; END $$")

def downgrade():
    # Do not silently re-open Data API access during rollback.
    with op.batch_alter_table('users') as batch:
        batch.drop_constraint('uq_users_supabase_subject', type_='unique')
        batch.drop_column('supabase_subject')
