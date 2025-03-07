#!/bin/bash

echo "=== Setting up portable environment ==="

# Create workspace directory if it doesn't exist
mkdir -p /home/centml/workspace

# Clone our repository first to get the necessary scripts
echo "=== Cloning setup scripts ==="
git clone https://github.com/pavel4ai/video-wan2.1-docker.git /home/centml/workspace/temp
cp /home/centml/workspace/temp/wan2.1-t2v-14B-portable/setup_environment.sh /home/centml/
cp /home/centml/workspace/temp/wan2.1-t2v-14B-portable/download_model.sh /home/centml/
cp /home/centml/workspace/temp/wan2.1-t2v-14B-portable/start_server.sh /home/centml/
rm -rf /home/centml/workspace/temp

# Create virtual environment in workspace
python -m venv /home/centml/workspace/venv

# Activate virtual environment
source /home/centml/workspace/venv/bin/activate

# Upgrade pip in the virtual environment
pip install --upgrade pip

# Install basic dependencies
pip install wheel packaging torch==2.6

# Clone Wan2.1 repository if not exists
if [ ! -d "/home/centml/workspace/Wan2.1" ]; then
    echo "=== Cloning Wan2.1 repository ==="
    git clone https://github.com/Wan-Video/Wan2.1.git /home/centml/workspace/Wan2.1
fi

# Install project dependencies
echo "=== Installing Python dependencies ==="
pip install -r /home/centml/workspace/Wan2.1/requirements.txt
pip install "huggingface_hub[cli]"
echo "=== Installing Gradio ==="
pip install easydict gradio
# Add huggingface-cli to PATH
export PATH="/home/centml/.local/bin:$PATH"
echo 'export PATH="/home/centml/.local/bin:$PATH"' >> /home/centml/.bashrc

pip install opencv-python-headless
pip install --no-cache-dir packaging torch==2.6 flash_attn
# Modify Gradio port
echo "=== Modifying Gradio script to use port 8080 ==="
for file in /home/centml/workspace/Wan2.1/gradio/t2v_14B_singleGPU.py /home/centml/workspace/Wan2.1/gradio/t2i_14B_singleGPU.py /home/centml/workspace/Wan2.1/gradio/i2v_14B_singleGPU.py; do
    if [ -f "$file" ]; then
        sed -i 's/server_port=7860/server_port=8080/' "$file"
    else
        echo "Error: $file not found" 1>&2
    fi
done

# Make all scripts executable
chmod +x /home/centml/workspace/*.sh
chmod +x /home/centml/*.sh

echo "=== Environment setup complete ==="
echo "Virtual environment location: $VIRTUAL_ENV"
echo "Python version: $(python --version)"
echo "Pip version: $(pip --version)"
