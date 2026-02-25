from http.client import HTTPException

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