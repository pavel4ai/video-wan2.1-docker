#!/bin/bash

echo "=== Starting model weights download ==="

MODEL_NAME="Wan-AI/Wan2.1-T2V-14B"
MAX_RETRIES=5
RETRY_DELAY=10  # seconds

for ((i=1; i<=MAX_RETRIES; i++)); do
    echo "Attempt $i of $MAX_RETRIES..."
    huggingface-cli download "$MODEL_NAME" --resume-download
    if [ $? -eq 0 ]; then
        echo "Download completed successfully."
    else
        echo "Download failed. Retrying in $RETRY_DELAY seconds..."
        sleep $RETRY_DELAY
    fi
done

echo "Download failed after $MAX_RETRIES attempts."
exit 1


echo "=== Executing Test Suite ==="
# Execute the default command (start_test_suite.sh)
exec "$@"