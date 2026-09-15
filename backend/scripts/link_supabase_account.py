"""Explicit admin migration of ONE legacy account. Never run on requests/startup.
Uses the trusted migration DB connection to verify the identity in auth.users.
"""
import argparse
import uuid
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
from app.core.config import get_settings

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--local-user-id',required=True,type=uuid.UUID)
    parser.add_argument('--supabase-user-id',required=True,type=uuid.UUID)
    parser.add_argument('--confirm-ownership',action='store_true',required=True)
    args=parser.parse_args();url=get_settings().database_migration_url
    if not url.startswith('postgresql+psycopg://'):raise SystemExit('A trusted DATABASE_MIGRATION_URL is required; never use browser credentials.')
    engine=create_engine(url,poolclass=NullPool,connect_args={'prepare_threshold':None,'connect_timeout':10})
    with engine.begin() as db:
        local=db.execute(text('SELECT id,email,is_active,supabase_subject FROM public.users WHERE id=:id FOR UPDATE'),{'id':args.local_user_id}).mappings().first()
        remote=db.execute(text('SELECT id,email,email_confirmed_at FROM auth.users WHERE id=:id'),{'id':args.supabase_user_id}).mappings().first()
        if not local or not remote:raise SystemExit('Both reviewed identities must exist in this database.')
        if not local['is_active'] or not remote['email_confirmed_at'] or local['email'].lower()!=remote['email'].lower():raise SystemExit('Active account and matching, confirmed email are required.')
        if local['supabase_subject'] and local['supabase_subject']!=args.supabase_user_id:raise SystemExit('Account already linked to another identity; no changes made.')
        db.execute(text("UPDATE public.users SET supabase_subject=:subject,password_hash='!supabase-managed' WHERE id=:id"),{'subject':args.supabase_user_id,'id':args.local_user_id})
    engine.dispose();print('Reviewed account linked. Existing local user ID and trip ownership were preserved.')
if __name__=='__main__':main()
