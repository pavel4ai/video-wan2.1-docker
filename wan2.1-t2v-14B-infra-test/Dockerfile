# syntax=docker/dockerfile:1
# Use NVIDIA PyTorch as the base image
FROM nvcr.io/nvidia/pytorch:24.08-py3

# Set non-interactive mode
ENV DEBIAN_FRONTEND=noninteractive

# Update and install system dependencies
RUN apt update && apt upgrade -y && \
    apt install -y python3.11 python3.11-venv python3.11-dev python3.11-distutils python3-pip \
                   git ffmpeg wget iperf3 fio nginx htop sysstat \
                   lm-sensors nvme-cli smartmontools iproute2 net-tools \
                   stress-ng hdparm musl && \
    update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 && \
    wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb && \
    dpkg -i cuda-keyring_1.1-1_all.deb && \
    apt-get update && \
    apt-get -y install cuda-toolkit-12-3 && \
    rm -rf /var/lib/apt/lists/*

# Set CUDA environment variables
ENV PATH="/usr/local/cuda/bin:${PATH}"
ENV LD_LIBRARY_PATH="/usr/local/cuda/lib64:${LD_LIBRARY_PATH}"

# Install Node.js and dependencies
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get update && apt-get install -y nodejs && \
    npm install -g pm2 && \
    mkdir -p /workspace/scripts && \
    cd /workspace/scripts && \
    npm init -y && \
    npm install express http-proxy socket.io

WORKDIR /workspace

# Set up Python environment and dependencies
RUN pip install --upgrade pip && \
    pip install wheel packaging torch==2.6 && \
    pip install psutil GPUtil py3nvml nvidia-ml-py prometheus_client requests \
                flask flask-socketio aiohttp psutil py-cpuinfo \
                matplotlib seaborn pandas plotly


RUN git clone https://github.com/Wan-Video/Wan2.1.git /workspace/Wan2.1
# Ensure git and openssh-client are installed
RUN apt-get update && apt-get install -y --no-install-recommends git openssh-client && rm -rf /var/lib/apt/lists/*

# Clone repo, copy necessary files, set permissions, and clean up
RUN git clone https://github.com/pavel4ai/video-wan2.1-docker.git /workspace/temp && \
    # Copy scripts and config directories TO /workspace
    echo "--- Copying scripts and config ---" && \
    cp -r /workspace/temp/wan2.1-t2v-14B-infra-test/scripts /workspace && \
    cp -r /workspace/temp/wan2.1-t2v-14B-infra-test/config /workspace && \
    # Make scripts executable (ensure paths are correct based on ls output)
    echo "--- Setting script permissions ---" && \
    chmod +x /workspace/scripts/download_and_verify_weights.sh /workspace/scripts/start_test_suite.sh && \
    chmod +x /workspace/scripts/collect_metrics.sh && \
    # Create NGINX directories
    mkdir -p /workspace/nginx/body_temp /workspace/nginx/proxy_temp /workspace/nginx/fastcgi_temp /workspace/nginx/uwsgi_temp /workspace/nginx/scgi_temp && \
    chown -R 1024:1024 /workspace/nginx && \
    chmod -R 755 /workspace/nginx && \
    mv /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak && \
    # Clean up temp directory
    echo "--- Cleaning up /workspace/temp ---" && \
    rm -rf /workspace/temp

# Install all Python dependencies
RUN pip install -r /workspace/Wan2.1/requirements.txt && \
    pip install "huggingface_hub[cli]" flash_attn

# Set up CentML user for security. DO NOT CHANGE USER SETUP
ARG USERNAME="centml"
RUN useradd -u 1024 -m -d /workspace -s /bin/bash ${USERNAME} && \
    mkdir -p /workspace/data/metrics /workspace/data/logs /workspace/data/fio /workspace/data/videos && \
    touch /workspace/data/logs/app.log /workspace/data/logs/router.log && \
    chown -R ${USERNAME}:${USERNAME} /workspace && \
    chown -R ${USERNAME}:${USERNAME} /workspace/data && \
    chmod -R 755 /workspace/data && \
    # Set up log directory permissions
    mkdir -p /var/log/nginx && \
    touch /var/log/nginx/error.log && \
    chown -R ${USERNAME}:${USERNAME} /var/log/nginx && \
    chmod -R 755 /var/log/nginx

USER 1024

# Expose ports
EXPOSE 8080

# Download weights and start test suite
ENTRYPOINT ["/workspace/scripts/download_and_verify_weights.sh"]
CMD ["/workspace/scripts/start_test_suite.sh"]
