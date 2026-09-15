# Infrastructure

- `docker/` is reserved for hardened container and reverse-proxy overlays.
- `terraform/` is reserved for cloud networking, managed PostgreSQL/Redis, container runtime, secret-manager, and observability resources.

Keep environment-specific state and secrets outside source control. The root `docker-compose.yml` is the supported local development environment.
