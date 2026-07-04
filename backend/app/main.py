import logging
from fastapi import FastAPI, Request
from starlette.responses import JSONResponse
from app.routes import stops, journeys, alerts, schedules, fares, service
from app.config import CACHE_BACKEND, RATE_LIMIT_PER_MIN
from app.utils.cache import get_cache_backend

logger = logging.getLogger(__name__)

app = FastAPI(
    title="GO Transit Unofficial API",
    version="1.0.0",
    description="Unofficial API for GO Transit information including trip planning, schedules, alerts, and real-time data"
)

app.state.cache_backend = get_cache_backend()


@app.on_event("startup")
async def verify_cache_connection():
    if CACHE_BACKEND != "redis":
        return

    cache_ok = await app.state.cache_backend.ping()
    if not cache_ok:
        raise RuntimeError("Redis ping failed")

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if not request.url.path.startswith("/api"):
        return await call_next(request)

    client_ip = request.headers.get("x-forwarded-for") or ""
    if client_ip:
        client_ip = client_ip.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"

    window_seconds = 60

    rate_key = client_ip
    try:
        count, retry_after = await app.state.cache_backend.increment_window(rate_key, window_seconds)
        if count > RATE_LIMIT_PER_MIN:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers={"Retry-After": str(retry_after)},
            )
    except Exception as exc:
        logger.warning("Redis rate limit check failed for %s: %s", client_ip, exc)

    return await call_next(request)

# Include all routers
app.include_router(stops.router)
app.include_router(journeys.router)
app.include_router(alerts.router)
app.include_router(schedules.router)
app.include_router(fares.router)
app.include_router(service.router)

@app.get("/health")
async def health():
    try:
        cache_ok = await app.state.cache_backend.ping()
    except Exception as exc:
        logger.warning("Cache health check failed: %s", exc)
        cache_ok = False
    return {
        "status": "ok" if cache_ok else "degraded",
        "cache_backend": app.state.cache_backend.backend_name,
        "cache": "ok" if cache_ok else "down",
    }
