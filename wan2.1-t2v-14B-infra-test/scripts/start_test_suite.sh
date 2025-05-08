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
chmod +x /workspace/scripts/collect_metrics.sh # Ensure executable
/workspace/scripts/collect_metrics.sh > /workspace/data/logs/metrics_script.log 2>&1 &
METRICS_PID=$!
echo "Metrics collection started (PID: $METRICS_PID)"
sleep 2 # Give it a moment to start and maybe write to log
echo "Checking if metrics process is running..."
ps aux | grep collect_metrics.sh | grep -v grep || echo "Metrics process not found!"
echo "--- Start of metrics_script.log --- "
head -n 10 /workspace/data/logs/metrics_script.log || echo "Could not read metrics_script.log"
echo "--- End of metrics_script.log --- "

# Start NGINX (config already checked)
echo "=== Preparing for NGINX Start ==="
# Kill any running NGINX process (safe in container)
if pgrep nginx > /dev/null; then
    echo "Killing existing NGINX process..."
    pkill nginx
    sleep 1 # Give it a moment to die
fi
if [ -f "/workspace/data/logs/nginx.pid" ]; then
    echo "Removing old NGINX pid file..."
    rm -f /workspace/data/logs/nginx.pid
fi

# Only proceed to start video test if other services started
# The final nginx command will run regardless, keeping the container alive
if [ "$ALL_SERVICES_STARTED" = true ]; then
    echo "=== Previous services started successfully, starting video test ===" 
    
    # Run the video generation test script in the background
    echo "=== Starting Video Generation Test in Background ==="
    python3 /workspace/scripts/video_generation_test.py > /workspace/data/logs/video_generation.log 2>&1 &
    VIDEO_TEST_PID=$!
    echo "Video generation test started (PID: $VIDEO_TEST_PID)"
else
    echo "!!! Critical background service (Router or Metrics) failed to start. Video test will not run. Starting Nginx anyway. Check logs. !!!"
    # We still proceed to start Nginx below to keep the container potentially accessible for debugging
fi

# Start Nginx in the foreground - this MUST be the last command. DO NOT CHANGE IT ANYMORE
echo "=== Starting Nginx in Foreground to keep container running ==="
nginx -c /workspace/config/nginx.conf

# Tail the video generation log in the background
tail -f /workspace/data/logs/video_generation.log &
TAIL_PID=$!
echo "Log tailing started (PID: $TAIL_PID)"

