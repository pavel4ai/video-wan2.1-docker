# Wan2.1 T2V-14B Portable (No Sudo Required)

This is a portable version of the Wan2.1 T2V-14B model that can run inside the NVIDIA PyTorch container without requiring sudo access.

## Prerequisites

- Access to `nvcr.io/nvidia/pytorch:24.08-py3` container
- Write access to `/home/centml` directory
- Python 3.10 or later
- Internet access for downloading dependencies and model weights
- NVIDIA GPU with CUDA support

## Usage

1. Start the NVIDIA PyTorch container:
```bash
docker run --gpus all -it --rm -p 8080:8080 nvcr.io/nvidia/pytorch:24.08-py3
```

2. Download and run the setup script:
```bash
cd /home/centml
curl -O https://raw.githubusercontent.com/pavel4ai/video-wan2.1-docker/main/wan2.1-t2v-14B-portable/setup_environment.sh
chmod +x setup_environment.sh
./setup_environment.sh
```

This will:
- Create workspace directory under `/home/centml/workspace`
- Clone all necessary scripts to `/home/centml`
- Set up Python virtual environment
- Install all dependencies including Gradio
- Configure huggingface-cli in PATH
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

## Directory Structure

```
/home/centml/
├── setup_environment.sh
├── download_model.sh
├── start_server.sh
└── workspace/
    ├── venv/                 # Python virtual environment
    └── Wan2.1/              # Main repository
        └── Wan2.1-T2V-14B/  # Model weights
```

## Notes

- All scripts are located in `/home/centml`
- All dependencies are installed in a Python virtual environment under `/home/centml/workspace/venv`
- The model weights are stored in `/home/centml/workspace/Wan2.1/Wan2.1-T2V-14B`
- The huggingface-cli is automatically added to PATH in both current shell and .bashrc
- If you encounter any errors:
  1. Make sure Python 3.10 or later is available
  2. Run `setup_environment.sh` first to set up the environment
  3. Run `download_model.sh` to get the model weights before starting the server
  4. Check that the virtual environment is properly activated
- All operations are performed without requiring sudo access
