#!/bin/bash

echo "=== Starting model weights download ==="

# --- Temporarily Commented Out for Faster Testing ---
# # Download the Hugging Face model weights
# huggingface-cli download Wan-AI/Wan2.1-T2V-14B --local-dir /workspace/Wan2.1/Wan2.1-T2V-14B
#
# # Verify the download
# if [ $? -eq 0 ]; then
#     echo "=== Model weights downloaded successfully (SKIPPED CHECK) ==="
# else
#     echo "=== Failed to download model weights (SKIPPED CHECK - Error Ignored) ==="
#     # exit 1 # Do not exit on simulated failure during testing
# fi
echo "=== Model download SKIPPED for faster testing ==="
# --- End Temporary Comment Out ---


echo "=== Executing Test Suite ==="
# Execute the default command (start_test_suite.sh)
exec "$@"