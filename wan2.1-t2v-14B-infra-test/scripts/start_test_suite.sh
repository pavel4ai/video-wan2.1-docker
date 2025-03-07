#!/bin/bash

# Function to wait for a service to be ready
wait_for_service() {
    local host=$1
    local port=$2
    local service=$3
    local retries=30
    local wait=2
    
    echo "Waiting for $service to be ready..."
    while ! nc -z $host $port && [ $retries -gt 0 ]; do
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

# Create necessary directories
mkdir -p /workspace/data/videos /workspace/data/metrics /workspace/data/logs

# Start Prometheus with the correct port
cd /workspace/prometheus
./prometheus --config.file=/workspace/config/prometheus.yml --web.listen-address=:9091 &
wait_for_service localhost 9091 "Prometheus"

# Start Node Exporter
cd /workspace/node_exporter
./node_exporter &
wait_for_service localhost 9100 "Node Exporter"

# Start Grafana
service grafana-server start
wait_for_service localhost 3000 "Grafana"

# Start NGINX
service nginx start
wait_for_service localhost 8081 "NGINX"

# Start the router
cd /workspace/scripts
node router.js &
wait_for_service localhost 8080 "Web UI"

echo "=== All services started successfully ==="
echo "Web UI available at http://localhost:8080"
echo "Video streaming available at http://localhost:8081"
echo "Metrics available at http://localhost:9091"
echo "Grafana available at http://localhost:3000"

# Keep container running and show logs
tail -f /workspace/data/logs/* /var/log/nginx/error.log
