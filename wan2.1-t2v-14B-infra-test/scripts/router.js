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
app.get('/', async (req, res) => { // Make async to read file
    try {
        const html = await fs.readFile(path.join(__dirname, 'public', 'index.html'), 'utf-8');
        res.type('html').send(html);
    } catch (error) {
        console.error("Error reading index.html:", error);
        res.status(500).send("Error loading UI. Please check server logs.");
    }
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
