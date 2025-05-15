import subprocess
import time
import json
import logging
import os
from prometheus_client import Gauge, start_http_server

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/workspace/data/logs/video_generation.log'),
        logging.StreamHandler()
    ]
)

# Prometheus metrics
iterations_per_second = Gauge('video_generation_iterations_per_second', 'Iterations per second for video generation')
current_test_number = Gauge('current_test_number', 'Current test number being processed')
total_tests = Gauge('total_tests', 'Total number of tests to run')
gpu_memory_usage = Gauge('gpu_memory_usage_mb', 'GPU memory usage in MB')
video_generation_duration = Gauge('video_generation_duration_seconds', 'Time taken to generate video')

# Constants
VIDEO_OUTPUT_DIR = '/workspace/data/videos'
WAN_OUTPUT_DIR = '/workspace/'


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
            logging.debug(f"Current speed: {speed} it/s")
    except ValueError as e:
        logging.warning(f"Failed to parse metrics from line: {output_line}, error: {e}")

def run_video_generation(prompt, test_number):
    """Run video generation with the given prompt"""
    logging.info(f"Starting video generation for test {test_number}/5")
    logging.info(f"Prompt: {prompt}")

    video_filename = f"test_{test_number}.mp4"
    save_file_path = os.path.join(VIDEO_OUTPUT_DIR, video_filename)
  
    cmd = [
        "python",
        "/workspace/Wan2.1/generate.py",
        "--task", "t2v-14B",
        "--size", "832*480",
        "--ckpt_dir", "/workspace/Wan2.1/Wan2.1-T2V-14B",
        "--prompt", prompt,
        "--save_file", save_file_path
    ]
    
    start_time = time.time()
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
            logging.error(f"Error in test {test_number}: {stderr}")
        
        # Wait for process to complete
        return_code = process.wait()
        end_time = time.time()
        duration = end_time - start_time
        video_generation_duration.set(duration)
        
        if return_code == 0:
            logging.info(f"Successfully completed video generation script for test {test_number}")
            logging.info(f"Generation time: {duration:.2f} seconds")
            
            # Check if video file was created at the specified path
            if os.path.exists(save_file_path):
                logging.info(f"Video available at: {save_file_path}")
                file_size = os.path.getsize(save_file_path) / (1024 * 1024)  # Convert to MB
                logging.info(f"Video size: {file_size:.2f} MB")
            else:
                logging.error(f"Video file {save_file_path} NOT found after generation for test {test_number}, though script exited with 0.")
                return 1 # Treat as failure if file not found
        else:
            logging.error(f"Video generation script failed for test {test_number} with return code {return_code}")
        
        return return_code
    
    except Exception as e:
        logging.error(f"Exception in test {test_number}: {str(e)}")
        return 1

def save_test_results(results):
    """Save test results to JSON file"""
    try:
        results_file = '/workspace/data/logs/test_results.json'
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2)
        logging.info(f"Test results saved to: {results_file}")
    except Exception as e:
        logging.error(f"Failed to save test results: {e}")

def run_test_sequence():
    """Run the full test sequence"""
    results = []
    total_tests.set(len(PROMPTS))
    current_test_number.set(0)
    
    logging.info("Starting video generation test suite")
    logging.info(f"Total tests to run: {len(PROMPTS)}")
    
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
            cooldown_time = 30
            logging.info(f"Waiting {cooldown_time} seconds before starting test {i + 1}")
            time.sleep(cooldown_time)

if __name__ == "__main__":
    try:
        # Start Prometheus metrics server
        start_http_server(8082)
        logging.info("Started metrics server on port 8082")
        
        # Run the test sequence
        run_test_sequence()
        logging.info("Test suite completed")
    except Exception as e:
        logging.critical(f"Fatal error in test suite: {str(e)}")
