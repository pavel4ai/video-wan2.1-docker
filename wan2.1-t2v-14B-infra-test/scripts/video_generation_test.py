import subprocess
import time
import json
import logging
import os
import glob
import shutil
from prometheus_client import Gauge, start_http_server
from error_handler import ErrorHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Prometheus metrics
iterations_per_second = Gauge('video_generation_iterations_per_second', 'Iterations per second for video generation')
current_test_number = Gauge('current_test_number', 'Current test number being processed')
total_tests = Gauge('total_tests', 'Total number of tests to run')

# Constants
VIDEO_OUTPUT_DIR = '/workspace/data/videos'
WAN_OUTPUT_DIR = '/workspace/Wan2.1'
os.makedirs(VIDEO_OUTPUT_DIR, exist_ok=True)

# Test prompts
PROMPTS = [
    "A serene mountain landscape with flowing waterfalls and lush forests, cinematic style",
    "A futuristic cityscape at night with flying vehicles and neon lights, cyberpunk style",
    "A dramatic ocean storm with massive waves and lightning, realistic style",
    "A peaceful garden with butterflies and blooming flowers, dreamy style",
    "A desert oasis under a starry night sky with shooting stars, artistic style"
]

def parse_output_metrics(output_line):
    """Parse metrics from model output"""
    try:
        if "it/s" in output_line:
            speed = float(output_line.split("it/s")[0].split()[-1])
            iterations_per_second.set(speed)
    except ValueError:
        pass

def move_latest_video(test_number):
    """Find and move the latest generated video to the proper location"""
    # Find the latest t2v-*.mp4 file
    video_files = glob.glob(os.path.join(WAN_OUTPUT_DIR, 't2v-*.mp4'))
    if not video_files:
        logging.error("No video file found after generation")
        return None
    
    # Get the most recent file
    latest_video = max(video_files, key=os.path.getctime)
    
    # Create new filename
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    new_filename = f"test_{test_number}_{timestamp}.mp4"
    new_path = os.path.join(VIDEO_OUTPUT_DIR, new_filename)
    
    try:
        shutil.move(latest_video, new_path)
        logging.info(f"Video moved to: {new_path}")
        return new_path
    except Exception as e:
        logging.error(f"Failed to move video file: {e}")
        return None

def run_video_generation(prompt, test_number):
    """Run video generation with the given prompt"""
    logging.info(f"Starting video generation for test {test_number}/5")
    logging.info(f"Prompt: {prompt}")
    
    cmd = [
        "python",
        "/workspace/Wan2.1/generate.py",
        "--task", "t2v-14B",
        "--size", "832*480",
        "--ckpt_dir", "/workspace/Wan2.1/Wan2.1-T2V-14B",
        "--prompt", prompt
    ]
    
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            bufsize=1  # Line buffered
        )
        
        # Monitor process output
        while True:
            output = process.stdout.readline()
            if output == '' and process.poll() is not None:
                break
            if output:
                parse_output_metrics(output)
                logging.info(output.strip())
        
        # Check for errors
        stderr = process.stderr.read()
        if stderr:
            ErrorHandler.handle_error('process_error', stderr)
            logging.error(f"Error in test {test_number}: {stderr}")
            return 1
        
        # Wait for process to complete
        return_code = process.wait()
        if return_code == 0:
            logging.info(f"Successfully completed video generation for test {test_number}")
            # Move and rename the video file
            video_path = move_latest_video(test_number)
            if video_path:
                logging.info(f"Video available at: {video_path}")
            else:
                return 1
        else:
            logging.error(f"Video generation failed for test {test_number} with return code {return_code}")
        
        return return_code
    
    except Exception as e:
        ErrorHandler.handle_error('runtime_error', str(e))
        logging.error(f"Exception in test {test_number}: {str(e)}")
        return 1

def save_test_results(results):
    """Save test results to JSON file"""
    try:
        with open('/workspace/test_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        logging.info("Test results saved successfully")
    except Exception as e:
        ErrorHandler.handle_error('file_error', f"Failed to save test results: {e}")
        logging.error(f"Failed to save test results: {e}")

def run_test_sequence():
    """Run the full test sequence"""
    results = []
    total_tests.set(len(PROMPTS))
    
    for i, prompt in enumerate(PROMPTS, 1):
        current_test_number.set(i)
        
        start_time = time.time()
        exit_code = run_video_generation(prompt, i)
        end_time = time.time()
        
        result = {
            "test_number": i,
            "prompt": prompt,
            "duration": end_time - start_time,
            "success": exit_code == 0,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        results.append(result)
        save_test_results(results)
        
        if exit_code != 0:
            logging.warning(f"Test {i} failed, but continuing with next test")
        
        # Wait between tests to ensure GPU cooldown and resource cleanup
        if i < len(PROMPTS):
            logging.info(f"Waiting 30 seconds before starting test {i + 1}")
            time.sleep(30)

if __name__ == "__main__":
    try:
        logging.info("Starting video generation test suite")
        start_http_server(8082)
        run_test_sequence()
        logging.info("Test suite completed")
    except Exception as e:
        ErrorHandler.handle_error('fatal_error', str(e), fatal=True)
        logging.critical(f"Fatal error in test suite: {str(e)}")
