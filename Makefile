.PHONY: dev up down test test-backend test-frontend build migrate

dev:
	docker compose up --build
up:
	docker compose up -d
down:
	docker compose down
test: test-backend test-frontend
test-backend:
	cd backend && pytest
test-frontend:
	cd frontend && npm test
build:
	cd frontend && npm run build
migrate:
	cd backend && alembic upgrade head
