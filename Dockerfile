FROM python:3.11-slim

# Install system dependencies required for WeasyPrint & Marathi font rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    libffi-dev \
    libjpeg-dev \
    libopenjp2-7 \
    fonts-dejavu \
    fonts-lohit-deva \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency definition from backend directory
COPY backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source code
COPY backend/ .

# Render exposes PORT dynamically (defaults to 10000 or 8000)
ENV PORT=8000
EXPOSE ${PORT}

# Run FastAPI with dynamic port binding for Render
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
