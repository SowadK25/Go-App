import asyncio
import json
import logging
from typing import Any, Optional

from app.config import REDIS_CACHE_PREFIX, REDIS_RATE_LIMIT_PREFIX, REDIS_URL

logger = logging.getLogger(__name__)


class CacheBackend:
    async def get(self, key: str) -> Optional[Any]:
        raise NotImplementedError

    async def set(self, key: str, value: Any, ttl_seconds: Optional[int]) -> None:
        raise NotImplementedError

    async def increment_window(self, key: str, window_seconds: int) -> tuple[int, int]:
        raise NotImplementedError

    async def ping(self) -> bool:
        raise NotImplementedError


class RedisCache(CacheBackend):
    def __init__(self, redis_url: str) -> None:
        from redis.asyncio import Redis

        self._redis = Redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
        self._cache_prefix = REDIS_CACHE_PREFIX.strip(":")
        self._rate_limit_prefix = REDIS_RATE_LIMIT_PREFIX.strip(":")

    def _cache_key(self, key: str) -> str:
        return f"{self._cache_prefix}:{key}" if self._cache_prefix else key

    def _rate_limit_key(self, key: str) -> str:
        return f"{self._rate_limit_prefix}:{key}" if self._rate_limit_prefix else key

    async def get(self, key: str) -> Optional[Any]:
        payload = await self._redis.get(self._cache_key(key))
        if payload is None:
            return None
        return json.loads(payload)

    async def set(self, key: str, value: Any, ttl_seconds: Optional[int]) -> None:
        payload = json.dumps(value)
        if ttl_seconds:
            await self._redis.set(self._cache_key(key), payload, ex=ttl_seconds)
            return
        await self._redis.set(self._cache_key(key), payload)

    async def increment_window(self, key: str, window_seconds: int) -> tuple[int, int]:
        full_key = self._rate_limit_key(key)
        count = await self._redis.incr(full_key)
        if count == 1:
            await self._redis.expire(full_key, window_seconds)
            return int(count), window_seconds

        ttl_remaining = await self._redis.ttl(full_key)
        return int(count), max(1, int(ttl_remaining))

    async def ping(self) -> bool:
        return bool(await self._redis.ping())


def build_cache_backend() -> CacheBackend:
    if not REDIS_URL:
        raise RuntimeError("REDIS_URL not set")

    return RedisCache(REDIS_URL)


_CACHE_BACKEND = build_cache_backend()


def get_cache_backend() -> CacheBackend:
    return _CACHE_BACKEND
