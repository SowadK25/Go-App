from http.client import HTTPException
from typing import Any, List

DATE_MAX_CHARS = 8
TIME_MAX_CHARS = 4

def normalize_date(value: str) -> str:
    normalized = "".join(ch for ch in value if ch.isdigit())
    if len(normalized) != DATE_MAX_CHARS:
        raise HTTPException(status_code=422, detail="journey_date must be in YYYYMMDD or YYYY-MM-DD format")
    return normalized

def normalize_time(value: str) -> str:
    normalized = "".join(ch for ch in value if ch.isdigit())
    if len(normalized) != TIME_MAX_CHARS:
        raise HTTPException(status_code=422, detail="start_time must be in HHMM or HH:MM format")
    return normalized

def format_date(value: str) -> str:
        digits = "".join(ch for ch in str(value) if ch.isdigit())
        if len(digits) == DATE_MAX_CHARS:
            return f"{digits[0:4]}-{digits[4:6]}-{digits[6:8]}"
        return value

def as_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def trim_date_time(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""

    # Expected source format: "YYYY-MM-DD HH:MM:SS"
    if " " in text:
        text = text.split(" ")[-1]

    parts = text.split(":")
    if len(parts) >= 2:
        return f"{parts[0]}:{parts[1]}"
    return text

def clean_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def to_int_safe(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def delay_status_from_seconds(delay_seconds: int | None) -> str | None:
    if delay_seconds is None:
        return None
    if delay_seconds > 60:
        return "delayed"
    if delay_seconds < -60:
        return "early"
    return "on_time"
