import httpx

from app.utils.cache import get_cache_backend


class GoSchedulesClient:
    """Public timetable used by the official GO Transit schedules page."""

    BASE_URL = "https://api.metrolinx.com/external/go/schedules/en/timetable/all"

    def __init__(self):
        self._cache = get_cache_backend()

    async def get_timetable(self, from_stop: str, to_stop: str, date: str):
        key = f"official-timetable:{from_stop}:{to_stop}:{date}"
        try:
            cached = await self._cache.get(key)
            if cached is not None:
                return cached
        except Exception:
            pass

        # Leave time for the Open Data fallback within the mobile's 15s timeout.
        async with httpx.AsyncClient(timeout=4) as client:
            response = await client.get(self.BASE_URL, params={
                "fromStop": from_stop,
                "toStop": to_stop,
                "date": f"{date[:4]}-{date[4:6]}-{date[6:]}",
            })
            response.raise_for_status()
            data = response.json()

        try:
            await self._cache.set(key, data, 300)
        except Exception:
            pass
        return data
