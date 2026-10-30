FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY app.py .
COPY multi_model.py .

# Copy ONNX model files (yolo_best.onnx, mobilenetv2_plant.onnx, efficientnet_plant.onnx, class_names.json)
COPY onnx_models_data/ ./onnx_models_data/

# Expose port (Render sets PORT env var automatically)
EXPOSE 8000

# Start FastAPI server
CMD uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}
