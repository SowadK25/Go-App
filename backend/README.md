# GO Transit backend

FastAPI backend for the GO Transit mobile app. It fetches Metrolinx data and exposes typed responses for stations, departures, journey planning, schedules, fares, and service alerts.

`GET /api/stops/{code}/departures?schedule_date=YYYYMMDD` returns the entire selected calendar day's boarding departures to all destinations, sorted by scheduled departure. It uses the published GTFS timetable, applies weekly calendars and added/removed service exceptions, includes previous-service-day departures with 24+ hour times, and excludes terminal arrivals and stops where boarding is prohibited. Rows include the original service date and the remaining stop timeline for trip details. The feed is retained for a day per backend worker and shared between maps and station boards; up to two processed day indexes are retained so opening another station avoids rescanning the archive. Dates outside feed coverage return an explanatory 404. Live predictions remain separate in `/next-service` and may be empty without hiding scheduled trips.

`GET /api/map/network` supplies station coordinates, route membership, and published train/bus shapes from [GO's official GTFS feed](https://www.gotransit.com/en/partner-with-us/software-developers). It downloads the ZIP once per day through the shared cache, reads it without extracting files, parses it in a worker thread, and simplifies route shapes to a 25-metre tolerance. The first request can take several seconds; simultaneous requests share one download. Cached responses avoid additional Open Data calls. If a refresh fails, the process can return its last good map with `stale=true`; an initial failure returns a safe 503. Responses are compressed when the client supports gzip. This is a published network overview, independent of service running today.

Journey searches use the official GO website's public timetable as the primary source. Open Metrolinx journey options are requested only when the official request fails or returns an invalid response. A valid empty timetable stays empty. Results are deduplicated, sorted by departure time, and limited to the requested count. Timetables cache for five minutes. Stations, fares, alerts, and real-time service data continue to use Open Data.

Longer mixed-mode journeys remain available. For Open Data fallback results, the backend only removes slower same-line, same-station train changes when the same boarding service has a direct trip arriving no later.

Journey requests accept `search_mode=depart_at` (default) or `search_mode=arrive_by`. In arrival mode, the path date/time is the desired arrival target. The backend reads the official timetable for that date and the previous date concurrently, plus the following date when the window crosses forward past midnight, filters out departures before the current Toronto time, and includes scheduled arrivals from one hour before the target through 30 minutes after it (inclusive). The window can cross midnight. Results are deduplicated and returned with the latest departures first. A same-departure tie prefers the earlier arrival. Filtering happens before the requested result limit and is recalculated even when timetables are cached. Both timetables use the existing five-minute cache. If either timetable fails or is invalid, arrival search returns 503 with a suggestion to try Depart at; the forward-only Open Data fallback cannot provide a complete arrival search.

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

Live train/bus service feeds cache for 60 seconds; service exceptions cache for 120 seconds. These caches are shared by requests within the configured cache backend. Station predictions and Union departures retain their existing 15-second cache.

Detailed trip schedules cache for 60 seconds to support stop predictions on an opened journey.
