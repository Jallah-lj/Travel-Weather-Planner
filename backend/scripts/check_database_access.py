"""Run against a migrated staging PostgreSQL DB as admin (CI/local operator)."""
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError
from app.core.config import get_settings
settings=get_settings()
engine=create_engine(settings.database_migration_url or settings.database_url)
with engine.connect() as db:
    rows=db.execute(text("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename!='alembic_version'")).all()
    assert len(rows)>=21 and all(row.rowsecurity for row in rows), 'An app table lacks RLS'
    for role in ('anon','authenticated'):
        for table in ('users','trip_plans','trip_shares'):
            db.rollback();db.execute(text(f'SET LOCAL ROLE {role}'))
            try:db.execute(text(f'SELECT * FROM public.{table} LIMIT 1'))
            except DBAPIError as exc:
                assert getattr(exc.orig,'sqlstate',None)=='42501', 'Expected insufficient privilege'
            else:raise AssertionError('Browser role unexpectedly has table access')
    db.rollback();db.execute(text('SET LOCAL ROLE travel_app'))
    db.execute(text('SELECT id FROM public.users LIMIT 1'))
    assert not db.execute(text("SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user")).scalar()
engine.dispose()
print('PASS: PostgreSQL browser access denied; backend role and RLS verified.')
