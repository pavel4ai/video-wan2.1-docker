# Use NVIDIA PyTorch as the base image
FROM nvcr.io/nvidia/pytorch:24.08-py3

# Set non-interactive mode to prevent prompts
ENV DEBIAN_FRONTEND=noninteractive

# Update and install system dependencies
RUN apt update && apt upgrade -y && \
    apt install -y software-properties-common curl gpg python3.11 python3.11-venv python3.11-dev python3.11-distutils python3-pip \
                   git ffmpeg wget nginx prometheus iperf3 fio && \
    update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 && \
    wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb && \
    dpkg -i cuda-keyring_1.1-1_all.deb && \
    apt-get update && \
    apt-get -y install cuda-toolkit-12-3 && \
    rm -rf /var/lib/apt/lists/*

# Install Grafana from official repository
RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://apt.grafana.com/gpg.key | tee /etc/apt/keyrings/grafana.asc > /dev/null && \
    echo "deb [signed-by=/etc/apt/keyrings/grafana.asc] https://apt.grafana.com stable main" | tee /etc/apt/sources.list.d/grafana.list > /dev/null && \
    apt-get update && \
    apt-get install -y grafana && \
    rm -rf /var/lib/apt/lists/*

# Set CUDA environment variables
ENV PATH="/usr/local/cuda/bin:${PATH}"
ENV LD_LIBRARY_PATH="/usr/local/cuda/lib64:${LD_LIBRARY_PATH}"
ENV PYTHONNOUSERSITE=1
ENV PYTHONPATH="/usr/local/lib/python3.11/dist-packages:$PYTHONPATH"

# Upgrade pip and install required Python packages
RUN pip install --upgrade pip
RUN pip install --ignore-installed wheel packaging torch==2.6 flask prometheus_client gradio flash_attn psutil


# Clone the Wan2.1 repository
WORKDIR /workspace
RUN git clone https://github.com/Wan-Video/Wan2.1.git

# Install all Python dependencies at once
RUN pip install --no-cache-dir -r /workspace/Wan2.1/requirements.txt && \
    pip install "huggingface_hub[cli]"

# Download monitoring and NGINX configuration files from GitHub
RUN git clone https://github.com/pavel4ai/health_checks.git /workspace/health_checks

# Move scripts to their correct locations
RUN mv /workspace/health_checks/start_wan_video_test.sh /workspace/start_wan_video_test.sh && \
    mv /workspace/health_checks/video_serving.sh /workspace/video_serving.sh && \
    mv /workspace/health_checks/video_stream_nginx.conf /etc/nginx/conf.d/video_stream_nginx.conf && \
    mv /workspace/health_checks/wan_test_metrics_api.py /workspace/wan_test_metrics_api.py && \
    chmod +x /workspace/start_wan_video_test.sh /workspace/video_serving.sh

# Final dependency check (if needed)
RUN pip install --no-cache-dir packaging torch==2.6 flash_attn -r /workspace/Wan2.1/requirements.txt
RUN pip install gradio

# Set up non-root user
ARG USERNAME="centml"
RUN useradd -u 1024 -m -d /workspace -s /bin/bash ${USERNAME} && chown -R ${USERNAME}:${USERNAME} /workspace
USER 1024

# Fix NGINX permissions (since sudo is not available inside the container)
RUN mkdir -p /var/log/nginx /var/lib/nginx/body /run/nginx && \
    chown -R 1024:1024 /var/log/nginx /var/lib/nginx /var/lib/nginx/body /run/nginx

# Expose necessary ports
EXPOSE 7860 9090 8081 5201

# Default command: Drop to shell (User manually starts tests)
CMD ["/bin/bash"]
