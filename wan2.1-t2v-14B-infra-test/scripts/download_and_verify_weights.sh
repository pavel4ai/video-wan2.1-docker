#!/bin/bash

echo "=== Starting model weights download ==="

MODEL_NAME="Wan-AI/Wan2.1-T2V-14B"
MAX_RETRIES=5
RETRY_DELAY=10  # seconds
DOWNLOAD_SUCCESS=false # Flag to track success

for ((i=1; i<=MAX_RETRIES; i++)); do
    echo "Attempt $i of $MAX_RETRIES..."
    huggingface-cli download "$MODEL_NAME" --resume-download
    if [ $? -eq 0 ]; then
        echo "Download completed successfully."
        DOWNLOAD_SUCCESS=true
        break # Exit the loop on success
    else
        echo "Download failed on attempt $i. Retrying in $RETRY_DELAY seconds..."
        sleep $RETRY_DELAY
    fi
done

# Check if download ultimately failed
if [ "$DOWNLOAD_SUCCESS" = false ]; then
    echo "Download failed after $MAX_RETRIES attempts."
    exit 1
fi

# Proceed only if download was successful

echo "=== Executing Test Suite ==="
# Execute the default command (start_test_suite.sh)
exec "$@"