import csv
import io
import math
import re
import zipfile
from collections import defaultdict

from app.models.network_map import MapLine, MapStop, NetworkMap


def simplify_shape(points: list[tuple[float, float]], tolerance: float = 25) -> list[tuple[float, float]]:
    """Douglas-Peucker simplification in local metres; retain endpoints and turns."""
    if len(points) <= 2:
        return points
    keep = {0, len(points) - 1}
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        ax, ay = points[start][1] * 85000, points[start][0] * 111000
        bx, by = points[end][1] * 85000, points[end][0] * 111000
        dx, dy = bx - ax, by - ay
        length = dx * dx + dy * dy
        farthest, distance = start, tolerance * tolerance
        for index in range(start + 1, end):
            px, py = points[index][1] * 85000, points[index][0] * 111000
            fraction = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / length)) if length else 0
            squared = (px - ax - fraction * dx) ** 2 + (py - ay - fraction * dy) ** 2
            if squared > distance:
                farthest, distance = index, squared
        if farthest != start:
            keep.add(farthest)
            stack.extend([(start, farthest), (farthest, end)])
    return [points[index] for index in sorted(keep)]


def parse_gtfs_map(payload: bytes) -> NetworkMap:
    """Read published routes, stop membership and shapes without extracting ZIP files."""
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        if sum(item.file_size for item in archive.infolist()) > 250_000_000:
            raise ValueError("GTFS archive too large")

        def rows(name):
            with archive.open(name) as file:
                yield from csv.DictReader(io.TextIOWrapper(file, encoding="utf-8-sig"))

        route_codes = {}
        lines = {}
        for row in rows("routes.txt"):
            code = row["route_short_name"].strip().upper()
            if code == "GT":
                code = "KI"
            if not code or row["route_type"] not in {"2", "3"}:
                continue
            route_codes[row["route_id"]] = code
            color = row.get("route_color", "")
            lines.setdefault(code, MapLine(code=code, name=row["route_long_name"],
                color=f"#{color}" if re.fullmatch(r"[0-9a-fA-F]{6}", color) else "#4A7C34",
                vehicle_type="Train" if row["route_type"] == "2" else "Bus"))
        trip_lines = {}
        shape_lines = defaultdict(set)
        for row in rows("trips.txt"):
            code = route_codes.get(row["route_id"])
            if code:
                trip_lines[row["trip_id"]] = code
                if row.get("shape_id"):
                    shape_lines[row["shape_id"]].add(code)
        stop_lines = defaultdict(set)
        for row in rows("stop_times.txt"):
            code = trip_lines.get(row["trip_id"])
            if code:
                stop_lines[row["stop_id"]].add(code)
        stops = []
        for row in rows("stops.txt"):
            latitude, longitude = float(row["stop_lat"]), float(row["stop_lon"])
            if not (math.isfinite(latitude) and math.isfinite(longitude) and
                    -90 <= latitude <= 90 and -180 <= longitude <= 180):
                continue
            codes = sorted(stop_lines[row["stop_id"]])
            train = any(lines[code].vehicle_type == "Train" for code in codes)
            stops.append(MapStop(id=row["stop_id"], name=row["stop_name"],
                type="Train Station" if train else "Bus Stop", latitude=latitude, longitude=longitude,
                line_codes=codes))
        shapes = defaultdict(list)
        for row in rows("shapes.txt"):
            if row["shape_id"] in shape_lines:
                latitude, longitude = float(row["shape_pt_lat"]), float(row["shape_pt_lon"])
                if math.isfinite(latitude) and math.isfinite(longitude) and -90 <= latitude <= 90 and -180 <= longitude <= 180:
                    shapes[row["shape_id"]].append((int(row["shape_pt_sequence"]), (round(latitude, 6), round(longitude, 6))))
        for shape_id, points in shapes.items():
            simplified = simplify_shape([point for _, point in sorted(points)])
            if len(simplified) >= 2:
                for code in shape_lines[shape_id]:
                    lines[code].shapes.append([list(point) for point in simplified])
        info = next(rows("feed_info.txt"), {}) if "feed_info.txt" in archive.namelist() else {}
        if not stops or not lines:
            raise ValueError("GTFS contains no network")
        return NetworkMap(stops=sorted(stops, key=lambda stop: stop.name), lines=sorted(lines.values(), key=lambda line: line.code),
            feed_version=info.get("feed_version"), valid_from=info.get("feed_start_date"), valid_until=info.get("feed_end_date"))
