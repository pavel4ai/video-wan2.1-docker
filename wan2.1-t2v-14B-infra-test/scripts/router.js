const express = require('express');
const { spawn } = require('child_process');
const app = express();
const path = require('path');
const fs = require('fs').promises; // Use promises version for async/await

let iperfProcess = null;
const NUM_DATAPOINTS = 60; // Number of data points to return for charts

// Serve generated videos
const videoDir = path.join('/workspace', 'data', 'videos');
app.use('/videos', express.static(videoDir));

// Serve static files from 'public' directory (for index.html, css, js)
app.use(express.static(path.join(__dirname, 'public')));

// Basic UI route (now handled by express.static, but keeping explicit for clarity/fallback)
app.get('/', async (req, res) => {
    try {
        const htmlPath = path.join(__dirname, 'public', 'index.html');
        await fs.access(htmlPath); // Check if file exists
        res.sendFile(htmlPath);
    } catch (error) {
        console.error("Error serving index.html:", error);
        res.status(500).send("Error loading UI. Please check server logs.");
    }
});

// API endpoints
app.get('/api/metrics', async (req, res) => {
    console.log('API: Received /api/metrics request.');
    const metrics = {
        cpu: null,
        memory: null,
        disk: null,
        gpu: null
    };

    try {
        console.log('API: Attempting to read CPU metrics...');
        metrics.cpu = await parseLastNLinesCsv('/workspace/data/metrics/cpu_usage.csv', NUM_DATAPOINTS);
        console.log('API: CPU metrics result:', metrics.cpu ? `${metrics.cpu.timestamps?.length || 0} points` : 'null');

        console.log('API: Attempting to read Memory metrics...');
        metrics.memory = await parseLastNLinesCsv('/workspace/data/metrics/memory_usage.csv', NUM_DATAPOINTS);
        console.log('API: Memory metrics result:', metrics.memory ? `${metrics.memory.timestamps?.length || 0} points` : 'null');

        // Disk requires extracting device name from header
        console.log('API: Attempting to read Disk metrics...');
        const diskRaw = await parseLastNLinesCsv('/workspace/data/metrics/disk_io.csv', NUM_DATAPOINTS);
        console.log('API: Raw Disk metrics result:', diskRaw ? `${diskRaw.timestamps?.length || 0} points` : 'null');
        if (diskRaw && diskRaw.headers.length > 0) {
            let deviceName = 'unknown';
            const deviceHeader = diskRaw.headers.find(h => h.includes('(device:'));
             if (deviceHeader) {
                const match = deviceHeader.match(/\\(device: (.*?)\\)/);
                if (match && match[1]) {
                    deviceName = match[1];
                }
            }
            metrics.disk = { ...diskRaw, device: deviceName }; // Add device name
        } else {
             metrics.disk = diskRaw; // Keep null or parsed data without device
        }

        // GPU requires grouping by GPU index
        console.log('API: Attempting to read GPU metrics...');
        const gpuRaw = await parseLastNLinesCsv('/workspace/data/metrics/gpu_metrics.csv', NUM_DATAPOINTS * 4); // Read more lines initially to ensure we capture all GPUs in last N samples
        console.log('API: Raw GPU metrics result:', gpuRaw ? `${gpuRaw.timestamps?.length || 0} points` : 'null');
        
        // Debug the actual headers and field names
        if (gpuRaw) {
            console.log('API: GPU CSV headers:', gpuRaw.headers);
            console.log('API: GPU data fields:', Object.keys(gpuRaw.data));
            // Log a sample data point for each field
            Object.keys(gpuRaw.data).forEach(field => {
                if (gpuRaw.data[field].length > 0) {
                    console.log(`API: Sample value for ${field}:`, gpuRaw.data[field][0]);
                }
            });
        }
        if (gpuRaw && gpuRaw.data['gpu_index']) {
             const numGpus = Math.max(...gpuRaw.data['gpu_index']) + 1; // Find highest index + 1
             const numSamples = gpuRaw.data['gpu_index'].length;
             const groupedGpu = Array.from({ length: numGpus }, () => ({
                 timestamps: [],
                 data: {}
             }));

             // Initialize data arrays for each GPU header
             gpuRaw.headers.forEach(header => {
                 if (header !== 'timestamp' && header !== 'gpu_index') {
                     groupedGpu.forEach(gpu => gpu.data[header] = []);
                 }
             });

             // Iterate through the raw samples in reverse to get the last N for *each* GPU
             const samplesPerGpu = Array(numGpus).fill(0);
             for (let i = numSamples - 1; i >= 0 && samplesPerGpu.some(count => count < NUM_DATAPOINTS); i--) {
                 const index = gpuRaw.data['gpu_index'][i];
                 if (samplesPerGpu[index] < NUM_DATAPOINTS) {
                    groupedGpu[index].timestamps.unshift(gpuRaw.timestamps[i]); // Add to beginning
                     gpuRaw.headers.forEach(header => {
                         if (header !== 'timestamp' && header !== 'gpu_index') {
                            groupedGpu[index].data[header].unshift(gpuRaw.data[header][i]); // Add to beginning
                         }
                     });
                    samplesPerGpu[index]++;
                 }
             }
             metrics.gpu = groupedGpu.map((gpu, index) => ({ ...gpu, gpu_index: index, headers: gpuRaw.headers.filter(h => h !== 'timestamp' && h !== 'gpu_index') }));
        }

    } catch (error) {
        console.error("API: Error fetching/parsing metrics data:", error);
        // Allow partial results if some files fail
    }

    console.log(`API: Sending metrics response (CPU: ${!!metrics.cpu}, Mem: ${!!metrics.memory}, Disk: ${!!metrics.disk}, GPU: ${Array.isArray(metrics.gpu) ? metrics.gpu.length : 'null'})`);
    res.json(metrics);
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

// --- Speed Test Endpoints ---

// Simple ping endpoint
app.get('/api/speedtest/ping', (req, res) => {
    res.sendStatus(200); // Respond immediately
});

// Download endpoint - streams a fixed amount of data
const DOWNLOAD_SIZE_MB = 50;
const DOWNLOAD_CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const DOWNLOAD_TOTAL_SIZE = DOWNLOAD_SIZE_MB * 1024 * 1024;
app.get('/api/speedtest/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', DOWNLOAD_TOTAL_SIZE);
    // Prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const chunk = Buffer.alloc(DOWNLOAD_CHUNK_SIZE, '0'); // Efficiently create a buffer of zeros
    let bytesSent = 0;

    function sendChunk() {
        if (bytesSent >= DOWNLOAD_TOTAL_SIZE) {
            res.end();
            return;
        }

        const remaining = DOWNLOAD_TOTAL_SIZE - bytesSent;
        const sizeToSend = Math.min(DOWNLOAD_CHUNK_SIZE, remaining);
        const chunkToSend = (sizeToSend === DOWNLOAD_CHUNK_SIZE) ? chunk : Buffer.alloc(sizeToSend, '0');

        if (res.write(chunkToSend)) {
            bytesSent += sizeToSend;
            // If write buffer is not full, continue immediately (or use setImmediate for fairness)
            setImmediate(sendChunk); 
        } else {
            // If write buffer is full, wait for drain event
            bytesSent += sizeToSend;
            res.once('drain', sendChunk);
        }
    }

    sendChunk(); // Start sending
});

// Upload endpoint - receives data and discards it
app.post('/api/speedtest/upload', (req, res) => {
    let bytesReceived = 0;
    req.on('data', (chunk) => {
        bytesReceived += chunk.length;
        // Do nothing with the chunk, just count it
    });
    req.on('end', () => {
        console.log(`Speed Test: Upload received ${bytesReceived} bytes.`);
        res.sendStatus(200);
    });
    req.on('error', (err) => {
        console.error('Speed Test: Upload error:', err);
        res.status(500).send('Upload error');
    });
});

// --- Helper function to parse last N lines of CSV data ---
async function parseLastNLinesCsv(filePath, N) {
    console.log(`Helper: Reading ${filePath}`);
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const lines = data.trim().split('\n');
        if (lines.length < 2) return null; // Need header + at least one data line

        // Clean headers once
        const headers = lines[0].split(',').map(h => h.trim().replace(/^%/, '').replace(/[ \s%./[\]()]/g, '_')); // Clean headers for keys, remove leading %

        const dataLines = lines.slice(1); // Get only data lines
        const startIndex = Math.max(0, dataLines.length - N); // Ensure start index is not negative
        const lastNLines = dataLines.slice(startIndex);

        const result = {
            timestamps: [],
            headers: headers.filter(h => h !== 'timestamp'), // Exclude timestamp from data headers
            data: {}
        };
        // Initialize data arrays
        result.headers.forEach(header => result.data[header] = []);

        lastNLines.forEach(line => {
            const values = line.split(',').map(v => v.trim());
            if (headers.length === values.length) {
                 let timestamp = '';
                 headers.forEach((header, index) => {
                     const value = values[index];
                     if (header === 'timestamp') {
                         timestamp = value; // Store timestamp
                     } else {
                         // Attempt to convert to number if possible
                         result.data[header].push(isNaN(Number(value)) ? value : Number(value));
                     }
                 });
                result.timestamps.push(timestamp); // Push timestamp corresponding to the data row
            } else {
                 console.warn(`Skipping malformed line in ${filePath}: Header count (${headers.length}) != Value count (${values.length})`);
            }
        });

        return result;
    } catch (error) {
        if (error.code !== 'ENOENT') { // Ignore file not found initially
            console.error(`Helper: Error reading/parsing ${filePath}:`, error.message);
        }
        return null; // Return null if file doesn't exist or parsing fails
    }
}

// --- Start Server ---
const PORT = 8083; // Keep router on its own port
app.listen(PORT, () => {
    console.log(`Router started on port ${PORT}`);
});

// Graceful shutdown (only managing iperfProcess now)
process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down...');
    process.exit(0);
});
