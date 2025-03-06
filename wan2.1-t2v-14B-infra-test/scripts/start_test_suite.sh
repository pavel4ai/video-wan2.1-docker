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

# Start video generation tests
python /workspace/scripts/video_generation_test.py

# Keep container running
tail -f /dev/null
