#!/bin/bash

echo "=== Starting Gradio server ==="
echo "Environment: $VIRTUAL_ENV"
echo "Python version: $(python --version)"
echo "CUDA path: $PATH"
echo "LD_LIBRARY_PATH: $LD_LIBRARY_PATH"

python /home/centml/workspace/Wan2.1/gradio/t2v_14B_singleGPU.py --ckpt_dir /home/centml/workspace/Wan2.1/Wan2.1-T2V-14B
