# Use NVIDIA PyTorch as the base image
FROM nvcr.io/nvidia/pytorch:24.08-py3

# Set non-interactive mode
ENV DEBIAN_FRONTEND=noninteractive

# Update and install system dependencies
RUN apt update && apt upgrade -y && \
    apt install -y python3.10 python3.10-venv python3.10-dev python3.10-distutils python3-pip \
                   git ffmpeg wget iperf3 fio nginx htop sysstat \
                   lm-sensors nvme-cli smartmontools iproute2 net-tools \
                   stress-ng hdparm musl && \
    update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1 && \
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

# Install monitoring tools
RUN wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz && \
    tar xvfz prometheus-2.45.0.linux-amd64.tar.gz && \
    mv prometheus-2.45.0.linux-amd64 prometheus && \
    wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz && \
    tar xvfz node_exporter-1.7.0.linux-amd64.tar.gz && \
    mv node_exporter-1.7.0.linux-amd64 node_exporter && \
    wget https://dl.grafana.com/enterprise/release/grafana-enterprise_11.5.2_amd64.deb && \
    apt-get update && apt-get install -y adduser libfontconfig1 musl && \
    dpkg -i grafana-enterprise_11.5.2_amd64.deb

# Configure NGINX for video streaming
COPY config/nginx.conf /etc/nginx/nginx.conf
RUN mkdir -p /var/www/html/stream

WORKDIR /workspace

# Set up Python environment and dependencies
RUN pip install --upgrade pip && \
    pip install wheel packaging torch==2.6 && \
    pip install psutil GPUtil py3nvml nvidia-ml-py prometheus_client requests \
                flask flask-socketio aiohttp psutil py-cpuinfo \
                matplotlib seaborn pandas plotly

# Clone repositories
RUN git clone https://github.com/Wan-Video/Wan2.1.git /workspace/Wan2.1 && \
    git clone https://github.com/pavel4ai/video-wan2.1-docker.git /workspace/temp && \
    cp -r /workspace/temp/wan2.1-t2v-14B-infra-test/scripts /workspace/ && \
    cp -r /workspace/temp/wan2.1-t2v-14B-infra-test/config /workspace/ && \
    cp /workspace/temp/wan2.1-t2v-14b/download_and_verify_weights.sh /workspace/ && \
    rm -rf /workspace/temp

# Make scripts executable
RUN chmod +x /workspace/scripts/*.sh /workspace/download_and_verify_weights.sh

# Install all Python dependencies
RUN pip install -r /workspace/Wan2.1/requirements.txt && \
    pip install "huggingface_hub[cli]" flash_attn

# Set up CentML user for security
ARG USERNAME="centml"
RUN useradd -u 1024 -m -d /workspace -s /bin/bash ${USERNAME} && \
    mkdir -p /workspace/data/metrics /workspace/data/logs /workspace/data/fio /workspace/data/videos && \
    touch /workspace/data/logs/app.log /workspace/data/logs/prometheus.log \
          /workspace/data/logs/node_exporter.log /workspace/data/logs/router.log && \
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
ENTRYPOINT ["/workspace/download_and_verify_weights.sh"]
CMD ["/workspace/scripts/start_test_suite.sh"]
