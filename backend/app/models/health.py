from typing import Literal
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    cache_backend: Literal["memory", "redis"]
    cache: Literal["ok", "down"]
