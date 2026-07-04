import os
from dotenv import load_dotenv

load_dotenv()

METROLINX_API_KEY = os.getenv("METROLINX_API_KEY")
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "120"))
CACHE_BACKEND = os.getenv("CACHE_BACKEND", "redis").lower()
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_KEY_PREFIX = os.getenv("REDIS_KEY_PREFIX", "goapp")
REDIS_CACHE_PREFIX = os.getenv("REDIS_CACHE_PREFIX", f"{REDIS_KEY_PREFIX}:cache")
REDIS_RATE_LIMIT_PREFIX = os.getenv("REDIS_RATE_LIMIT_PREFIX", f"{REDIS_KEY_PREFIX}:ratelimit")

if not METROLINX_API_KEY:
    raise RuntimeError("METROLINX_API_KEY not set")

if CACHE_BACKEND not in {"redis", "memory"}:
    raise RuntimeError("CACHE_BACKEND must be 'redis' or 'memory'")
