# Deploy Unionbound's backend to Railway

The backend includes a Python 3.11 Docker image and `serve.py` production entry point. Railway supplies `PORT`; the server binds to `0.0.0.0` on that port. The image runs as an unprivileged user and copies only runtime files. API credentials are supplied at runtime, never built into the image.

## Create the service

1. Create a Railway project named **Unionbound** and an API service from this repository.
2. Set the service's **Root Directory** to `/backend`. Railway should detect `backend/Dockerfile` automatically. Leave the start-command override empty so the image runs `python serve.py`.
3. Add these service variables:

   | Variable | Value |
   | --- | --- |
   | `METROLINX_API_KEY` | Your existing backend API key, entered privately in Railway |
   | `CACHE_BACKEND` | `memory` |
   | `RATE_LIMIT_PER_MIN` | `120` |

4. Use **one replica**. The entry point uses one server worker because memory caches and limits are process-local. No database or persistent volume is needed for the initial setup; favorites and tracked trips remain on the phone.
5. Set **Healthcheck Path** to `/health`, **Healthcheck Timeout** to 60 seconds, and **Restart Policy** to On Failure. Deploy the service.
6. Configure trusted ingress before using the public service with multiple users (see below), then generate a domain under **Settings → Networking**. Railway terminates HTTPS for the generated domain.

If deploying local files with the Railway CLI, upload only the backend directory with `railway up ./backend --path-as-root` from the repository root. Keep `.env` ignored; do not use `--no-gitignore`.

## Preserve rate-limit protection behind the hosting proxy

`serve.py` ignores forwarded headers by default. Set the Railway service's `FORWARDED_ALLOW_IPS` process variable to the verified addresses or networks of the proxies directly reaching the container. Uvicorn then resolves the client address for the existing rate-limit middleware. Wildcard trust (`*`) is rejected by the entry point.

Confirm the hosting provider's proxy addresses and header handling before enabling trust. Do not guess a broad private-network allowlist. Until this is configured, requests through the same proxy share a rate-limit bucket. Do not expose a raw TCP proxy to the HTTP port or add an untrusted extra proxy to the request path.

Before directing the mobile app to the public URL, check that varying caller-supplied `X-Forwarded-For`, `X-Real-IP`, and `Forwarded` headers cannot change the caller's rate-limit identity. Two separate real client addresses should retain separate buckets. The local automated tests cover this behaviour with trusted and untrusted proxy chains; the actual hosted ingress must also be checked.

## Connect the mobile app

Check `https://<generated-domain>/health`; expect `status: ok` and `cache_backend: memory`. Then check `/api/stops` to verify the Metrolinx key works. The initial map/station timetable fetch may take longer while the cache warms up.

Change `mobile/.env.local` to the generated HTTPS base URL, without `/api`:

```dotenv
EXPO_PUBLIC_API_URL=https://<generated-domain>
```

Restart Expo with `npx expo start --clear`. Test a trip search, station departures, schedules, alerts, and the map. A phone using this backend no longer needs to share the backend computer's Wi-Fi network. The Expo development bundle is still a separate connection; hosting the API alone does not distribute a standalone mobile app.

For local Docker verification from the repository root:

```powershell
docker build -t unionbound-api ./backend
docker run --rm -p 8000:8000 --env-file ./backend/.env -e PORT=8000 -e CACHE_BACKEND=memory unionbound-api
```

## Scaling later

Memory caches and limits reset on restart. Add Redis and set `CACHE_BACKEND=redis` and `REDIS_URL` to its private connection reference before increasing replicas. GO/UP GTFS archives and processed day indexes also have process-local caches, so extra replicas repeat their initialization work.

Sources: [Railway FastAPI deployment](https://docs.railway.com/guides/fastapi), [monorepo root directories](https://docs.railway.com/deployments/monorepo), [health checks](https://docs.railway.com/deployments/healthchecks), [CLI deployments](https://docs.railway.com/cli/up), and [Uvicorn proxy guidance](https://www.uvicorn.org/deployment/).
