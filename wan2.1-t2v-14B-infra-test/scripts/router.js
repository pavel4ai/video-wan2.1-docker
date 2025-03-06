const express = require('express');
const httpProxy = require('http-proxy');
const app = express();
const proxy = httpProxy.createProxyServer();

// Basic UI for test control and monitoring
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>Wan2.1 Infrastructure Test Suite</title></head>
            <body>
                <h1>Test Control Panel</h1>
                <div>
                    <h2>Video Generation Tests</h2>
                    <button onclick="fetch('/api/start-video-test')">Start Video Tests</button>
                    <div id="videoStatus"></div>
                </div>
                <div>
                    <h2>Network Tests</h2>
                    <button onclick="fetch('/api/start-iperf')">Start iPerf3 Test</button>
                    <div id="networkStatus"></div>
                </div>
                <div>
                    <h2>Monitoring</h2>
                    <iframe src="/grafana" style="width:100%;height:600px;border:none;"></iframe>
                </div>
                <div>
                    <h2>Generated Videos</h2>
                    <div id="videoList"></div>
                </div>
            </body>
        </html>
    `);
});

// Route /metrics to Prometheus
app.use('/metrics', (req, res) => {
    proxy.web(req, res, { target: 'http://localhost:9090' });
});

// Route /grafana to Grafana
app.use('/grafana', (req, res) => {
    proxy.web(req, res, { target: 'http://localhost:3000' });
});

// Route /stream to NGINX for video streaming
app.use('/stream', (req, res) => {
    proxy.web(req, res, { target: 'http://localhost:8081' });
});

app.listen(8080, () => {
    console.log('Router started on port 8080');
});
