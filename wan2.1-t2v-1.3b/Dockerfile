# Use NVIDIA PyTorch as the base image
FROM nvcr.io/nvidia/pytorch:24.08-py3

# Set non-interactive mode to prevent prompts
ENV DEBIAN_FRONTEND=noninteractive

# Update and install dependencies
RUN apt update && apt upgrade -y && \
    apt install -y python3.11 python3.11-venv python3.11-dev python3.11-distutils python3-pip && \
    update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 && \
    apt install -y git ffmpeg && \
    wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb && \
    dpkg -i cuda-keyring_1.1-1_all.deb && \
    apt-get update && \
    apt-get -y install cuda-toolkit-12-3 && \
    rm -rf /var/lib/apt/lists/*

# Set CUDA environment variables
ENV PATH="/usr/local/cuda/bin:${PATH}"
ENV LD_LIBRARY_PATH="/usr/local/cuda/lib64:${LD_LIBRARY_PATH}"

# Upgrade pip and install required Python packages
RUN pip install --upgrade pip
RUN pip install wheel packaging torch==2.6

# Clone the repository
WORKDIR /workspace
RUN git clone https://github.com/Wan-Video/Wan2.1.git

# Install Python dependencies
RUN pip install -r /workspace/Wan2.1/requirements.txt

# Install Hugging Face CLI and download the model
RUN pip install "huggingface_hub[cli]" && \
    huggingface-cli download Wan-AI/Wan2.1-T2V-1.3B --local-dir /workspace/Wan2.1/Wan2.1-T2V-1.3B

# Ensure dependencies are installed again (to handle updates)
RUN apt update && apt upgrade -y
RUN pip install wheel packaging 
RUN pip install torch==2.6
RUN apt update && apt upgrade -y
RUN pip install packaging
RUN pip install flash_attn
RUN pip install -r /workspace/Wan2.1/requirements.txt

# Expose the Gradio server port
EXPOSE 7860
EXPOSE 22
# Default command to start the model
CMD ["python", "/workspace/Wan2.1/gradio/t2v_1.3B_singleGPU.py", "--ckpt_dir", "/workspace/Wan2.1/Wan2.1-T2V-1.3B"]
