"""Explicit release command: seed real catalogue only, never demo trips."""
from app.core.database import SessionLocal
from app.core.seed import seed_database
if __name__ == '__main__':
    with SessionLocal() as db:
        seed_database(db, include_demo=False)
    print('Destination catalogue initialized; no demo trip created.')
