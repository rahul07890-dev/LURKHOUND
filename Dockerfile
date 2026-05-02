FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for weasyprint
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangoft2-1.0-0 libgdk-pixbuf2.0-0 \
    libffi-dev libcairo2 && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY sample_data/ ./sample_data/

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV API_PORT=8000
ENV LOG_LEVEL=info
ENV SESSION_TTL_MINUTES=30
ENV CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
ENV LDAP_TLS_VERIFY=false

EXPOSE 8000

CMD ["python", "backend/main.py"]
