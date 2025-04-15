#!/bin/bash

echo "=== Starting model weights download ==="

# Define the target directory (ensure consistency with Dockerfile)
WEIGHTS_DIR="/workspace/Wan2.1/Wan2.1-T2V-14B"
MODEL_NAME="Wan-AI/Wan2.1-T2V-14B"
# Define the explicit path to the CLI tool within the venv
HUGGINGFACE_CLI="/workspace/venv/bin/huggingface-cli"

# Download the Hugging Face model weights using the explicit path
# Use --local-dir-use-symlinks False for Docker environments
${HUGGINGFACE_CLI} download ${MODEL_NAME} --local-dir ${WEIGHTS_DIR}

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