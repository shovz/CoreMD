FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/
COPY scripts/ scripts/
COPY static/ static/

HEALTHCHECK CMD curl -f http://localhost:8000/health || exit 1
CMD ["gunicorn", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "app.main:app", "--bind", "0.0.0.0:8000"]
