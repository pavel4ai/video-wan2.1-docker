import logging
import sys
import time
import psutil
import GPUtil
from datetime import datetime
from prometheus_client import Counter, Gauge

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('/workspace/error.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

# Prometheus metrics for errors
error_counter = Counter('system_errors_total', 'Total number of errors', ['type'])
gpu_memory_available = Gauge('gpu_memory_available_mb', 'Available GPU memory in MB')

class GPUMonitor:
    @staticmethod
    def check_gpu_health():
        try:
            gpus = GPUtil.getGPUs()
            for gpu in gpus:
                gpu_memory_available.set(gpu.memoryFree)
            return True
        except Exception as e:
            logging.error(f"Error checking GPU health: {e}")
            return False

class ErrorHandler:
    @staticmethod
    def handle_error(error_type, error_msg, fatal=False):
        """
        Handle system errors and log them appropriately
        """
        error_counter.labels(type=error_type).inc()
        
        error_details = {
            'timestamp': datetime.now().isoformat(),
            'type': error_type,
            'message': str(error_msg),
            'system_state': ErrorHandler.get_system_state()
        }
        
        logging.error(f"Error occurred - Type: {error_type}")
        logging.error(f"Details: {error_msg}")
        logging.error(f"System State: {error_details['system_state']}")
        
        if fatal:
            logging.critical("Fatal error occurred - terminating process")
            sys.exit(1)
        
        return error_details

    @staticmethod
    def get_system_state():
        """
        Collect current system state for error context
        """
        try:
            gpus = GPUtil.getGPUs()
            gpu_info = [{
                'id': gpu.id,
                'memory_used': gpu.memoryUsed,
                'memory_total': gpu.memoryTotal,
                'gpu_util': gpu.load * 100
            } for gpu in gpus]
            
            memory = psutil.virtual_memory()
            
            return {
                'gpu_state': gpu_info,
                'memory_percent': memory.percent,
                'cpu_percent': psutil.cpu_percent(),
                'disk_usage': psutil.disk_usage('/workspace').percent
            }
        except Exception as e:
            return f"Error collecting system state: {e}"
