from pydantic import BaseModel, Field


class MapStop(BaseModel):
    id: str
    name: str
    type: str
    latitude: float
    longitude: float
    line_codes: list[str] = Field(default_factory=list)


class MapLine(BaseModel):
    code: str
    name: str
    color: str
    vehicle_type: str
    shapes: list[list[list[float]]] = Field(default_factory=list)


class NetworkMap(BaseModel):
    source: str = "Metrolinx GO Transit GTFS"
    feed_version: str | None = None
    valid_from: str | None = None
    valid_until: str | None = None
    stale: bool = False
    stops: list[MapStop]
    lines: list[MapLine]
