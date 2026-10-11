import asyncio
import csv
import io
import os
from pathlib import Path
import sys
import unittest
import zipfile
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

os.environ["CACHE_BACKEND"] = "memory"
os.environ["METROLINX_API_KEY"] = "test-key"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.clients.gtfs import GtfsClient
from app.routes import network_map
from app.utils.gtfs_map import parse_gtfs_map, simplify_shape


def sample_gtfs():
    files = {
        "routes.txt": [["route_id", "route_short_name", "route_long_name", "route_type", "route_color"],
                       ["rail", "GT", "Kitchener", "2", "00853E"], ["bus", "30", "Kitchener bus", "3", "bad"]],
        "trips.txt": [["trip_id", "route_id", "shape_id"], ["r1", "rail", "rail-shape"], ["r2", "rail", "rail-shape"], ["b1", "bus", "bus-shape"]],
        "stops.txt": [["stop_id", "stop_name", "stop_lat", "stop_lon"], ["KI", "Kitchener GO", "43.45", "-80.49"],
                      ["UN", "Union Station GO", "43.64", "-79.38"], ["00958", "Bus Stop", "43.6", "-79.5"], ["bad", "Invalid", "nan", "0"]],
        "stop_times.txt": [["trip_id", "stop_id"], ["r1", "KI"], ["r2", "UN"], ["b1", "00958"], ["b1", "KI"]],
        "shapes.txt": [["shape_id", "shape_pt_sequence", "shape_pt_lat", "shape_pt_lon"],
                       ["rail-shape", "3", "43.64", "-79.38"], ["rail-shape", "1", "43.45", "-80.49"], ["rail-shape", "2", "43.5", "-80.1"],
                       ["bus-shape", "1", "43.45", "-80.49"], ["bus-shape", "2", "43.6", "-79.5"]],
        "feed_info.txt": [["feed_version", "feed_start_date", "feed_end_date"], ["test", "20261005", "20261127"]],
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for name, rows in files.items():
            text = io.StringIO()
            csv.writer(text).writerows(rows)
            archive.writestr(name, text.getvalue())
    return output.getvalue()


class NetworkMapTests(unittest.TestCase):
    def test_parses_station_membership_coordinates_and_ordered_shapes(self):
        result = parse_gtfs_map(sample_gtfs())
        self.assertEqual(len(result.stops), 3)
        station = next(stop for stop in result.stops if stop.id == "KI")
        self.assertEqual(station.line_codes, ["30", "KI"])
        self.assertEqual(station.type, "Train Station")
        rail = next(line for line in result.lines if line.code == "KI")
        self.assertEqual(len(rail.shapes), 1)
        self.assertEqual(rail.shapes[0][0], [43.45, -80.49])
        self.assertEqual(rail.shapes[0][-1], [43.64, -79.38])
        self.assertEqual(next(line for line in result.lines if line.code == "30").color, "#4A7C34")
        self.assertEqual(result.feed_version, "test")
        self.assertIn("00958", [stop.id for stop in result.stops])

    def test_shape_simplification_retains_turns_and_endpoints(self):
        points = [(43.0, -79.0), (43.000001, -79.0), (43.01, -79.0), (43.01, -79.01)]
        simplified = simplify_shape(points)
        self.assertEqual(simplified, [points[0], points[2], points[3]])

    def test_upstream_failures_are_safe_and_typed(self):
        with patch.object(network_map.client, "get_network", new_callable=AsyncMock, side_effect=ValueError("secret-url")):
            response = TestClient(app).get("/api/map/network")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("secret-url", response.text)


class GtfsCacheTests(unittest.IsolatedAsyncioTestCase):
    async def test_concurrent_requests_download_once_and_keep_last_good_on_failure(self):
        client = GtfsClient()
        cache = {}
        async def get(key): return cache.get(key)
        async def set_value(key, value, ttl):
            self.assertEqual(ttl, 86400)
            cache[key] = value
        client._cache = type("Cache", (), {"get": staticmethod(get), "set": staticmethod(set_value)})()
        calls = []
        class Http:
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            @asynccontextmanager
            async def stream(self, method, url):
                calls.append(url)
                if len(calls) > 1: raise httpx.ReadTimeout("test")
                await asyncio.sleep(0)
                yield self
            def raise_for_status(self): pass
            async def aiter_bytes(self): yield sample_gtfs()
        with patch("app.clients.gtfs.httpx.AsyncClient", return_value=Http()):
            first, second = await asyncio.gather(client.get_network(), client.get_network())
            self.assertEqual(len(calls), 1)
            self.assertEqual(first.stops, second.stops)
            cache.clear()
            stale = await client.get_network()
        self.assertTrue(stale.stale)
        self.assertEqual(stale.stops, first.stops)


if __name__ == "__main__":
    unittest.main()
