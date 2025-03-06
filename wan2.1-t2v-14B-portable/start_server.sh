#!/bin/bash

# Activate virtual environment
source /workspace/venv/bin/activate

# Set CUDA environment variables if not already set
export PATH="/usr/local/cuda/bin:${PATH}"
export LD_LIBRARY_PATH="/usr/local/cuda/lib64:${LD_LIBRARY_PATH}"

echo "=== Starting Gradio server ==="
python /workspace/Wan2.1/gradio/t2v_14B_singleGPU.py --ckpt_dir /workspace/Wan2.1/Wan2.1-T2V-14B
