# Wan2.1 Docker Environments

This repository provides Docker environments for running and testing the Wan2.1 T2V-14B model and its smaller sibling 1.3B model, a state-of-the-art text-to-video generation models for a variety of GPUs. The repository is structured to support both production deployments and infrastructure testing scenarios.

## Repository Structure

### [wan2.1-t2v-14b](./wan2.1-t2v-14b)
Production-ready Docker environment for running the Wan2.1 T2V-14B model:
- Optimized Dockerfile with proper CUDA setup
- Gradio-based web interface for video generation
- Automated model weights download and verification
- See subfolder README for detailed setup instructions
- 80GB or more VRAM required per GPU

### [wan2.1-t2v-14B-infra-test](./wan2.1-t2v-14B-infra-test)
Comprehensive infrastructure testing suite using the Wan2.1 T2V-14B model as a stress test:
- GPU performance and utilization metrics
- System resource monitoring (CPU, Memory, Disk I/O)
- Network performance testing with iPerf3
- Real-time monitoring via Prometheus and Grafana
- See subfolder README for detailed testing procedures

## Quick Start

Each subfolder contains its own Dockerfile and documentation. Choose the appropriate environment based on your needs:

1. For video generation service:
```bash
cd wan2.1-t2v-14b
docker build -t wan2.1-t2v-14b .
docker run --gpus all -p 8080:8080 wan2.1-t2v-14b
```

2. For infrastructure testing:
```bash
cd wan2.1-t2v-14B-infra-test
docker build -t wan2.1-infra-test .
docker run --gpus all -p 8080:8080 wan2.1-infra-test
```

## Requirements

- NVIDIA GPU with CUDA support
- Docker with NVIDIA Container Toolkit
- Minimum 24GB GPU memory for 1.3B model and 80GB or more VRAM required per GPU for 14B model
- 32GB system RAM recommended
- 100GB+ storage space for model weights

## Contributing

Contributions are welcome!

## License

The Wan2.1 model itself has its own licensing terms that must be followed.
