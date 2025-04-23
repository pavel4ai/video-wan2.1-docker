const express = require('express');
const httpProxy = require('http-proxy');
const { spawn } = require('child_process');
const app = express();
const path = require('path');
const fs = require('fs');

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
                </style>
            </head>
            <body>
                <h1>Test Control Panel</h1>
                <div>
                    <h2>Video Generation Tests</h2>
                    <button onclick="startVideoTest()">Start Video Generation Test</button>
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
                    <button onclick="startIperfServer()">Start iPerf3 Server</button>
                    <div id="networkStatus" class="status">Status: Ready</div>
                    <div id="networkResults" class="test-results"></div>
                </div>
                <div>
                    <h2>Monitoring</h2>
                    <iframe src="/grafana" style="width:100%;height:600px;border:none;"></iframe>
                </div>
                <div>
                    <h2>Generated Videos</h2>
                    <div id="videoList" class="video-list"></div>
                </div>

                <script>
                    function startVideoTest() {
                        document.getElementById('videoStatus').textContent = 'Status: Starting video generation...';
                        fetch('/api/start-video-test')
                            .then(response => response.text())
                            .then(text => {
                                document.getElementById('videoStatus').textContent = 'Status: ' + text;
                            })
                            .catch(error => {
                                document.getElementById('videoStatus').textContent = 'Status: Error - ' + error;
                            });
                    }

                    function startIperfServer() {
                        document.getElementById('networkStatus').textContent = 'Status: Starting iPerf3 server...';
                        fetch('/api/start-iperf')
                            .then(response => response.text())
                            .then(text => {
                                document.getElementById('networkStatus').textContent = 'Status: ' + text;
                            })
                            .catch(error => {
                                document.getElementById('networkStatus').textContent = 'Status: Error - ' + error;
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
    const videoProcess = spawn('python', ['/workspace/scripts/video_generation_test.py'], {
        cwd: '/workspace'
    });

    videoProcess.stdout.on('data', (data) => {
        console.log(`Video generation output: ${data}`);
    });

    videoProcess.stderr.on('data', (data) => {
        console.error(`Video generation error: ${data}`);
    });

    videoProcess.on('close', (code) => {
        console.log(`Video generation process exited with code ${code}`);
    });

    res.send('Video generation test started');
});

app.get('/api/start-iperf', (req, res) => {
    const iperfProcess = spawn('iperf3', ['-s', '-p', '5201'], {
        cwd: '/workspace'
    });

    iperfProcess.stdout.on('data', (data) => {
        console.log(`iperf output: ${data}`);
    });

    iperfProcess.stderr.on('data', (data) => {
        console.error(`iperf error: ${data}`);
    });

    res.send('iPerf3 server started on port 5201. You can now run client tests using the instructions above.');
});

app.get('/api/videos', (req, res) => {
    const videoDir = '/workspace/data/videos';
    fs.readdir(videoDir, (err, files) => {
        if (err) {
            console.error('Error reading video directory:', err);
            res.json([]);
            return;
        }
        const videos = files
            .filter(file => file.endsWith('.mp4'))
            .map(file => ({ name: file }));
        res.json(videos);
    });
});

app.listen(8083, () => {
    console.log('Router started on port 8083');
});
