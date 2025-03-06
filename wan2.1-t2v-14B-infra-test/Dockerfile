FROM nvcr.io/nvidia/pytorch:24.08-py3

# Set non-interactive mode
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies without sudo
WORKDIR /workspace

# Copy all setup scripts
COPY scripts/ /workspace/scripts/
COPY config/ /workspace/config/

# Make scripts executable
RUN chmod +x /workspace/scripts/*.sh

# Install Node.js for the router
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# Install monitoring tools
RUN wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz && \
    tar xvfz prometheus-2.45.0.linux-amd64.tar.gz && \
    mv prometheus-2.45.0.linux-amd64 prometheus

# Install performance testing tools
RUN apt-get update && apt-get install -y \
    iperf3 \
    fio \
    nginx \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set up Python environment and dependencies
RUN python -m venv /workspace/venv && \
    . /workspace/venv/bin/activate && \
    pip install --upgrade pip && \
    pip install wheel packaging torch==2.6 prometheus_client requests

# Clone Wan2.1 repository
RUN git clone https://github.com/Wan-Video/Wan2.1.git /workspace/Wan2.1

# Install project dependencies
RUN . /workspace/venv/bin/activate && \
    pip install -r /workspace/Wan2.1/requirements.txt && \
    pip install "huggingface_hub[cli]" flash_attn

# Expose single port for all services
EXPOSE 8080

# Start the test suite
CMD ["/workspace/scripts/start_test_suite.sh"]
