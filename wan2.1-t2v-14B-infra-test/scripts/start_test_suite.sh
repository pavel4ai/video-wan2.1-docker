#!/bin/bash

echo "--- VERIFYING FILE CONTENTS --- START ---"
echo "router.js listen line:"
grep 'app.listen' /workspace/scripts/router.js
echo "nginx.conf mp4 line:"
grep 'mp4;' /workspace/config/nginx.conf || echo "nginx.conf: mp4 directive not found (or commented out)"
echo "start_test_suite.sh Router App wait line:"
grep 'wait_for_service.*Router App' /workspace/scripts/start_test_suite.sh
echo "--- VERIFYING FILE CONTENTS --- END ---"

# Flag to track startup success
ALL_SERVICES_STARTED=true

# Function to wait for a service to be ready
wait_for_service() {
    local host=$1
    local port=$2
    local service=$3
    echo "--> Checking service '$service' readiness on $host:$port..."
    local retries=5
    local wait=2
    
    echo "Waiting for $service to be ready..."
    while ! (echo > /dev/tcp/$host/$port) >/dev/null 2>&1 && [ $retries -gt 0 ]; do
        retries=$((retries-1))
        echo "Waiting for $service... $retries attempts left"
        sleep $wait
    done
    
    if [ $retries -eq 0 ]; then
        echo "Error: $service failed to start on $host:$port"
        ALL_SERVICES_STARTED=false # Set flag to false on failure
        return 1 # Return error code
    else
        echo "$service is ready"
        return 0 # Return success code
    fi
}

# Create necessary directories and set permissions
echo "=== Setting up directories and logs ==="
mkdir -p /workspace/data/videos /workspace/data/metrics /workspace/data/logs
touch /workspace/data/logs/app.log
chmod -R 755 /workspace/data

echo "=== Checking NGINX configuration ==="

nginx -t -c /workspace/config/nginx.conf
nginx -c /workspace/config/nginx.conf

if [ $? -ne 0 ]; then
    echo "Error: NGINX configuration test failed. Check logs." # Shortened message
    exit 1
fi

# Start Prometheus with the correct port
cd /workspace/prometheus
./prometheus --config.file=/workspace/config/prometheus.yml --web.listen-address=:9091 > /workspace/data/logs/prometheus.log 2>&1 &
sleep 1 # Add a small delay before checking Prometheus port
wait_for_service localhost 9091 "Prometheus" || exit 1 # Exit if Prometheus fails

# Start Node Exporter
cd /workspace/node_exporter
./node_exporter > /workspace/data/logs/node_exporter.log 2>&1 &
wait_for_service localhost 9100 "Node Exporter" || exit 1 # Exit if Node Exporter fails

# Start the router
cd /workspace/scripts
node router.js > /workspace/data/logs/router.log 2>&1 &
wait_for_service localhost 8083 "Router App" || exit 1 # Changed port from 8082 to 8083

# Start Grafana
echo "=== Starting Grafana ==="
mkdir -p /workspace/grafana/data /workspace/grafana/logs /workspace/grafana/plugins /workspace/grafana/provisioning
grafana-server \
  cfg:default.paths.data=/workspace/grafana/data \
  cfg:default.paths.logs=/workspace/grafana/logs \
  cfg:default.paths.plugins=/workspace/grafana/plugins \
  cfg:default.paths.provisioning=/workspace/grafana/provisioning \
  cfg:default.server.http_port=3000 > /workspace/grafana/logs/grafana.log 2>&1 &
if ! wait_for_service localhost 3000 "Grafana"; then
    echo "Warning: Grafana failed to start. The rest of the test suite will continue."
fi
        
# Start NGINX (config already checked)
echo "=== Starting NGINX ==="
if [ -f "/workspace/data/logs/nginx.pid" ]; then
    rm -f /workspace/data/logs/nginx.pid
fi
nginx -c /workspace/config/nginx.conf
wait_for_service localhost 8080 "NGINX" || exit 1 # Exit if NGINX fails

# Only proceed if all services started
if [ "$ALL_SERVICES_STARTED" = true ]; then
    echo "=== All services started successfully ===" 
    echo "Web UI & API available at http://localhost:8080/"
    echo "Video browsing available at http://localhost:8080/videos/"
    echo "Prometheus available at http://localhost:8080/prometheus/"
    echo "Grafana available at http://localhost:8080/grafana/"

    # Keep container running and show logs
    echo "=== Tailing application logs ==="
    tail -f /workspace/data/logs/*.log
else
    echo "!!! Critical service failed to start. Exiting. Check logs above and in /workspace/data/logs/ for details. !!!"
    exit 1
fi
