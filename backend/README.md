# GO Transit backend

FastAPI backend for the GO Transit mobile app. It fetches Metrolinx data and exposes typed responses for stations, departures, journey planning, schedules, fares, and service alerts.

## Prerequisites

- Python 3.11 (the version used to verify this setup).
- A Metrolinx API key.
- Docker with Compose only if you choose Redis caching.

## Setup on Windows

Run these commands from the project root (`Go App`) in PowerShell:

```powershell
# Skip this command if the project's venv already exists.
py -3.11 -m venv venv

.\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd backend

# Preserve an existing .env file.
if (!(Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}
```

Edit `backend/.env` and replace `METROLINX_API_KEY=your_api_key_here` with your API key. Keep the key in the backend; do not include it in the mobile app. `.env` is ignored by Git.

The example uses `CACHE_BACKEND=memory` so local startup does not require Redis. Memory caching and rate limiting are scoped to one server process and reset when it restarts.

The requirements include pinned runtime dependencies and their dependencies from the existing environment. Virtual environment activation is optional: the commands use its Python executable directly, avoiding PowerShell activation policy restrictions.

## Start the API

From the `backend` directory:

```powershell
..\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Run from this directory so Python can import `app` and the backend's `.env` is loaded consistently. `--reload` is for local development.

- Health: <http://localhost:8000/health>
- Interactive API documentation: <http://localhost:8000/docs>
- OpenAPI schema: <http://localhost:8000/openapi.json>
- Stations: <http://localhost:8000/api/stops>

In a second PowerShell terminal, verify startup:

```powershell
Invoke-RestMethod http://localhost:8000/health
Invoke-RestMethod http://localhost:8000/api/stops
```

With memory caching, health should report `status: ok`, `cache_backend: memory`, and `cache: ok`. Health checks the cache, not Metrolinx connectivity or API key validity. The stations request verifies the upstream data connection.

For a physical phone, use `http://<your-computer-LAN-IP>:8000` as the API address. Connect the computer and phone to the same network and allow the backend through Windows Firewall on the private network if needed.

## Optional Redis caching

From the `backend` directory:

```powershell
docker compose -f docker-compose.redis.yml up -d
```

Set these values in `backend/.env`, then restart the API:

```dotenv
CACHE_BACKEND=redis
REDIS_URL=redis://localhost:6379/0
```

The API verifies Redis connectivity during startup. To stop Redis while preserving its volume:

```powershell
docker compose -f docker-compose.redis.yml down
```

## Validation and mobile API contracts

From the project root:

```powershell
.\venv\Scripts\python.exe -m unittest discover -s backend/tests
.\venv\Scripts\python.exe backend/scripts/generate_mobile_types.py
.\venv\Scripts\python.exe backend/scripts/generate_mobile_types.py --check
```

The generator reads FastAPI's OpenAPI schema without starting a server or calling Metrolinx. Commit the regenerated `mobile/src/api/generated.ts` whenever response models change.

Date inputs accept `YYYYMMDD` or `YYYY-MM-DD` and validate calendar dates. Journey start times accept `HHMM` or `HH:MM`, from `00:00` to `23:59`. Default schedule dates use `America/Toronto`; the pinned `tzdata` dependency supports Windows.

Upstream TLS verification is enabled. Provider connection failures return 502, timeouts return 504, and provider rate limits return 503. Errors omit provider URLs and credentials. Backend rate limits still return 429 with `Retry-After`.

## Troubleshooting

- `METROLINX_API_KEY not set`: check `backend/.env` and start from the `backend` directory.
- Redis connection failure: start the Compose service or use `CACHE_BACKEND=memory` for local development.
- Health works but transit requests fail: check the API key and connectivity to Metrolinx.
- Phone cannot reach the API: check the LAN IP, shared network, and firewall access. `localhost` on the phone refers to the phone itself.
