import asyncio
import httpx
import time
from collections import OrderedDict

from app.utils.cache import get_cache_backend
from app.utils.gtfs_map import parse_gtfs_map
from app.models.network_map import NetworkMap
from app.utils.gtfs_departures import build_station_day
from app.utils.gtfs_schedules import timetable_lines, line_timetable, published_line_catalog


class GtfsClient:
    URL = "https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/GO-GTFS.zip"

    def __init__(self, url: str | None = None, trip_prefix: str = ""):
        self.url = url or self.URL
        self.trip_prefix = trip_prefix
        self._cache = get_cache_backend()
        self._lock = asyncio.Lock()
        self._last_good: NetworkMap | None = None
        self._feed_lock = asyncio.Lock()
        self._day_lock = asyncio.Lock()
        self._payload: bytes | None = None
        self._feed_updated = 0
        self._days = OrderedDict()

    async def _load_feed(self) -> bytes:
        async with self._feed_lock:
            if self._payload is not None and time.monotonic() - self._feed_updated < 86400:
                return self._payload
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                async with client.stream("GET", self.url) as response:
                    response.raise_for_status()
                    chunks = []
                    size = 0
                    async for chunk in response.aiter_bytes():
                        size += len(chunk)
                        if size > 40_000_000: raise ValueError("GTFS download too large")
                        chunks.append(chunk)
            self._payload = b"".join(chunks)
            self._feed_updated = time.monotonic()
            return self._payload

    async def _get_day(self, date: str):
        payload = await self._load_feed()
        key = (self._feed_updated, date)
        async with self._day_lock:
            if key not in self._days:
                self._days[key] = await asyncio.to_thread(build_station_day, payload, date, self.trip_prefix)
            self._days.move_to_end(key)
            while len(self._days) > 2: self._days.popitem(last=False)
            return self._days[key]

    async def get_station_departures(self, code: str, date: str):
        return (await self._get_day(date)).board(code)

    async def get_timetable_lines(self, date: str):
        return timetable_lines(await self._get_day(date))

    async def get_line_catalog(self):
        return await asyncio.to_thread(published_line_catalog, await self._load_feed())

    async def get_line_timetable(self, code: str, direction: str, date: str):
        return line_timetable(await self._get_day(date), code, direction)

    async def get_network(self) -> NetworkMap:
        async with self._lock:
            try:
                cached = await self._cache.get(f"gtfs-network-map:v2:{self.trip_prefix or 'GO'}")
                if cached is not None:
                    self._last_good = NetworkMap.model_validate(cached)
                    return self._last_good
            except Exception:
                pass
            try:
                result = await asyncio.to_thread(parse_gtfs_map, await self._load_feed())
                self._last_good = result
                try:
                    await self._cache.set(f"gtfs-network-map:v2:{self.trip_prefix or 'GO'}", result.model_dump(mode="json"), 86400)
                except Exception:
                    pass
                return result
            except Exception:
                if self._last_good:
                    return self._last_good.model_copy(update={"stale": True})
                raise
