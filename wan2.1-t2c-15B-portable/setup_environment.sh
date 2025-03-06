#!/bin/bash

echo "=== Setting up portable environment ==="

# Create virtual environment in workspace
python -m venv /workspace/venv

# Activate virtual environment
source /workspace/venv/bin/activate

# Upgrade pip in the virtual environment
pip install --upgrade pip

# Install basic dependencies
pip install wheel packaging torch==2.6

# Clone Wan2.1 repository if not exists
if [ ! -d "/workspace/Wan2.1" ]; then
    echo "=== Cloning Wan2.1 repository ==="
    git clone https://github.com/Wan-Video/Wan2.1.git /workspace/Wan2.1
fi

# Install project dependencies
echo "=== Installing Python dependencies ==="
pip install -r /workspace/Wan2.1/requirements.txt
pip install "huggingface_hub[cli]"
pip install --no-cache-dir packaging torch==2.6 flash_attn

# Modify Gradio port
echo "=== Modifying Gradio script to use port 8080 ==="
for file in /workspace/Wan2.1/gradio/t2v_14B_singleGPU.py /workspace/Wan2.1/gradio/t2i_14B_singleGPU.py /workspace/Wan2.1/gradio/i2v_14B_singleGPU.py; do
    if [ -f "$file" ]; then
        sed -i 's/server_port=7860/server_port=8080/' "$file"
    else
        echo "Error: $file not found" 1>&2
    fi
done
echo "=== Environment setup complete ==="
