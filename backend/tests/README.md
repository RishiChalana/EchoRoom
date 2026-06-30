# EchoRoom Backend Tests

## Prerequisites

Docker Compose must be running with at least `postgres` and `redis` before you run
any tests. The test suite connects to a **separate test database** (`echoroom_test`)
on the same Postgres instance used for development — it never touches `echoroom`.

```bash
docker compose up -d postgres redis
```

Create the test database if it doesn't exist yet:

```bash
docker compose exec postgres psql -U echoroom -c "CREATE DATABASE echoroom_test;"
```

## Running tests

From the `backend/` directory (or from inside the `api` container):

```bash
# All tests
pytest

# Only fast unit tests (no Docker required)
pytest -m "not integration"

# Specific file
pytest tests/test_auth.py -v

# With coverage
pytest --cov=app --cov-report=term-missing
```

## Test database

`tests/conftest.py` sets `DATABASE_URL` to the test DB **before** any app module is
imported, so the SQLAlchemy engine is automatically bound to `echoroom_test`. At the
start of every pytest session the schema is dropped and recreated from scratch.

## Environment

The conftest forces these values regardless of `.env`:

| Variable | Test value |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://echoroom:echoroom_dev_pass@localhost:5432/echoroom_test` |
| `NEXTAUTH_SECRET` | `test-secret-for-pytest-only` |
| `ENVIRONMENT` | `test` |
| `REDIS_URL` | `redis://localhost:6379/1` (db 1, separate from dev db 0) |

Override `TEST_DATABASE_URL` in the environment if your Postgres credentials differ.
