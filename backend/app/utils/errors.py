import httpx
from fastapi import HTTPException


def upstream_error(exc: httpx.HTTPStatusError) -> HTTPException:
    # Never expose the upstream URL: it includes the Metrolinx API key.
    status = exc.response.status_code
    if status == 429:
        return HTTPException(status_code=503, detail="Transit provider is busy. Please try again later.")
    if status in {400, 404, 422}:
        return HTTPException(status_code=status, detail="Transit information is unavailable for this request.")
    return HTTPException(status_code=502, detail="Transit provider could not complete the request.")
