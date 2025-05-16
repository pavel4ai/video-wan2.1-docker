# Wan2.1 T2V-14B Infrastructure Test Suite

This project provides some form of GPU infrastructure testing suite using the Wan2.1 T2V-14B video generation model as the source of stress, focusing on performance metrics, resource utilization, and system capabilities for a given GPU infra provider.

This is intended to be a smoke test.

 While the video generation test is running, various system metrics are collected. Metrics and generated videos are presented to the user via a simple web interface accessible through a web browser. Be sure to port forward your container appropriately. This build exposes port 8888

## Features

- GPU Performance Testing
  - Sequential generation of 5 test videos using predefined prompts.
  - Video generation script (`video_generation_test.py`) logs detailed output, including iterations per second (it/s), to `/workspace/data/logs/video_generation.log`.
  - Key video generation metrics (iterations/second, current test number, total tests, generation duration) are exposed via a Prometheus endpoint on port `8082`.
- System Resource Monitoring
  - `collect_metrics.sh` script gathers GPU metrics (utilization, memory, temperature, power draw), CPU metrics, memory usage, and Disk I/O.
  - These system metrics are logged to CSV files in `/workspace/data/metrics/`.
  - Live system metrics are viewable on the web UI during the test.
- Network Performance Testing
  - Includes basic `iperf3`-like tool for bandwidth and latency testing, which can be manually started via the web UI.
- Real-time Monitoring via Web Interface
  - Access all features and monitoring via a single port (`8888` by default) in your web browser.
  - The web UI displays system metrics, allows starting tests, and provides access to generated videos.

## Test Prompts

The system will generate 5 videos using these prompts:
1. "A serene mountain landscape with flowing waterfalls and lush forests, cinematic style"
2. "A futuristic cityscape at night with flying vehicles and neon lights, cyberpunk style"
3. "A dramatic ocean storm with massive waves and lightning, realistic style"
4. "A peaceful garden with butterflies and blooming flowers, dreamy style"
5. "A desert oasis under a starry night sky with shooting stars, artistic style"

## Usage

1.  Clone the repository:
    ```bash
    git clone https://github.com/pavel4ai/video-wan2.1-docker.git
    cd video-wan2.1-docker/wan2.1-t2v-14B-infra-test
    ```

2.  Build the Docker image:
    ```bash
    docker build -t wan2.1-infra-test .
    ```

3.  Run the container (mapping port 8888):
    ```bash
    docker run --gpus all -it --rm -p 8888:8888 wan2.1-infra-test
    ```
    The container will first download model weights (if not present) and then will start the video generation test.

4.  Access the control panel in your web browser:
    ```
    http://localhost:8888
    ```

5.  **Using the Panel:**
    *   Video and System metrics collection will start automatically, and data will be displayed on the UI.
    *   Click **"Start iPerf3 Server"** to enable network testing. Follow on-screen instructions to test from another machine.
    *   Generated videos will appear at the bottom of the panel for viewing and download.

## Architecture

All services are accessible through port `8888` via an NGINX reverse proxy:
-   `/` - Main control panel UI (Served by a Node.js/Express application).
-   `/videos/` - Endpoint for browsing and streaming generated videos (Served directly by NGINX from `/workspace/data/videos/`).

Internal Services:
-   Node.js App (Router & UI): Runs on port `8083`.
-   Video Generation Prometheus Metrics: Exposed by `video_generation_test.py` on port `8082`.
-   iPerf3 Server: Runs on port `5201` (when started from the UI).

## Test Results and Metrics

-   **Video Generation Logs:** Detailed logs from the video generation script, including performance (it/s) for each prompt, are available in `/workspace/data/logs/video_generation.log` inside the container.
-   **Video Generation Prometheus Metrics:** Live metrics such as iterations/second, current test number, total tests, and video generation duration are available on port `8082`.
-   **System Resource Metrics:** Time-series data for CPU, Memory, Disk, and GPU performance are logged to CSV files in `/workspace/data/metrics/` by the `collect_metrics.sh` script.
-   **Web UI:** The primary interface for observing live system metrics and accessing generated content.
-   **Generated Videos:** Stored in `/workspace/data/videos/` inside the container, with filenames like `test_1.mp4`, `test_2.mp4`, etc., and accessible via the `/videos/` path in the web UI.
-   **Other Service Logs:**
    *   Router App logs: `/workspace/data/logs/router.log`
    *   Metrics collection script logs: `/workspace/data/logs/metrics_script.log`
    *   NGINX logs: `/var/log/nginx/error.log`

## Dockerfile Highlights

-   Base Image: `nvcr.io/nvidia/pytorch:24.08-py3`
-   Key Software: Python 3.11, Node.js 18.x, NGINX, CUDA Toolkit 12.3, `sysstat`, `iperf3`, `ffmpeg`.
-   Model Source: Clones `Wan2.1` from `https://github.com/Wan-Video/Wan2.1.git`.
-   Application Code: Clones from `https://github.com/pavel4ai/video-wan2.1-docker.git`.
-   Working Directory: `/workspace`
-   User: `centml` (UID 1024)
-   Entrypoint: `/workspace/scripts/download_and_verify_weights.sh` (downloads model)
-   Default Command: `/workspace/scripts/start_test_suite.sh` (starts all services)
