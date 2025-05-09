let metricsIntervalId = null;
let charts = {};

// Helper function to ensure canvas is properly created and sized
function ensureCanvas(id, container, title) {
    let canvas = document.getElementById(id);
    if (!canvas) {
        console.log(`Creating new canvas for ${id}`);
        container.innerHTML += `<div class="chart-container"><h5>${title}</h5><canvas id="${id}" width="800" height="400"></canvas></div>`;
        canvas = document.getElementById(id);
        
        // Force canvas to be visible and sized correctly
        if (canvas) {
            canvas.style.display = 'block';
            canvas.width = 800;
            canvas.height = 400;
        }
    }
    return canvas;
}

function createOrUpdateChart(ctx, chartId, labels, datasets) {
    console.log(`Creating/updating chart: ${chartId}`);
    console.log(`- Labels count: ${labels.length}`);
    console.log(`- Datasets count: ${datasets.length}`);
    
    try {
        if (charts[chartId]) {
            console.log(`Updating existing chart: ${chartId}`);
            charts[chartId].data.labels = labels;
            charts[chartId].data.datasets.forEach((dataset, index) => {
                if (datasets[index]) {
                    dataset.data = datasets[index].data;
                }
            });
            charts[chartId].update('none');
            console.log(`Chart ${chartId} updated successfully`);
        } else {
            console.log(`Creating new chart: ${chartId}`);
            try {
                charts[chartId] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: datasets
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    x: {
                        type: 'time',
                        adapters: {
                            date: { locale: 'en-US', zone: 'America/New_York' }
                        },
                        ticks: { 
                            autoSkip: true, 
                            maxTicksLimit: 10,
                        },
                        time: {
                            unit: 'second',
                            displayFormats: {
                                second: 'HH:mm:ss'
                            },
                            tooltipFormat: 'yyyy-MM-dd HH:mm:ss ZZZZ'
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                },
                animation: false,
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
    }
}

function stopMetricsPolling(message = 'Polling stopped.') {
    if (metricsIntervalId) {
        clearInterval(metricsIntervalId);
        metricsIntervalId = null;
        console.log(message);
    }
}

function updateMetricsDisplay() {
    console.log('Starting metrics update...');
    fetch('/api/metrics')
        .then(response => {
            console.log('Fetch response status:', response.status);
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('Metrics endpoint returned 404, assuming test ended.');
                    document.getElementById('videoStatus').textContent = 'Status: Test ended or metrics unavailable.';
                    stopMetricsPolling('Metrics endpoint 404. Stopping polling.');
                    return null;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(metrics => {
            if (!metrics) {
                console.log('No metrics data received');
                return;
            }
            console.log('Received metrics data structure:', Object.keys(metrics));
            console.log('CPU data present:', !!metrics.cpu);
            console.log('Memory data present:', !!metrics.memory);
            console.log('Disk data present:', !!metrics.disk);
            console.log('GPU data present:', !!metrics.gpu);
            
            if (metrics.cpu) console.log('CPU data keys:', Object.keys(metrics.cpu));
            if (metrics.memory) console.log('Memory data keys:', Object.keys(metrics.memory));
            if (metrics.disk) console.log('Disk data keys:', Object.keys(metrics.disk));
            if (metrics.gpu) console.log('GPU data length:', metrics.gpu.length);
            
            // Full metrics for debugging
            console.log('Received metrics:', JSON.stringify(metrics, null, 2));

            // Destroy all Chart.js instances before removing canvases
            for (const chartId in charts) {
                if (charts[chartId]) {
                    charts[chartId].destroy();
                }
            }
            charts = {};
            const metricsDiv = document.getElementById('systemMetrics');
            metricsDiv.innerHTML = '';

            const timestamps = metrics.cpu?.timestamps || metrics.memory?.timestamps || metrics.disk?.timestamps || metrics.gpu?.[0]?.timestamps || [];
            const luxonTimestamps = timestamps.map(ts => luxon.DateTime.fromISO(ts, { zone: 'utc' }).setZone('America/New_York'));
            const chartLabels = luxonTimestamps.map(dt => dt.valueOf());

            if (metrics.video_test_active === false && metricsIntervalId) {
                document.getElementById('videoStatus').textContent = 'Status: Video generation completed.';
                stopMetricsPolling('Video test finished. Stopping metrics polling.');
            }

            // CPU Chart
            if (metrics.cpu && metrics.cpu.data) {
                console.log('Processing CPU chart data...');
                console.log('CPU data fields:', Object.keys(metrics.cpu.data));
                
                const chartId = 'cpuChart';
                const canvas = ensureCanvas(chartId, metricsDiv, 'CPU Usage (%)');
                
                if (canvas) {
                    try {
                        const datasets = [
                            { label: '%user', data: metrics.cpu.data['user'] || [], borderColor: 'blue', tension: 0.1 },
                            { label: '%system', data: metrics.cpu.data['system'] || [], borderColor: 'red', tension: 0.1 },
                            { label: '%idle', data: metrics.cpu.data['idle'] || [], borderColor: 'green', tension: 0.1 }
                        ];
                        console.log('CPU datasets prepared:', datasets.map(d => ({ label: d.label, dataPoints: d.data.length })));
                        
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            createOrUpdateChart(ctx, chartId, chartLabels, datasets);
                            console.log('CPU chart created/updated');
                        } else {
                            console.error('Failed to get 2D context for CPU canvas');
                        }
                    } catch (err) {
                        console.error('Error creating CPU chart:', err);
                    }
                } else {
                    console.error('Failed to create CPU canvas element');
                }
            } else {
                console.log('CPU data not available for charting');
            }

            // Memory Chart
            if (metrics.memory && metrics.memory.data) {
                console.log('Processing Memory chart data...');
                console.log('Memory data fields:', Object.keys(metrics.memory.data));
                
                const chartId = 'memoryChart';
                const canvas = ensureCanvas(chartId, metricsDiv, 'Memory Usage (% Used)');
                
                if (canvas) {
                    try {
                        const datasets = [
                            { label: '%memused', data: metrics.memory.data['memused'] || [], borderColor: 'purple', tension: 0.1 }
                        ];
                        console.log('Memory datasets prepared:', datasets.map(d => ({ label: d.label, dataPoints: d.data.length })));
                        
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            createOrUpdateChart(ctx, chartId, chartLabels, datasets);
                            console.log('Memory chart created/updated');
                        } else {
                            console.error('Failed to get 2D context for Memory canvas');
                        }
                    } catch (err) {
                        console.error('Error creating Memory chart:', err);
                    }
                } else {
                    console.error('Failed to create Memory canvas element');
                }
            } else {
                console.log('Memory data not available for charting');
            }

            // Disk I/O Chart
            if (metrics.disk && metrics.disk.data) {
                console.log('Processing Disk I/O chart data...');
                console.log('Disk data fields:', Object.keys(metrics.disk.data));
                
                const chartId = 'diskChart';
                const deviceName = metrics.disk.device || 'N/A';
                console.log('Disk device name:', deviceName);
                
                const canvas = ensureCanvas(chartId, metricsDiv, `Disk I/O (kB/s) - ${deviceName}`);
                
                if (canvas) {
                    try {
                        const datasets = [
                            { label: 'Read kB/s', data: metrics.disk.data['rkB_s'] || [], borderColor: 'orange', tension: 0.1 },
                            { label: 'Write kB/s', data: metrics.disk.data['wkB_s'] || [], borderColor: 'brown', tension: 0.1 }
                        ];
                        console.log('Disk datasets prepared:', datasets.map(d => ({ label: d.label, dataPoints: d.data.length })));
                        
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            createOrUpdateChart(ctx, chartId, chartLabels, datasets);
                            console.log('Disk chart created/updated');
                        } else {
                            console.error('Failed to get 2D context for Disk canvas');
                        }
                    } catch (err) {
                        console.error('Error creating Disk chart:', err);
                    }
                } else {
                    console.error('Failed to create Disk canvas element');
                }
            } else {
                console.log('Disk data not available for charting');
            }

            // GPU Charts
            if (metrics.gpu && Array.isArray(metrics.gpu)) {
                metrics.gpu.forEach((gpuData, index) => {
                    console.log(`Processing GPU ${index} chart data...`);
                    
                    const gpuLuxonTimestamps = gpuData.timestamps.map(ts => luxon.DateTime.fromISO(ts, { zone: 'utc' }).setZone('America/New_York'));
                    const gpuChartLabels = gpuLuxonTimestamps.map(dt => dt.valueOf());

                    // GPU Utilization & Memory Chart
                    const utilMemChartId = `gpuUtilMemChart_${index}`;
                    const utilMemCanvas = ensureCanvas(utilMemChartId, metricsDiv, `GPU ${index} Utilization (%) & Memory (MiB)`);
                    
                    if (utilMemCanvas) {
                        try {
                            const utilMemDatasets = [
                                { label: 'Util [%]', data: gpuData.data['utilization_gpu'] || [], borderColor: 'lime', tension: 0.1, yAxisID: 'yPercent' },
                                { label: 'Mem Used [MiB]', data: gpuData.data['memory_used'] || [], borderColor: 'cyan', tension: 0.1, yAxisID: 'yMiB' }
                            ];
                            
                            const utilMemCtx = utilMemCanvas.getContext('2d');
                            if (utilMemCtx) {
                                createOrUpdateChart(utilMemCtx, utilMemChartId, gpuChartLabels, utilMemDatasets);
                                console.log(`GPU ${index} Utilization & Memory chart created/updated`);
                            }
                        } catch (err) {
                            console.error(`Error creating GPU ${index} Utilization & Memory chart:`, err);
                        }
                    }

                    // GPU Temperature & Power Chart
                    const tempPowerChartId = `gpuTempPowerChart_${index}`;
                    const tempPowerCanvas = ensureCanvas(tempPowerChartId, metricsDiv, `GPU ${index} Temp (°C) & Power (W)`);
                    
                    if (tempPowerCanvas) {
                        try {
                            const tempPowerDatasets = [
                                { label: 'Temp [°C]', data: gpuData.data['temperature_gpu'] || [], borderColor: 'magenta', tension: 0.1 },
                                { label: 'Power [W]', data: gpuData.data['power_draw'] || [], borderColor: 'gold', tension: 0.1 }
                            ];
                            
                            const tempPowerCtx = tempPowerCanvas.getContext('2d');
                            if (tempPowerCtx) {
                                createOrUpdateChart(tempPowerCtx, tempPowerChartId, gpuChartLabels, tempPowerDatasets);
                                console.log(`GPU ${index} Temp & Power chart created/updated`);
                            }
                        } catch (err) {
                            console.error(`Error creating GPU ${index} Temp & Power chart:`, err);
                        }
                    }
                });
            }

        })
        .catch(error => {
            console.error('Error fetching metrics:', error);
            document.getElementById('systemMetrics').innerHTML = `Error loading metrics: ${error}. Polling stopped.`;
            stopMetricsPolling();
        });
}

function updateStatus(message) {
    document.getElementById('speedTestStatus').textContent = `Status: ${message}`;
}

async function measurePing(samples = 10) {
    updateStatus('Testing latency...');
    let rtts = [];
    const endpoint = '/api/speedtest/ping';
    for (let i = 0; i < samples; i++) {
        const start = performance.now();
        try {
            await fetch(endpoint, { cache: 'no-store' }); // Prevent caching
            const end = performance.now();
            rtts.push(end - start);
        } catch (e) {
            console.error(`Ping ${i+1} failed:`, e);
            // Optionally skip this sample or throw error
        }
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between pings
    }

    if (rtts.length === 0) throw new Error('Ping test failed completely.');

    rtts.sort((a, b) => a - b);
    const minPing = rtts[0];
    const avgPing = rtts.reduce((a, b) => a + b, 0) / rtts.length;
    
    // Calculate jitter (standard deviation)
    const mean = avgPing;
    const variance = rtts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rtts.length;
    const jitter = Math.sqrt(variance);
    
    document.getElementById('pingResult').textContent = minPing.toFixed(2);
    document.getElementById('jitterResult').textContent = jitter.toFixed(2);
    updateStatus('Latency test complete.');
    return { ping: minPing, jitter: jitter };
}

async function measureDownload(endpoint = '/api/speedtest/download') {
    updateStatus('Testing download speed...');
    const start = performance.now();
    try {
        const response = await fetch(endpoint, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        const data = await response.blob(); // Ensure full download
        const end = performance.now();
        const durationSeconds = (end - start) / 1000;
        const sizeBytes = data.size;
        if (durationSeconds === 0 || sizeBytes === 0) throw new Error('Download test returned no data or took zero time.');
        const speedMbps = (sizeBytes * 8) / (durationSeconds * 1000 * 1000);
        document.getElementById('downloadResult').textContent = speedMbps.toFixed(2);
        updateStatus('Download test complete.');
        return speedMbps;
    } catch (e) {
        document.getElementById('downloadResult').textContent = 'Error';
        throw new Error(`Download test failed: ${e.message}`);
    }
}

async function measureUpload(sizeMB = 10, endpoint = '/api/speedtest/upload') {
    updateStatus('Testing upload speed...');
    const sizeBytes = sizeMB * 1024 * 1024;
    const data = new Blob([new ArrayBuffer(sizeBytes)], {type: 'application/octet-stream'}); // Create blob
    const start = performance.now();
    try {
        const response = await fetch(endpoint, { 
            method: 'POST', 
            body: data, 
            cache: 'no-store' 
        });
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        const end = performance.now();
        const durationSeconds = (end - start) / 1000;
         if (durationSeconds === 0) throw new Error('Upload test took zero time.');
        const speedMbps = (sizeBytes * 8) / (durationSeconds * 1000 * 1000);
        document.getElementById('uploadResult').textContent = speedMbps.toFixed(2);
         updateStatus('Upload test complete.');
        return speedMbps;
    } catch (e) {
        document.getElementById('uploadResult').textContent = 'Error';
        throw new Error(`Upload test failed: ${e.message}`);
    }
}

async function runSpeedTest() {
    document.getElementById('startSpeedTestButton').disabled = true;
    document.getElementById('pingResult').textContent = '---';
    document.getElementById('jitterResult').textContent = '---';
    document.getElementById('downloadResult').textContent = '---';
    document.getElementById('uploadResult').textContent = '---';
    
    try {
        await measurePing();
        await measureDownload();
        await measureUpload();
        updateStatus('Speed test finished.');
    } catch (error) {
        console.error('Speed test error:', error);
        updateStatus(`Test failed: ${error.message}`);
    } finally {
        document.getElementById('startSpeedTestButton').disabled = false;
    }
}

// Fetch videos
async function updateVideoList() {
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

window.addEventListener('DOMContentLoaded', function() {
    console.log('DOM content loaded, initializing dashboard...');
    
    // Add event listener for speed test button
    const speedTestButton = document.getElementById('startSpeedTestButton');
    if (speedTestButton) {
        speedTestButton.addEventListener('click', runSpeedTest);
        console.log('Speed test button event listener attached');
    } else {
        console.error('Speed test button not found in DOM');
    }
    
    // Start metrics polling
    console.log('Starting metrics polling...');
    updateMetricsDisplay(); // Initial update
    metricsIntervalId = setInterval(updateMetricsDisplay, 3000);
    
    // Start video list polling
    console.log('Starting video list polling...');
    updateVideoList(); // Initial update
    setInterval(updateVideoList, 30000);
    
    console.log('Dashboard initialization complete');
});
