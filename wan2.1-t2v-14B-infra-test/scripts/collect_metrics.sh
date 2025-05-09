#!/bin/bash
# Script to collect system and GPU metrics periodically

# Ensure metrics directory exists
METRICS_DIR="/workspace/data/metrics"
mkdir -p "$METRICS_DIR"

# Log files
CPU_LOG="$METRICS_DIR/cpu_usage.csv"
MEM_LOG="$METRICS_DIR/memory_usage.csv"
DISK_LOG="$METRICS_DIR/disk_io.csv"
GPU_LOG="$METRICS_DIR/gpu_metrics.csv"
TIMESTAMP_FORMAT="+%Y-%m-%dT%H:%M:%S%z"

# Interval in seconds
INTERVAL=2

# Function to get current timestamp
get_timestamp() {
    date "$TIMESTAMP_FORMAT"
}

# Write headers if files don't exist
if [ ! -f "$CPU_LOG" ]; then
    echo "timestamp,%user,%nice,%system,%iowait,%steal,%idle" > "$CPU_LOG"
fi
if [ ! -f "$MEM_LOG" ]; then
    echo "timestamp,kbmemfree,kbavail,kbmemused,%memused,kbbuffers,kbcached,kbcommit,%commit,kbactive,kbinact,kbdirty" > "$MEM_LOG"
fi
if [ ! -f "$DISK_LOG" ]; then
    # Get main block device (heuristic: assumes nvme or sd*)
    DEV=$(lsblk -ndo NAME,TYPE | awk '$2=="disk" {print $1}' | head -n 1)
    if [ -z "$DEV" ]; then DEV="dev?"; fi # Fallback if no device found
    echo "timestamp,tps,rkB/s,wkB/s,dkB/s,areq-sz,aqu-sz,await,rareq-sz,wareq-sz,svctm,%util (device: $DEV)" > "$DISK_LOG"
else
    # Extract device name from existing header for subsequent runs
    DEV=$(head -n 1 "$DISK_LOG" | grep -oP '\(device: \K[^)]+')
fi
if [ ! -f "$GPU_LOG" ]; then
    echo "timestamp,gpu_index,utilization.gpu [%],memory.total [MiB],memory.used [MiB],memory.free [MiB],temperature.gpu [C],power.draw [W]" > "$GPU_LOG"
fi

echo "Starting metrics collection every $INTERVAL seconds..."
echo "CPU Log: $CPU_LOG"
echo "Memory Log: $MEM_LOG"
echo "Disk Log: $DISK_LOG (Device: $DEV)"
echo "GPU Log: $GPU_LOG"
echo "Press Ctrl+C to stop logging."

# Main collection loop
while true; do
    TIMESTAMP=$(get_timestamp)

    # Collect CPU stats (sar -u: CPU utilization)
    # Force C locale, set OFS, match Average:, print timestamp and fields $3-$8 explicitly
    LC_ALL=C sar -u 1 1 | awk -v ts="$TIMESTAMP" 'BEGIN{OFS=","} /^Average:/ { printf "%s,%s,%s,%s,%s,%s,%s\n", ts, $3, $4, $5, $6, $7, $8 }' >> "$CPU_LOG"

    # Collect Memory stats (sar -r: Memory utilization)
    # Force C locale, set OFS, remove Average: field, print timestamp and rest
    LC_ALL=C sar -r 1 1 | awk -v ts="$TIMESTAMP" 'BEGIN{OFS=","} /^Average:/ { $1=""; printf "%s%s\n", ts, $0 }' >> "$MEM_LOG"

    # Collect Disk I/O stats (sar -d: Disk activity for specific device)
    # Force C locale, set OFS, remove Average: and device fields, print timestamp and rest
    if [ -b "/dev/$DEV" ]; then
        LC_ALL=C sar -d -p 1 1 | awk -v ts="$TIMESTAMP" -v dev="$DEV" 'BEGIN{OFS=","} /^Average:/ && $2==dev { $1=""; $2=""; printf "%s%s\n", ts, $0 }' >> "$DISK_LOG"
    else
        # Log placeholder if device not found/valid
        echo "$TIMESTAMP,,,,,,,,,,," >> "$DISK_LOG"
    fi

    # Collect GPU stats (nvidia-smi)
    # Query specific metrics, format as CSV, handle multiple GPUs
    # Enhanced to include all required metrics
    nvidia-smi --query-gpu=index,utilization.gpu,memory.total,memory.used,memory.free,temperature.gpu,power.draw --format=csv,noheader,nounits | awk -v ts="$TIMESTAMP" 'BEGIN{OFS=","} {printf "%s,%s\n", ts, $0}' >> "$GPU_LOG"

    sleep "$INTERVAL"
done

# Trap SIGINT and SIGTERM to exit gracefully (optional, as this will likely be killed)
# trap "echo 'Metrics collection stopped.'; exit 0" SIGINT SIGTERM 