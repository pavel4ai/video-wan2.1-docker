# Use NVIDIA PyTorch as the base image
FROM nvcr.io/nvidia/pytorch:24.08-py3

# Set non-interactive mode to prevent prompts
ENV DEBIAN_FRONTEND=noninteractive

# Update and install system dependencies
RUN apt update && apt upgrade -y && \
    apt install -y python3.11 python3.11-venv python3.11-dev python3.11-distutils python3-pip \
                   git ffmpeg wget && \
    update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 && \
    wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb && \
    dpkg -i cuda-keyring_1.1-1_all.deb && \
    apt-get update && \
    apt-get -y install cuda-toolkit-12-3 && \
    rm -rf /var/lib/apt/lists/*

# Set CUDA environment variables
ENV PATH="/usr/local/cuda/bin:${PATH}"
ENV LD_LIBRARY_PATH="/usr/local/cuda/lib64:${LD_LIBRARY_PATH}"


## Upgrade pip and install required Python packages
RUN pip install --upgrade pip
RUN pip install wheel packaging torch==2.6

# Clone the repository
WORKDIR /workspace
RUN git clone https://github.com/Wan-Video/Wan2.1.git

# Install all Python dependencies at once
RUN pip install -r /workspace/Wan2.1/requirements.txt && \
    pip install "huggingface_hub[cli]"

# Final dependency check (if needed)
RUN pip install --no-cache-dir packaging torch==2.6 flash_attn -r /workspace/Wan2.1/requirements.txt

# Expose the Gradio server port
EXPOSE 7860

#Set CentML User
ARG USERNAME="centml"
RUN useradd -u 1024 -m -d /workspace -s /bin/bash ${USERNAME} && chown -R ${USERNAME}:${USERNAME} /workspace
USER 1024

# Download the Hugging Face model weights
RUN huggingface-cli download Wan-AI/Wan2.1-T2V-14B --local-dir /workspace/Wan2.1/Wan2.1-T2V-14B
# Default command to start the model
# Copy the script into the container
COPY download_and_verify_weights.sh /workspace/download_and_verify_weights.sh
RUN chmod +x /workspace/download_and_verify_weights.sh

# Set the script as the entry point
ENTRYPOINT ["/workspace/download_and_verify_weights.sh"]
CMD ["python", "/workspace/Wan2.1/gradio/t2v_14B_singleGPU.py", "--ckpt_dir", "/workspace/Wan2.1/Wan2.1-T2V-14B"]
