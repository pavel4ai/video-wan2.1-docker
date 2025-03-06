import subprocess
import json
import time
from prometheus_client import Gauge, start_http_server

# Prometheus metrics
read_speed = Gauge('storage_read_speed_mbps', 'Storage read speed in MB/s')
write_speed = Gauge('storage_write_speed_mbps', 'Storage write speed in MB/s')

def run_fio_test():
    # FIO test configuration
    fio_config = {
        "read_test": {
            "command": [
                "fio", "--name=read_test", "--rw=read", "--size=1G",
                "--directory=/workspace", "--direct=1", "--bs=4M",
                "--ioengine=libaio", "--output-format=json"
            ],
            "metric": read_speed
        },
        "write_test": {
            "command": [
                "fio", "--name=write_test", "--rw=write", "--size=1G",
                "--directory=/workspace", "--direct=1", "--bs=4M",
                "--ioengine=libaio", "--output-format=json"
            ],
            "metric": write_speed
        }
    }

    while True:
        for test_name, config in fio_config.items():
            try:
                result = subprocess.run(
                    config["command"],
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    data = json.loads(result.stdout)
                    speed = data['jobs'][0]['read' if 'read' in test_name else 'write']['bw'] / 1024  # Convert to MB/s
                    config["metric"].set(speed)
                    
                print(f"{test_name} completed: {speed} MB/s")
                
            except Exception as e:
                print(f"Error running {test_name}: {e}")

        time.sleep(60)  # Run tests every minute

if __name__ == '__main__':
    # Start Prometheus metrics server
    start_http_server(8084)
    run_fio_test()
