import time
import psutil
import GPUtil
import logging
from prometheus_client import start_http_server, Gauge
from error_handler import ErrorHandler

# GPU metrics
gpu_utilization = Gauge('gpu_utilization_percent', 'GPU utilization percentage')
gpu_memory_used = Gauge('gpu_memory_used_mb', 'GPU memory used in MB')
gpu_temperature = Gauge('gpu_temperature_celsius', 'GPU temperature in Celsius')

# CPU metrics
cpu_utilization = Gauge('cpu_utilization_percent', 'CPU utilization percentage')

# Memory metrics
memory_used = Gauge('memory_used_percent', 'Memory utilization percentage')
memory_available = Gauge('memory_available_mb', 'Available memory in MB')

# Disk I/O metrics
disk_read_bytes = Gauge('disk_read_bytes_per_sec', 'Disk read bytes per second')
disk_write_bytes = Gauge('disk_write_bytes_per_sec', 'Disk write bytes per second')

def collect_gpu_metrics():
    """Collect GPU metrics without any throttling or recovery"""
    try:
        gpus = GPUtil.getGPUs()
        for gpu in gpus:
            gpu_utilization.set(gpu.load * 100)
            gpu_memory_used.set(gpu.memoryUsed)
            gpu_temperature.set(gpu.temperature)
    except Exception as e:
        ErrorHandler.handle_error('gpu_metric_error', str(e))

def collect_cpu_metrics():
    """Collect CPU metrics"""
    try:
        cpu_utilization.set(psutil.cpu_percent())
    except Exception as e:
        ErrorHandler.handle_error('cpu_metric_error', str(e))

def collect_memory_metrics():
    """Collect memory metrics"""
    try:
        memory = psutil.virtual_memory()
        memory_used.set(memory.percent)
        memory_available.set(memory.available / 1024 / 1024)  # Convert to MB
    except Exception as e:
        ErrorHandler.handle_error('memory_metric_error', str(e))

def collect_disk_metrics(prev_disk_read, prev_disk_write):
    """Collect disk I/O metrics"""
    try:
        disk_io = psutil.disk_io_counters()
        current_read = disk_io.read_bytes
        current_write = disk_io.write_bytes
        
        if prev_disk_read > 0:
            read_speed = (current_read - prev_disk_read) / 1024 / 1024  # MB/s
            write_speed = (current_write - prev_disk_write) / 1024 / 1024  # MB/s
            disk_read_bytes.set(read_speed)
            disk_write_bytes.set(write_speed)
        
        return current_read, current_write
    except Exception as e:
        ErrorHandler.handle_error('disk_metric_error', str(e))
        return prev_disk_read, prev_disk_write

def collect_metrics():
    prev_disk_read = 0
    prev_disk_write = 0
    
    while True:
        try:
            collect_gpu_metrics()
            collect_cpu_metrics()
            collect_memory_metrics()
            prev_disk_read, prev_disk_write = collect_disk_metrics(prev_disk_read, prev_disk_write)
        except Exception as e:
            ErrorHandler.handle_error('metric_collection_error', str(e))
        time.sleep(1)

if __name__ == '__main__':
    try:
        start_http_server(8083)
        logging.info("Started system metrics collection")
        collect_metrics()
    except Exception as e:
        ErrorHandler.handle_error('fatal_error', str(e), fatal=True)
