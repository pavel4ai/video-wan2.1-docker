#!/bin/bash

echo "=== Starting model weights download ==="

# Define the target directory (ensure consistency with Dockerfile)
WEIGHTS_DIR="/workspace/Wan2.1/Wan2.1-T2V-14B"
MODEL_NAME="Wan-AI/Wan2.1-T2V-14B"

# Download the Hugging Face model weights
# Use --local-dir-use-symlinks False for Docker environments
huggingface-cli download ${MODEL_NAME} --local-dir ${WEIGHTS_DIR}

# Verify the download
if [ $? -eq 0 ]; then
    echo "=== Model weights downloaded successfully ==="
else
    echo "=== ERROR: Failed to download model weights ==="
    exit 1 # Exit if download fails
fi

echo "=== Handing over execution to CMD: [$@] ==="
# Execute the command passed as arguments (the CMD from Dockerfile)
exec "$@"