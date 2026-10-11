import asyncio
import httpx

from app.utils.cache import get_cache_backend
from app.utils.gtfs_map import parse_gtfs_map
from app.models.network_map import NetworkMap


class GtfsClient:
    URL = "https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/GO-GTFS.zip"

    def __init__(self):
        self._cache = get_cache_backend()
        self._lock = asyncio.Lock()
        self._last_good: NetworkMap | None = None

    async def get_network(self) -> NetworkMap:
        async with self._lock:
            try:
                cached = await self._cache.get("gtfs-network-map:v1")
                if cached is not None:
                    self._last_good = NetworkMap.model_validate(cached)
                    return self._last_good
            except Exception:
                pass
            try:
                async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                    async with client.stream("GET", self.URL) as response:
                        response.raise_for_status()
                        chunks = []
                        size = 0
                        async for chunk in response.aiter_bytes():
                            size += len(chunk)
                            if size > 40_000_000:
                                raise ValueError("GTFS download too large")
                            chunks.append(chunk)
                result = await asyncio.to_thread(parse_gtfs_map, b"".join(chunks))
                self._last_good = result
                try:
                    await self._cache.set("gtfs-network-map:v1", result.model_dump(mode="json"), 86400)
                except Exception:
                    pass
                return result
            except Exception:
                if self._last_good:
                    return self._last_good.model_copy(update={"stale": True})
                raise
