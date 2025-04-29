# Wan2.1 T2V-14B Infrastructure Test Suite

This project provides a comprehensive infrastructure testing suite using the Wan2.1 T2V-14B video generation model as the source of stress, focusing on performance metrics, resource utilization, and system capabilities for a given GPU infra provider. While the video generation test is running, various system metrics are collected and logged using standard Linux tools (`sar`) and `nvidia-smi`. Metrics and generated videos are presented to the user via a simple web interface.

## Features

- GPU Performance Testing
  - Sequential generation of 5 test videos
  - Iterations per second monitoring (Output in Video Script logs)
  - GPU utilization metrics (Viewable on web UI during test)

- System Resource Monitoring (Viewable on web UI during test)
  - GPU metrics (utilization, memory, temperature, power draw)
  - CPU metrics (utilization breakdown)
  - Memory usage
  - Disk I/O performance

- Network Performance Testing
  - iPerf3 for bandwidth and latency testing (Manual start via web UI)

- Real-time Monitoring via Web Interface
  - System metrics updated periodically during video generation test
  - Single port access (8888 by default)
  - Web-based control panel to start tests and view results

## Test Prompts

The system will generate 5 videos using these prompts:
1. "A serene mountain landscape with flowing waterfalls and lush forests, cinematic style"
2. "A futuristic cityscape at night with flying vehicles and neon lights, cyberpunk style"
3. "A dramatic ocean storm with massive waves and lightning, realistic style"
4. "A peaceful garden with butterflies and blooming flowers, dreamy style"
5. "A desert oasis under a starry night sky with shooting stars, artistic style"

## Usage

1. Clone the repository:
```bash
git clone https://github.com/pavel4ai/video-wan2.1-docker.git
cd video-wan2.1-docker/wan2.1-t2v-14B-infra-test
```

2. Build the Docker image:
```bash
docker build -t wan2.1-infra-test .
```

3. Run the container (mapping port 8888):
```bash
docker run --gpus all -it --rm -p 8888:8888 wan2.1-infra-test
```

4. Access the control panel:
```
http://localhost:8888
```

5. **Using the Panel:**
   - Click **"Start Video Generation Test"** to begin the 5 video generations. System metrics will automatically start collecting and displaying below.
   - Click **"Start iPerf3 Server"** to enable network testing. Follow the on-screen instructions to test from another machine.
   - Generated videos will appear at the bottom for viewing and download.

## Architecture

All services are routed through port 8888 via an NGINX reverse proxy:
- `/` - Main control panel UI (Node.js/Express App)
- `/videos/` - Video browsing and streaming endpoint (Served by NGINX)
- Internal Services:
  - Node.js App: Port 8083
  - iPerf3 Server: Port 5201 (when started)

## Test Results and Metrics

- Video generation performance metrics are logged by the Python script (view container logs).
- System resource metrics (CPU, Memory, Disk, GPU) are logged to CSV files in `/workspace/data/metrics/` inside the container during the video test.
- The latest metrics are displayed in the web UI while the test is active.
- Generated videos are stored in `/workspace/data/videos/` inside the container and accessible via the `/videos/` path in the web UI.
