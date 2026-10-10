from fastapi import HTTPException
from datetime import datetime
import re
from zoneinfo import ZoneInfo
from typing import Any, List

DATE_MAX_CHARS = 8
TIME_MAX_CHARS = 4

def normalize_date(value: str) -> str:
    if not re.fullmatch(r"[0-9]{8}|[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        raise HTTPException(status_code=422, detail="date must be in YYYYMMDD or YYYY-MM-DD format")
    normalized = value.replace("-", "")
    try:
        datetime.strptime(normalized, "%Y%m%d")
    except ValueError:
        raise HTTPException(status_code=422, detail="date must be a valid calendar date") from None
    return normalized

def normalize_time(value: str) -> str:
    if not re.fullmatch(r"[0-9]{4}|[0-9]{2}:[0-9]{2}", value):
        raise HTTPException(status_code=422, detail="start_time must be in HHMM or HH:MM format")
    normalized = value.replace(":", "")
    if int(normalized[:2]) > 23 or int(normalized[2:]) > 59:
        raise HTTPException(status_code=422, detail="start_time must be a valid time between 00:00 and 23:59")
    return normalized


def toronto_today() -> str:
    return datetime.now(ZoneInfo("America/Toronto")).strftime("%Y%m%d")

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


def normalize_text(value: Any) -> str:
    cleaned = clean_str(value)
    if cleaned is None:
        return ""
    return " ".join(cleaned.lower().split())


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
