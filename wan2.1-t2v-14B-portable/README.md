# Wan2.1 T2V-14B Portable (No Sudo Required)

This is a portable version of the Wan2.1 T2V-14B model that can run inside the NVIDIA PyTorch container without requiring sudo access.

## Prerequisites

- Access to `nvcr.io/nvidia/pytorch:24.08-py3` container
- Write access to `/workspace` directory
- Internet access for downloading dependencies and model weights

## Usage

1. Start the NVIDIA PyTorch container:
```bash
docker run --gpus all -it --rm -p 8080:8080 nvcr.io/nvidia/pytorch:24.08-py3
```

2. Download and run the setup script:
```bash
curl -O https://raw.githubusercontent.com/pavel4ai/video-wan2.1-docker/main/wan2.1-t2v-14B-portable/setup_environment.sh
chmod +x setup_environment.sh
./setup_environment.sh
```

This will:
- Clone all necessary scripts
- Set up Python virtual environment
- Install all dependencies
- Clone the Wan2.1 repository
- Configure the Gradio server port

3. Download the model:
```bash
./download_model.sh
```

4. Start the Gradio server:
```bash
./start_server.sh
```

The Gradio interface will be available at `http://localhost:8080`

## Notes

- All dependencies are installed in a Python virtual environment under `/workspace/venv`
- The model weights are stored in `/workspace/Wan2.1/Wan2.1-T2V-14B`
- All operations are performed without requiring sudo access
