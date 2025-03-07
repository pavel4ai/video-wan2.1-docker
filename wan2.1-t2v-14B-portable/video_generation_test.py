#!/usr/bin/env python3
import os
import sys
import time
import logging
import subprocess
from datetime import datetime

# Set up log directory in the workspace
LOG_DIR = "/home/centml/workspace/data/logs"
os.makedirs(LOG_DIR, exist_ok=True)

# Configure logging with more detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - [%(name)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(LOG_DIR, f'video_generation_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'))
    ]
)
logger = logging.getLogger(__name__)

# Test prompts
PROMPTS = [
    "A serene mountain landscape with flowing waterfalls and lush forests, cinematic style",
    "A futuristic cityscape at night with flying vehicles and neon lights, cyberpunk style",
    "A dramatic ocean storm with massive waves and lightning, realistic style",
    "A peaceful garden with butterflies and blooming flowers, dreamy style",
    "A desert oasis under a starry night sky with shooting stars, artistic style",
    "A leasurely tropical island white sand shore with realistic palms on the beach with their branches slowly swaying over blue turquoise waters, realistic style"
]

def verify_environment():
    """Verify that the environment is properly set up"""
    # Check virtual environment
    venv_path = "/home/centml/workspace/venv"
    if not os.path.exists(os.path.join(venv_path, "bin", "activate")):
        logger.error(f"Virtual environment not found at: {venv_path}")
        logger.error("Please run setup_environment.sh first")
        return False
        
    # Check if VIRTUAL_ENV is set
    if not os.getenv("VIRTUAL_ENV"):
        logger.error("Virtual environment is not activated")
        logger.error("Please run: source /home/centml/workspace/venv/bin/activate")
        return False
    
    # Check required paths
    required_paths = {
        "generate.py": "/home/centml/workspace/Wan2.1/generate.py",
        "model weights": "/home/centml/workspace/Wan2.1/Wan2.1-T2V-14B",
        "logs directory": LOG_DIR
    }
    
    success = True
    for name, path in required_paths.items():
        if not os.path.exists(path):
            logger.error(f"Required {name} not found at: {path}")
            success = False
    
    if not success:
        logger.error("Please ensure all required files are in place before running tests")
        return False
    
    # Log environment info
    logger.info("Environment verification successful")
    logger.info(f"Python version: {sys.version.split()[0]}")
    logger.info(f"Virtual env: {os.getenv('VIRTUAL_ENV')}")
    logger.info(f"Log directory: {LOG_DIR}")
    return True

def run_video_generation(prompt, test_number):
    """Run video generation with the given prompt"""
    logger.info(f"\nTest {test_number}/{len(PROMPTS)}")
    logger.info(f"Prompt: {prompt}")
    
    cmd = [
        "python",
        "/home/centml/workspace/Wan2.1/generate.py",
        "--task", "t2v-14B",
        "--size", "832*480",
        "--ckpt_dir", "/home/centml/workspace/Wan2.1/Wan2.1-T2V-14B",
        "--prompt", prompt
    ]
    
    start_time = time.time()
    try:
        # Log the exact command being run
        logger.debug(f"Running command: {' '.join(cmd)}")
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            bufsize=1
        )
        
        # Monitor process output
        success_indicators = ["Completed", "100%"]  # Keywords indicating success
        has_error = False
        found_success = False
        
        while True:
            output = process.stdout.readline()
            if output == '' and process.poll() is not None:
                break
            if output:
                # Check for success indicators
                if any(indicator in output for indicator in success_indicators):
                    logger.info(output.strip())
                    found_success = True
                elif "%" in output:  # Progress bar
                    print(output.strip(), end='\r')  # Print progress without logging
                else:
                    logger.info(output.strip())
        
        # Check for actual errors in stderr
        stderr = process.stderr.read()
        if stderr:
            # Filter out progress bar and CUDA messages
            error_lines = [line.strip() for line in stderr.split('\n') 
                         if line.strip() and 
                         not any(x in line for x in ['%|', 'CUDA', 'device'])]
            
            if error_lines:
                logger.error(f"Error in test {test_number}:")
                for line in error_lines:
                    logger.error(f"  {line}")
                has_error = True
        
        # Wait for process to complete
        return_code = process.wait()
        duration = time.time() - start_time
        
        success = return_code == 0 and not has_error and found_success
        if success:
            logger.info(f"Test {test_number} completed successfully")
            logger.info(f"Generation time: {duration:.2f} seconds")
            return True
        else:
            if return_code != 0:
                logger.error(f"Test {test_number} failed with return code {return_code}")
            elif not found_success:
                logger.error(f"Test {test_number} did not show completion indicators")
            return False
    
    except Exception as e:
        logger.error(f"Exception in test {test_number}:", exc_info=True)
        return False

def main():
    """Run the full test sequence"""
    logger.info("=== Starting Video Generation Test Suite ===")
    
    if not verify_environment():
        return
    
    logger.info(f"Total tests to run: {len(PROMPTS)}")
    
    total_start_time = time.time()
    success_count = 0
    durations = []
    
    try:
        for i, prompt in enumerate(PROMPTS, 1):
            test_start_time = time.time()
            if run_video_generation(prompt, i):
                success_count += 1
                durations.append(time.time() - test_start_time)
            
            # Wait between tests for GPU cooldown
            if i < len(PROMPTS):
                cooldown = 30
                logger.info(f"Cooling down for {cooldown} seconds...")
                time.sleep(cooldown)
    
    except KeyboardInterrupt:
        logger.warning("\nTest suite interrupted by user")
        raise
    
    except Exception:
        logger.error("Unexpected error during test execution:", exc_info=True)
        raise
    
    finally:
        # Always show summary, even if interrupted
        total_duration = time.time() - total_start_time
        
        logger.info("\n=== Test Suite Summary ===")
        logger.info(f"Tests completed: {success_count}/{len(PROMPTS)}")
        logger.info(f"Total time: {total_duration:.2f} seconds")
        if durations:
            logger.info(f"Average time per successful video: {sum(durations)/len(durations):.2f} seconds")
            logger.info(f"Fastest generation: {min(durations):.2f} seconds")
            logger.info(f"Slowest generation: {max(durations):.2f} seconds")
        logger.info("=== End of Test Suite ===\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1)
    except Exception:
        sys.exit(1)
