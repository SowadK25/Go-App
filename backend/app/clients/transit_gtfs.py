"""Combine GO and UP feeds while retaining each provider's service calendar."""
import asyncio
from collections import defaultdict

from app.clients.gtfs import GtfsClient
from app.models.network_map import NetworkMap
from app.utils.gtfs_departures import StationDayIndex, ScheduleDateUnavailable
from app.utils.gtfs_schedules import timetable_lines, line_timetable

UP_STOPS = {"UN", "BL", "MD", "WE", "PA"}
up_gtfs = GtfsClient(
    "https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/UP-GTFS.zip",
    trip_prefix="UP-",
)


class TransitGtfsClient:
    def __init__(self):
        self.go = GtfsClient()
        self.up = up_gtfs

    async def get_network(self):
        go, up = await asyncio.gather(self.go.get_network(), self.up.get_network())
        stops = {stop.id: stop.model_copy(deep=True) for stop in go.stops}
        for stop in up.stops:
            if stop.id in stops:
                stops[stop.id].line_codes = sorted(set(stops[stop.id].line_codes + stop.line_codes))
                stops[stop.id].type = "Train Station"
            else:
                stops[stop.id] = stop
        return NetworkMap(source="Metrolinx GO Transit and UP Express GTFS",
            feed_version=f"GO:{go.feed_version};UP:{up.feed_version}",
            valid_from=max(filter(None, [go.valid_from, up.valid_from]), default=None),
            valid_until=min(filter(None, [go.valid_until, up.valid_until]), default=None),
            stale=go.stale or up.stale, stops=list(stops.values()), lines=go.lines + up.lines)

    async def _get_day(self, date):
        results = await asyncio.gather(self.go._get_day(date), self.up._get_day(date), return_exceptions=True)
        names, visits = {}, defaultdict(list)
        for result in results:
            if isinstance(result, ScheduleDateUnavailable):
                continue
            if isinstance(result, BaseException):
                raise result
            for code, name in result.names.items():
                names.setdefault(code, name)
            for code, entries in result.visits.items():
                visits[code].extend(entries)
        if not names:
            raise ScheduleDateUnavailable()
        return StationDayIndex(date, names, visits)

    async def get_station_departures(self, code, date):
        return (await self._get_day(date)).board(code)

    async def get_timetable_lines(self, date):
        return timetable_lines(await self._get_day(date))

    async def get_line_catalog(self):
        go, up = await asyncio.gather(self.go.get_line_catalog(), self.up.get_line_catalog())
        return go + up

    async def get_line_timetable(self, code, direction, date):
        provider = self.up if code.upper() == "UP" else self.go
        return line_timetable(await provider._get_day(date), code, direction)
