FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    CACHE_BACKEND=memory

WORKDIR /app

COPY requirements.txt ./
RUN python -m pip install -r requirements.txt \
    && useradd --create-home --uid 10001 appuser

COPY app ./app
COPY serve.py ./

USER appuser

CMD ["python", "serve.py"]
