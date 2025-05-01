#!/bin/bash
set -x  # Echo every command as it runs
#exec > >(tee -a /workspace/data/logs/startup_debug.log) 2>&1
#echo "=== STARTUP DEBUG LOG ==="
#date
#ps aux
#env

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
    local retries=5
    local wait=2
    
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

echo "=== Testing NGINX configuration ==="
nginx -t -c /workspace/config/nginx.conf
if [ $? -ne 0 ]; then
    echo "Error: NGINX configuration test failed. Check logs."
    exit 1
fi

# Start the router and wait for it to be ready
cd /workspace/scripts
node router.js > /workspace/data/logs/router.log 2>&1 &
wait_for_service localhost 8083 "Router App" || exit 1 # Changed port from 8082 to 8083

# Start metrics collection in the background
echo "=== Starting Metrics Collection ==="
/workspace/scripts/collect_metrics.sh > /workspace/data/logs/metrics_script.log 2>&1 &
METRICS_PID=$!
echo "Metrics collection started (PID: $METRICS_PID)"
sleep 2 # Give it a moment to start
echo "Checking if metrics process is running..."
ps aux | grep collect_metrics.sh | grep -v grep || echo "Metrics process not found!"

# Start NGINX (config already checked)
echo "=== Starting NGINX ==="
# Kill any running NGINX process (safe in container)
if pgrep nginx > /dev/null; then
    echo "Killing existing NGINX process..."
    pkill nginx
fi
if [ -f "/workspace/data/logs/nginx.pid" ]; then
    rm -f /workspace/data/logs/nginx.pid
fi
nginx -c /workspace/config/nginx.conf
wait_for_service localhost 8888 "NGINX" || exit 1 # Exit if NGINX fails

# Start iPerf3 server in the background - REMOVED
# echo "=== Starting iPerf3 Server (Background) ==="
# iperf3 -s -p 5201 > /workspace/data/logs/iperf3_server.log 2>&1 &
# IPERF_PID=$!
# echo "iPerf3 server started on port 5201 (PID: $IPERF_PID)"
# # Add a small delay or check? For now, assume it starts quickly.

# Only proceed if all services started
if [ "$ALL_SERVICES_STARTED" = true ]; then
    echo "=== All services started successfully ===" 
    echo "Web UI & API available at http://localhost:8888/"
    echo "Video browsing available at http://localhost:8888/videos/"
    # echo "Prometheus available at http://localhost:8888/prometheus/"
    # echo "Grafana available at http://localhost:8888/grafana/"

    # Run the video generation test script in the background
    echo "=== Starting Video Generation Test in Background ==="
    python3 /workspace/scripts/video_generation_test.py > /workspace/data/logs/video_generation.log 2>&1 &
    VIDEO_TEST_PID=$!
    echo "Video generation test started (PID: $VIDEO_TEST_PID)"

    # Removed tail -f command
    # Instead, run nginx in the foreground to keep the container alive
    echo "=== Starting Nginx in Foreground ==="
    nginx -g 'daemon off;' -c /workspace/config/nginx.conf

    # Original logic that waited for video test and then exited is removed
    # wait $VIDEO_TEST_PID
    # TEST_EXIT_CODE=$?
    # echo "Video generation test finished with exit code: $TEST_EXIT_CODE"
    # echo "Cleaning up background processes..."
    # kill $TAIL_PID
    # kill $METRICS_PID
    # kill $VIDEO_TEST_PID
    # wait
    # echo "Exiting container."
    # exit $TEST_EXIT_CODE
else
    echo "!!! Critical service failed to start. Exiting. Check logs above and in /workspace/data/logs/ for details. !!!"
    exit 1
fi
