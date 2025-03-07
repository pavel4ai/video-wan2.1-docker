#!/bin/bash

# Function to wait for a service to be ready
wait_for_service() {
    local host=$1
    local port=$2
    local service=$3
    local retries=5
    local wait=2
    
    echo "Waiting for $service to be ready..."
    while ! (echo > /dev/tcp/$host/$port) >/dev/null 2>&1 && [ $retries -gt 0 ]; do
        retries=$((retries-1))
        echo "Waiting for $service... $retries attempts left"
        sleep $wait
    done
    
    if [ $retries -eq 0 ]; then
        echo "Error: $service failed to start"
        return 1
    else
        echo "$service is ready"
        return 0
    fi
}

# Create necessary directories and set permissions
echo "=== Setting up directories and logs ==="
mkdir -p /workspace/data/videos /workspace/data/metrics /workspace/data/logs
touch /workspace/data/logs/app.log
chmod -R 755 /workspace/data

# Start Prometheus with the correct port
cd /workspace/prometheus
./prometheus --config.file=/workspace/config/prometheus.yml --web.listen-address=:9091 > /workspace/data/logs/prometheus.log 2>&1 &
wait_for_service localhost 9091 "Prometheus"

# Start Node Exporter
cd /workspace/node_exporter
./node_exporter > /workspace/data/logs/node_exporter.log 2>&1 &
wait_for_service localhost 9100 "Node Exporter"

# Start the router
cd /workspace/scripts
node router.js > /workspace/data/logs/router.log 2>&1 &
wait_for_service localhost 8080 "Web UI"

# Start NGINX
echo "=== Starting NGINX ==="
if [ -f "/workspace/data/logs/nginx.pid" ]; then
    rm -f /workspace/data/logs/nginx.pid
fi
nginx -c /etc/nginx/nginx.conf > /workspace/data/logs/nginx.log 2>&1
wait_for_service localhost 8081 "NGINX"

echo "=== All services started successfully ==="
echo "Web UI available at http://localhost:8080"
echo "Video streaming available at http://localhost:8081"
echo "Metrics available at http://localhost:9091"

# Keep container running and show logs
echo "=== Tailing application logs ==="
tail -f /workspace/data/logs/*.log
