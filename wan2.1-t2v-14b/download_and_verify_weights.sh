#!/bin/bash

# Download the Hugging Face model weights
huggingface-cli download Wan-AI/Wan2.1-T2V-14B --local-dir /workspace/Wan2.1/Wan2.1-T2V-14B

# Verify the download (you can add specific verification steps here)
if [ $? -eq 0 ]; then
    echo "Model weights downloaded successfully."
else
    echo "Failed to download model weights."
    exit 1
fi

# Execute the default command
exec "$@"