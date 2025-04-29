const express = require('express');
const { spawn } = require('child_process');
const app = express();
const path = require('path');
const fs = require('fs').promises; // Use promises version for async/await

// Global variables to hold process references
let metricsProcess = null;
let videoProcess = null;
let iperfProcess = null;

// Serve generated videos
const videoDir = path.join('/workspace', 'data', 'videos');
app.use('/videos', express.static(videoDir));

// Basic UI for test control and monitoring
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Wan2.1 Infrastructure Test Suite</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    button { padding: 10px 20px; margin: 10px 0; cursor: pointer; }
                    .status { margin: 10px 0; padding: 10px; border: 1px solid #ccc; }
                    .video-list { margin-top: 20px; }
                    .video-item { margin: 10px 0; padding: 10px; border: 1px solid #eee; }
                    .network-test-section { background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; }
                    .test-instructions { background: #fff; padding: 15px; border-left: 4px solid #007bff; margin: 10px 0; }
                    .command-block { background: #2d2d2d; color: #fff; padding: 15px; border-radius: 4px; font-family: monospace; margin: 10px 0; }
                    .test-results { margin-top: 15px; }
                    .test-type { font-weight: bold; margin-top: 10px; }
                    #systemMetrics table { border-collapse: collapse; width: 100%; margin-top: 10px; }
                    #systemMetrics th, #systemMetrics td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    #systemMetrics th { background-color: #f2f2f2; }
                </style>
            </head>
            <body>
                <h1>Test Control Panel</h1>
                <div>
                    <h2>Video Generation Tests</h2>
                    <button id="startVideoTestButton" onclick="startVideoTest()">Start Video Generation Test</button>
                    <div id="videoStatus" class="status">Status: Ready</div>
                </div>
                <div class="network-test-section">
                    <h2>Network Tests</h2>
                    <div class="test-instructions">
                        <h3>iPerf3 Testing Instructions</h3>
                        <p>The iPerf3 server is running on port 5201. Follow these steps to run network tests from your client:</p>
                        
                        <div class="test-type">1. Basic Bandwidth Test (30 seconds):</div>
                        <div class="command-block">
                            iperf3 -c YOUR_SERVER_IP -p 5201 -t 30 -i 1
                        </div>

                        <div class="test-type">2. Bidirectional Test:</div>
                        <div class="command-block">
                            iperf3 -c YOUR_SERVER_IP -p 5201 -t 30 -i 1 --bidir
                        </div>

                        <div class="test-type">3. UDP Test with Jitter Measurement:</div>
                        <div class="command-block">
                            iperf3 -c YOUR_SERVER_IP -p 5201 -u -b 100M -t 30 -i 1
                        </div>

                        <div class="test-type">4. Multiple Parallel Connections Test:</div>
                        <div class="command-block">
                            iperf3 -c YOUR_SERVER_IP -p 5201 -P 4 -t 30 -i 1
                        </div>

                        <p>Replace YOUR_SERVER_IP with the IP address or hostname of this server.</p>
                        <p>Test Parameters:</p>
                        <ul>
                            <li><code>-t 30</code>: Run test for 30 seconds</li>
                            <li><code>-i 1</code>: Output statistics every 1 second</li>
                            <li><code>-u</code>: Use UDP instead of TCP</li>
                            <li><code>-b 100M</code>: Target bandwidth of 100 Mbits/sec (UDP)</li>
                            <li><code>-P 4</code>: Use 4 parallel connections</li>
                            <li><code>--bidir</code>: Bidirectional test</li>
                        </ul>
                    </div>
                    <button id="startIperfButton" onclick="startIperfServer()">Start iPerf3 Server</button>
                    <div id="networkStatus" class="status">Status: Ready</div>
                    <div id="networkResults" class="test-results"></div>
                </div>
                <div>
                    <h2>System Performance Monitoring</h2>
                    <div id="systemMetrics">
                        Click "Start Video Generation Test" to begin monitoring.
                    </div>
                </div>
                <div>
                    <h2>Generated Videos</h2>
                    <div id="videoList" class="video-list"></div>
                </div>

                <script>
                    let metricsIntervalId = null;

                    function startVideoTest() {
                        document.getElementById('videoStatus').textContent = 'Status: Starting video generation and metrics collection...';
                        document.getElementById('startVideoTestButton').disabled = true;
                        document.getElementById('systemMetrics').innerHTML = 'Starting...';

                        fetch('/api/start-video-test')
                            .then(response => {
                                if (!response.ok) {
                                    return response.json().then(err => { throw new Error(err.message || `HTTP error! status: ${response.status}`); });
                                }
                                return response.json(); // Expect JSON back
                            })
                            .then(data => {
                                document.getElementById('videoStatus').textContent = 'Status: ' + data.message;
                                if (data.status === 'started') {
                                    // Start polling for metrics
                                    metricsIntervalId = setInterval(updateMetricsDisplay, 3000); // Update every 3 seconds
                                    updateMetricsDisplay(); // Initial update
                                } else {
                                    // Handle cases where it didn't start (e.g., already running)
                                    document.getElementById('startVideoTestButton').disabled = false;
                                }
                            })
                            .catch(error => {
                                document.getElementById('videoStatus').textContent = 'Status: Error - ' + error.message;
                                document.getElementById('startVideoTestButton').disabled = false;
                                document.getElementById('systemMetrics').innerHTML = 'Failed to start test.';
                            });
                    }

                    function stopMetricsPolling(message = 'Polling stopped.') {
                        if (metricsIntervalId) {
                            clearInterval(metricsIntervalId);
                            metricsIntervalId = null;
                            console.log(message);
                            document.getElementById('startVideoTestButton').disabled = false;
                        }
                    }

                    function updateMetricsDisplay() {
                        fetch('/api/metrics')
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error(`HTTP error! status: ${response.status}`);
                                }
                                return response.json();
                            })
                            .then(metrics => {
                                const metricsDiv = document.getElementById('systemMetrics');
                                let html = '<h4>Latest Metrics:</h4>';

                                // Check if video test completed (more robust check needed ideally)
                                if (metrics.video_test_active === false) {
                                    document.getElementById('videoStatus').textContent = 'Status: Video generation completed.'; // Update status
                                    stopMetricsPolling('Video test finished. Stopping metrics polling.');
                                }

                                // Display CPU (Use backticks consistently)
                                if (metrics.cpu) {
                                    html += `<h5>CPU Usage (%)</h5><table><thead><tr>`;
                                    Object.keys(metrics.cpu).forEach(key => html += `<th>${key}</th>`);
                                    html += `</tr></thead><tbody><tr>`;
                                    Object.values(metrics.cpu).forEach(val => html += `<td>${val}</td>`);
                                    html += `</tr></tbody></table>`;
                                } else {
                                    html += `<p>CPU metrics not available.</p>`;
                                }

                                // Display Memory (Use backticks consistently)
                                if (metrics.memory) {
                                    html += `<h5>Memory Usage</h5><table><thead><tr>`;
                                    Object.keys(metrics.memory).forEach(key => html += `<th>${key}</th>`);
                                    html += `</tr></thead><tbody><tr>`;
                                    Object.values(metrics.memory).forEach(val => html += `<td>${val}</td>`);
                                    html += `</tr></tbody></table>`;
                                } else {
                                    html += `<p>Memory metrics not available.</p>`;
                                }

                                // Display Disk I/O (Already using backticks)
                                if (metrics.disk && metrics.disk.data) {
                                    html += `<h5>Disk I/O (${metrics.disk.device || 'N/A'})</h5><table><thead><tr>`;
                                    Object.keys(metrics.disk.data).forEach(key => html += `<th>${key}</th>`);
                                    html += `</tr></thead><tbody><tr>`;
                                    Object.values(metrics.disk.data).forEach(val => html += `<td>${val}</td>`);
                                    html += `</tr></tbody></table>`;
                                } else {
                                    html += `<p>Disk I/O metrics not available.</p>`;
                                }

                                // Display GPU (Use backticks consistently)
                                if (metrics.gpu && metrics.gpu.length > 0) {
                                    html += `<h5>GPU Metrics</h5><table><thead><tr>`;
                                    // Use headers from the first GPU
                                    Object.keys(metrics.gpu[0]).forEach(key => html += `<th>${key}</th>`);
                                    html += `</tr></thead><tbody>`;
                                    metrics.gpu.forEach(gpu => {
                                        html += `<tr>`;
                                        Object.values(gpu).forEach(val => html += `<td>${val}</td>`);
                                        html += `</tr>`;
                                    });
                                    html += `</tbody></table>`;
                                } else {
                                    html += `<p>GPU metrics not available.</p>`;
                                }

                                metricsDiv.innerHTML = html;
                            })
                            .catch(error => {
                                console.error('Error fetching metrics:', error);
                                document.getElementById('systemMetrics').innerHTML = `Error loading metrics: ${error}. Polling stopped.`;
                                stopMetricsPolling();
                            });
                    }

                    function startIperfServer() {
                        document.getElementById('networkStatus').textContent = 'Status: Starting iPerf3 server...';
                        fetch('/api/start-iperf')
                            .then(response => response.json()) // Expect JSON
                            .then(data => {
                                document.getElementById('networkStatus').textContent = 'Status: ' + data.message;
                                document.getElementById('startIperfButton').disabled = (data.status === 'started');
                            })
                            .catch(error => {
                                document.getElementById('networkStatus').textContent = 'Status: Error starting iPerf3 - ' + error;
                            });
                    }

                    function updateVideoList() {
                        fetch('/api/videos')
                            .then(response => response.json())
                            .then(videos => {
                                const videoList = document.getElementById('videoList');
                                videoList.innerHTML = videos.map(video => 
                                    '<div class="video-item">' +
                                        '<div>' + video.name + '</div>' +
                                        '<video controls width="400">' +
                                            '<source src="/videos/' + video.name + '" type="video/mp4">' +
                                            'Your browser does not support the video tag.' +
                                        '</video>' +
                                    '</div>'
                                ).join('');
                            })
                            .catch(error => {
                                console.error('Error updating video list:', error);
                            });
                    }

                    // Update video list every 30 seconds
                    setInterval(updateVideoList, 30000);
                    updateVideoList(); // Initial update
                </script>
            </body>
        </html>
    `);
});

// API endpoints
app.get('/api/start-video-test', (req, res) => {
    console.log('API: Received request to start video test.');

    if (videoProcess) {
        console.log('API: Video test already running.');
        return res.status(400).json({ status: 'error', message: 'Video generation test already running.' });
    }

    // --- Start Metrics Collection ---
    if (metricsProcess) { // Should not happen if videoProcess is null, but safety check
        console.warn('API: Metrics process seems to be running without video test. Killing it.');
        metricsProcess.kill('SIGTERM'); // Use SIGTERM first
        metricsProcess = null;
    }
    
    console.log('API: Starting metrics collection script...');
    metricsProcess = spawn('bash', ['/workspace/scripts/collect_metrics.sh'], {
        cwd: '/workspace',
        detached: false, // Keep attached to manage lifecycle better
        stdio: 'pipe' // Capture stdio for potential debugging
    });
    
    metricsProcess.stdout.on('data', (data) => console.log(`Metrics Script stdout: ${data.toString().trim()}`))
    metricsProcess.stderr.on('data', (data) => console.error(`Metrics Script stderr: ${data.toString().trim()}`))

    metricsProcess.on('error', (err) => {
        console.error('API: Failed to start metrics process:', err);
        metricsProcess = null; // Clear reference
        // Don't proceed with video test if metrics failed
        return res.status(500).json({ status: 'error', message: 'Failed to start metrics collection.' });
    });
    
    metricsProcess.on('spawn', () => {
        console.log(`API: Metrics process started (PID: ${metricsProcess.pid}).`);
        
        // --- Start Video Generation ---
        console.log('API: Starting video generation script...');
        videoProcess = spawn('python', ['/workspace/scripts/video_generation_test.py'], {
            cwd: '/workspace',
            stdio: 'pipe' // Capture stdio
        });

        videoProcess.stdout.on('data', (data) => console.log(`Video Script stdout: ${data.toString().trim()}`));
        videoProcess.stderr.on('data', (data) => console.error(`Video Script stderr: ${data.toString().trim()}`));

        videoProcess.on('close', (code) => {
            console.log(`API: Video generation process exited (PID: ${videoProcess?.pid}) with code ${code}.`);
            videoProcess = null; // Clear reference
            // Stop metrics collection
            if (metricsProcess) {
                console.log(`API: Killing metrics process (PID: ${metricsProcess.pid})...`);
                metricsProcess.kill('SIGTERM'); 
                // Could add SIGKILL after timeout if needed
                metricsProcess = null;
            }
        });
        
        videoProcess.on('error', (err) => {
            console.error('API: Failed to start video process:', err);
            // Stop metrics if video fails to start
            if (metricsProcess) {
                metricsProcess.kill('SIGTERM');
                metricsProcess = null;
            }
            videoProcess = null; // Clear reference
            // Report error back? Status already sent, maybe log is enough
        });

        // Respond immediately that processes have started
        console.log(`API: Video process started (PID: ${videoProcess.pid}). Responding to client.`);
        res.json({ status: 'started', message: 'Video generation and metrics collection started.' });
    });
});

app.get('/api/metrics', async (req, res) => {
    const metrics = {
        video_test_active: !!videoProcess // Indicate if the main test is running
    };
    metrics.cpu = await parseLastLineCsv('/workspace/data/metrics/cpu_usage.csv');
    metrics.memory = await parseLastLineCsv('/workspace/data/metrics/memory_usage.csv');
    
    // Special handling for disk to extract device name
    const diskRaw = await parseLastLineCsv('/workspace/data/metrics/disk_io.csv');
    if (diskRaw) {
        metrics.disk = { device: null, data: {} };
        // Find header containing device name
        const deviceHeader = Object.keys(diskRaw).find(k => k.includes('(device:'));
        if (deviceHeader) {
            const match = deviceHeader.match(/\(device: (.*?)\)/); // Simpler regex
            if (match && match[1]) {
                metrics.disk.device = match[1];
            }
            // Clean the header name for the key
            const cleanHeader = deviceHeader.split(' (')[0]; 
            // Reconstruct data object with clean headers
            Object.keys(diskRaw).forEach(key => {
                const cleanKey = key.split(' (')[0];
                metrics.disk.data[cleanKey] = diskRaw[key];
            });
        } else {
            metrics.disk.data = diskRaw; // Fallback if device name format changes
        }
    } else {
        metrics.disk = null;
    }

    // GPU needs all lines potentially if multiple GPUs
    try {
        const gpuData = await fs.readFile('/workspace/data/metrics/gpu_metrics.csv', 'utf-8');
        const lines = gpuData.trim().split('\n');
        if (lines.length >= 2) {
            const headers = lines[0].split(',').map(h => h.trim().replace(/[ \s%./[\]()]/g, '')); // Clean headers
            // Read the last N lines where N is the number of GPUs reported in the last entry
            const lastLineValues = lines[lines.length-1].split(',').map(v => v.trim());
            const gpuIndexHeaderIndex = headers.indexOf('gpuindex'); // Find index of gpu_index
            let numGpus = 1; // Default to 1 GPU
            if(gpuIndexHeaderIndex !== -1 && lastLineValues.length > gpuIndexHeaderIndex) {
                numGpus = parseInt(lastLineValues[gpuIndexHeaderIndex], 10) + 1;
                if (isNaN(numGpus)) numGpus = 1; // Fallback if parsing fails
            }
            
            metrics.gpu = [];
            // Ensure we don't read negative lines if file is shorter than numGpus
            const startLine = Math.max(1, lines.length - numGpus); // Start from line 1 (data) or later
            for (let i = startLine; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (headers.length === values.length) {
                    const gpuObj = {};
                    headers.forEach((header, index) => {
                        const value = values[index];
                        gpuObj[header] = isNaN(Number(value)) ? value : Number(value); // Convert to number if possible
                    });
                    metrics.gpu.push(gpuObj);
                }
            }
        } else {
            metrics.gpu = null;
        }
    } catch (error) {
        if (error.code !== 'ENOENT') { // Ignore file not found
            console.error(`API: Error reading GPU metrics:`, error);
        }
        metrics.gpu = null;
    }

    res.json(metrics);
});

// Start iPerf3 Server
app.get('/api/start-iperf', (req, res) => {
    if (iperfProcess) {
        console.log('API: iPerf3 server already running.');
        return res.status(400).json({ status: 'error', message: 'iPerf3 server already running.' });
    }

    console.log('API: Starting iPerf3 server...');
    iperfProcess = spawn('iperf3', ['-s', '-p', '5201'], {
        cwd: '/workspace',
        stdio: 'pipe'
    });

    iperfProcess.stdout.on('data', (data) => console.log(`iPerf3 stdout: ${data.toString().trim()}`));
    iperfProcess.stderr.on('data', (data) => console.error(`iPerf3 stderr: ${data.toString().trim()}`));

    iperfProcess.on('error', (err) => {
        console.error('API: Failed to start iPerf3 server:', err);
        iperfProcess = null; // Clear reference
        res.status(500).json({ status: 'error', message: 'Failed to start iPerf3 server.' });
    });

    iperfProcess.on('close', (code) => {
        console.log(`API: iPerf3 server process exited (PID: ${iperfProcess?.pid}) with code ${code}.`);
        iperfProcess = null; // Clear reference on exit
    });
    
    iperfProcess.on('spawn', () => {
        console.log(`API: iPerf3 server started (PID: ${iperfProcess.pid}).`);
        res.json({ status: 'started', message: 'iPerf3 server started on port 5201.' });
    });
});

// List Videos
app.get('/api/videos', async (req, res) => { // Use async/await
    console.log('API: Request to list videos.');
    try {
        const files = await fs.readdir(videoDir); // Use await
        const videos = files
            .filter(file => file.endsWith('.mp4'))
            .map(file => ({ name: file }));
        res.json(videos);
    } catch (err) {
        console.error('API: Error reading video directory:', err);
        res.status(500).json({ error: 'Failed to read video directory' }); // Send error status
    }
});

// --- Helper function to parse CSV data (last line) ---
async function parseLastLineCsv(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const lines = data.trim().split('\n');
        if (lines.length < 2) return null; // Need header + at least one data line

        const headers = lines[0].split(',').map(h => h.trim().replace(/[ \s%./[\]()]/g, '')); // Clean headers for keys
        const lastLineValues = lines[lines.length - 1].split(',').map(v => v.trim());

        if (headers.length !== lastLineValues.length) {
            console.warn(`Header/data mismatch in ${filePath}: ${headers.length} vs ${lastLineValues.length}`);
            return null;
        }

        const result = {};
        headers.forEach((header, index) => {
            // Attempt to convert to number if possible
            const value = lastLineValues[index];
            result[header] = isNaN(Number(value)) ? value : Number(value);
        });
        return result;
    } catch (error) {
        if (error.code !== 'ENOENT') { // Ignore file not found initially
            console.error(`Error reading/parsing ${filePath}:`, error);
        }
        return null;
    }
}

// --- Start Server ---
app.listen(8083, () => {
    console.log('Router started on port 8083');
});
