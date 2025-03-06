# Wan2.1 T2V-14B Infrastructure Test Suite

This project provides a comprehensive infrastructure testing suite using the Wan2.1 T2V-14B model as the source of stress, focusing on performance metrics, resource utilization, and system capabilities for a given GPU infra provider.

## Features

- GPU Performance Testing
  - Sequential generation of 5 test videos
  - Iterations per second monitoring
  - GPU utilization metrics

- System Resource Monitoring
  - GPU metrics (utilization, memory, temperature)
  - CPU metrics (utilization, temperature)
  - Memory usage
  - Disk I/O performance

- Network Performance Testing
  - iPerf3 for bandwidth and latency testing
  - Video streaming performance via NGINX/FFmpeg

- Storage Performance Testing
  - FIO-based read/write speed testing
  - Continuous monitoring during model weight downloads

- Real-time Monitoring
  - Prometheus metrics collection
  - All services accessible through single port (8080)
  - Web-based control panel

## Test Prompts

The system will generate 5 videos using these prompts:
1. "A serene mountain landscape with flowing waterfalls and lush forests, cinematic style"
2. "A futuristic cityscape at night with flying vehicles and neon lights, cyberpunk style"
3. "A dramatic ocean storm with massive waves and lightning, realistic style"
4. "A peaceful garden with butterflies and blooming flowers, dreamy style"
5. "A desert oasis under a starry night sky with shooting stars, artistic style"

## Usage

1. Build the Docker image:
```bash
docker build -t wan2.1-infra-test .
```

2. Run the container:
```bash
docker run --gpus all -it --rm -p 8080:8080 wan2.1-infra-test
```

3. Access the control panel:
```
http://localhost:8080
```

## Architecture

All services are routed through port 8080:
- `/` - Main control panel UI
- `/metrics` - Prometheus metrics
- `/grafana` - Grafana dashboards
- `/stream` - Video streaming endpoint to view the generated videos

## Test Results

Results are stored in `/workspace/test_results.json` and include:
- Video generation performance metrics
- System resource utilization
- Storage performance data
- Network performance metrics
