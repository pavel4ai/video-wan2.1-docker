import subprocess
import time
import json
import logging
from prometheus_client import Gauge, start_http_server
from error_handler import ErrorHandler

# Prometheus metrics
iterations_per_second = Gauge('video_generation_iterations_per_second', 'Iterations per second for video generation')

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

def run_video_generation(prompt):
    """Run video generation with the given prompt"""
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
            universal_newlines=True
        )
        
        while True:
            output = process.stdout.readline()
            if output == '' and process.poll() is not None:
                break
            if output:
                parse_output_metrics(output)
                print(output.strip())
        
        stderr = process.stderr.read()
        if stderr:
            ErrorHandler.handle_error('process_error', stderr)
        
        return process.poll()
    
    except Exception as e:
        ErrorHandler.handle_error('runtime_error', str(e))
        return 1

def save_test_results(results):
    """Save test results to JSON file"""
    try:
        with open('/workspace/test_results.json', 'w') as f:
            json.dump(results, f, indent=2)
    except Exception as e:
        ErrorHandler.handle_error('file_error', f"Failed to save test results: {e}")

def run_test_sequence():
    """Run the full test sequence"""
    results = []
    
    for i, prompt in enumerate(PROMPTS, 1):
        logging.info(f"\nStarting video generation test {i}/5")
        logging.info(f"Prompt: {prompt}")
        
        start_time = time.time()
        exit_code = run_video_generation(prompt)
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
        
        # Simple delay between tests
        if i < len(PROMPTS):
            time.sleep(30)

if __name__ == "__main__":
    try:
        start_http_server(8082)
        run_test_sequence()
    except Exception as e:
        ErrorHandler.handle_error('fatal_error', str(e), fatal=True)
