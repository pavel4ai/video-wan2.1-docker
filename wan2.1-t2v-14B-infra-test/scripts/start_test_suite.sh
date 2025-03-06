#!/bin/bash

# Activate Python virtual environment
source /workspace/venv/bin/activate

# Start the microservices router
node /workspace/scripts/router.js &

# Start Prometheus
/workspace/prometheus/prometheus --config.file=/workspace/config/prometheus.yml &

# Start system metrics collector
python /workspace/scripts/system_metrics.py &

# Start storage performance test during model download
python /workspace/scripts/storage_test.py &

# Download model weights
huggingface-cli download Wan-AI/Wan2.1-T2V-14B --local-dir /workspace/Wan2.1/Wan2.1-T2V-14B

# Start video generation tests
python /workspace/scripts/video_generation_test.py

# Keep container running
tail -f /dev/null
