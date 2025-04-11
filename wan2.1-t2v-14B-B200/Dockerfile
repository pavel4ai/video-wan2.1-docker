# Use NVIDIA PyTorch as the base image
FROM nvcr.io/nvidia/pytorch:25.03-py3

# Set non-interactive mode to prevent prompts
ENV DEBIAN_FRONTEND=noninteractive

# Update and install system dependencies
RUN apt update && apt upgrade -y && \
    apt install -y software-properties-common && \
    add-apt-repository ppa:deadsnakes/ppa -y && \
    apt update

# Install Python and basic tools
RUN apt install -y python3.11 python3.11-venv python3.11-dev python3.11-distutils python3-pip \
                   git ffmpeg wget && \
    update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1

# Clone the repository
WORKDIR /workspace
RUN echo "=== Cloning Wan2.1 repository ===" && \
    git clone https://github.com/Wan-Video/Wan2.1.git

# Create a modified requirements file without torch and flash_attn
RUN grep -v "^torch\|^flash_attn" /workspace/Wan2.1/requirements.txt > /workspace/requirements_no_torch.txt

# Create virtual environment and make system torch available
RUN python -m venv /workspace/venv && \
    source /workspace/venv/bin/activate && \
    pip install packaging && \
    # Make system torch available to virtual environment
    python -c "import torch; print(f'Using torch {torch.__version__} from {torch.__file__}')" && \
    # Install other requirements
    pip install -r /workspace/requirements_no_torch.txt && \
    # Install flash_attn separately with system torch
    pip install "huggingface_hub[cli]" && \
    pip install flash_attn --no-build-isolation


# Commenting out the sed command as requested
RUN echo "=== Modifying Gradio script to use port 8080 ===" && \
     sed -i 's/server_port=7860/server_port=8080/' /workspace/Wan2.1/gradio/t2v_14B_singleGPU.py

# Copy the updated Gradio script
#COPY t2v_14B_singleGPU.py /workspace/Wan2.1/gradio/t2v_14B_singleGPU.py

# Expose only port 8080 for the Gradio server
EXPOSE 8080

#Set CentML User
ARG USERNAME="centml"
RUN echo "=== Setting up CentML user ===" && \
    useradd -u 1024 -m -d /workspace -s /bin/bash ${USERNAME} && \
    chown -R ${USERNAME}:${USERNAME} /workspace
USER 1024

# Clone the script from the specified GitHub repository
RUN echo "=== Cloning download and verify weights script ===" && \
    git clone https://github.com/pavel4ai/video-wan2.1-docker.git /workspace/temp && \
    cp /workspace/temp/wan2.1-t2v-14b/download_and_verify_weights.sh /workspace/download_and_verify_weights.sh && \
    rm -rf /workspace/temp

# Make the script executable
RUN echo "=== Making the download script executable ===" && \
    chmod +x /workspace/download_and_verify_weights.sh

# Set the script as the entry point
ENTRYPOINT ["/workspace/download_and_verify_weights.sh"]
CMD ["python", "/workspace/Wan2.1/gradio/t2v_14B_singleGPU.py", "--ckpt_dir", "/workspace/Wan2.1/Wan2.1-T2V-14B"]
