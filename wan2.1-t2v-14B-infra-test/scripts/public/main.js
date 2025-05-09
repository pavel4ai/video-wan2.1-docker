// Global variables
let metricsIntervalId = null;
let charts = {};

// Store historical data for 60 minutes
// Assuming data points come in every 3 seconds, we need to store 1200 points (60*60/3)
const MAX_DATA_POINTS = 1200;
let historicalData = {
    timestamps: [],
    cpu: { data: {} },
    memory: { data: {} },
    disk: { data: {} },
    gpu: []
};

// Helper function to get minimum time for x-axis display (60 minutes ago)
function getMinTimeForDisplay() {
    if (historicalData.timestamps.length === 0) {
        // If no data yet, show from 60 minutes ago from now
        return Date.now() - (60 * 60 * 1000);
    }
    
    // If we have data but less than 60 minutes worth, show from 60 minutes ago from the latest timestamp
    const latestTimestamp = getMaxTimeForDisplay();
    return latestTimestamp - (60 * 60 * 1000);
}

// Helper function to get maximum time for x-axis display (now or latest data point)
function getMaxTimeForDisplay() {
    if (historicalData.timestamps.length === 0) {
        return Date.now();
    }
    
    // Get the latest timestamp from our data
    const latestIsoTimestamp = historicalData.timestamps[historicalData.timestamps.length - 1];
    
    // Convert to milliseconds timestamp
    let latestTimestamp;
    if (typeof luxon !== 'undefined') {
        latestTimestamp = luxon.DateTime.fromISO(latestIsoTimestamp, { zone: 'utc' })
            .setZone('America/New_York').valueOf();
    } else {
        latestTimestamp = new Date(latestIsoTimestamp).getTime();
    }
    
    return latestTimestamp;
}

// Simple logger for important events
function log(message) {
    console.log(`[INFO] ${message}`);
}

// Initialize the dashboard when the DOM is loaded
window.addEventListener('DOMContentLoaded', function() {
    log('Initializing dashboard');
    
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded! Charts will not render.');
        document.getElementById('systemMetrics').innerHTML = '<div style="color:red">Error: Chart.js library not loaded</div>';
        return;
    }
    
    // Add event listener for speed test button
    const speedTestButton = document.getElementById('startSpeedTestButton');
    if (speedTestButton) {
        speedTestButton.addEventListener('click', runSpeedTest);
        log('Speed test button event listener attached');
    } else {
        console.error('Speed test button not found in DOM');
    }
    
    // Start metrics polling
    log('Starting metrics polling...');
    updateMetricsDisplay(); // Initial update
    metricsIntervalId = setInterval(updateMetricsDisplay, 3000);
    
    // Start video list polling
    log('Starting video list polling...');
    updateVideoList(); // Initial update
    setInterval(updateVideoList, 30000);
    
    log('Dashboard initialization complete');
});

// Create or update a chart
function createOrUpdateChart(canvasId, chartType, labels, datasets, options) {
    // Get the canvas element
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas element with ID ${canvasId} not found`);
        return null;
    }
    
    // Get the 2D context
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error(`Could not get 2D context for canvas ${canvasId}`);
        return null;
    }
    
    // Create or update the chart
    if (charts[canvasId]) {
        charts[canvasId].data.labels = labels;
        charts[canvasId].data.datasets = datasets;
        charts[canvasId].update();
        return charts[canvasId];
    } else {
        try {
            charts[canvasId] = new Chart(ctx, {
                type: chartType,
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: options || {
                    responsive: true,
                    maintainAspectRatio: true,
                    animation: {
                        duration: 0 // Disable animations for better performance with large datasets
                    }
                }
            });
            return charts[canvasId];
        } catch (error) {
            console.error(`Error creating chart ${canvasId}:`, error);
            return null;
        }
    }
}

// Create a canvas element
function createCanvas(containerId, canvasId, title) {
    // Get the container element
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container element with ID ${containerId} not found`);
        return null;
    }
    
    // Check if canvas already exists
    let canvas = document.getElementById(canvasId);
    if (canvas) {
        return canvas;
    }
    
    // Create a new div for the chart
    const chartDiv = document.createElement('div');
    chartDiv.className = 'chart-container';
    
    // Add a title if provided
    if (title) {
        const titleElement = document.createElement('h5');
        titleElement.textContent = title;
        chartDiv.appendChild(titleElement);
    }
    
    // Create the canvas element
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.width = 800;
    canvas.height = 400;
    canvas.style.display = 'block';
    
    // Add the canvas to the chart div
    chartDiv.appendChild(canvas);
    
    // Add the chart div to the container
    container.appendChild(chartDiv);
    
    return canvas;
}

// Update the metrics display
function updateMetricsDisplay() {
    fetch('/api/metrics')
        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    document.getElementById('videoStatus').textContent = 'Status: Test ended or metrics unavailable.';
                    stopMetricsPolling('Metrics endpoint 404. Stopping polling.');
                    return null;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return response.json();
        })
        .then(metrics => {
            // Debug log the raw metrics data
            console.log('Raw metrics data:', metrics);
            
            if (!metrics) {
                return;
            }
            
            // Specifically debug GPU data
            if (metrics.gpu) {
                console.log('GPU data available:', metrics.gpu.length, 'GPUs');
                metrics.gpu.forEach((gpu, index) => {
                    console.log(`GPU ${index} data:`, gpu);
                    if (gpu.data) {
                        console.log(`GPU ${index} data fields:`, Object.keys(gpu.data));
                        Object.keys(gpu.data).forEach(key => {
                            console.log(`GPU ${index} ${key} data points:`, gpu.data[key].length);
                            // Log a sample value to verify data format
                            if (gpu.data[key].length > 0) {
                                console.log(`GPU ${index} ${key} sample value:`, gpu.data[key][0]);
                            }
                        });
                    } else {
                        console.log(`GPU ${index} has no data object`);
                    }
                });
            } else {
                console.log('No GPU data available in metrics');
            }
            // Update historical data with new metrics
            updateHistoricalData(metrics);
            
            // If we don't have any data yet, don't try to create charts
            if (historicalData.timestamps.length === 0) {
                return;
            }
            
            // Debug log historical data
            console.log('Historical data timestamps:', historicalData.timestamps.length);
            if (historicalData.gpu && historicalData.gpu.length > 0) {
                console.log('Historical GPU data:');
                historicalData.gpu.forEach((gpu, index) => {
                    if (gpu.data) {
                        console.log(`Historical GPU ${index} data fields:`, Object.keys(gpu.data));
                        Object.keys(gpu.data).forEach(key => {
                            console.log(`Historical GPU ${index} ${key} data points:`, gpu.data[key].length);
                        });
                    }
                });
            }
            
            // Get the metrics div
            const metricsDiv = document.getElementById('systemMetrics');
            if (!metricsDiv) {
                console.error('systemMetrics div not found');
                return;
            }
            
            // Clear existing charts
            for (const chartId in charts) {
                if (charts[chartId]) {
                    charts[chartId].destroy();
                }
            }
            charts = {};
            metricsDiv.innerHTML = '';
            
            // Use historical data for chart labels
            let chartLabels = [];
            if (typeof luxon !== 'undefined') {
                try {
                    chartLabels = historicalData.timestamps.map(ts => 
                        luxon.DateTime.fromISO(ts, { zone: 'utc' }).setZone('America/New_York').valueOf()
                    );
                } catch (error) {
                    console.error('Error converting timestamps with luxon:', error);
                    chartLabels = historicalData.timestamps;
                }
            } else {
                chartLabels = historicalData.timestamps;
            }
            
            // Check if test is active
            if (metrics.video_test_active === false && metricsIntervalId) {
                document.getElementById('videoStatus').textContent = 'Status: Video generation completed.';
                stopMetricsPolling('Video test finished. Stopping metrics polling.');
            }
            
            // Create charts for each metric type
            createMetricsCharts(metricsDiv, metrics, chartLabels);
        })
        .catch(error => {
            console.error('Error fetching metrics:', error);
            document.getElementById('systemMetrics').innerHTML = `<div style="color:red">Error loading metrics: ${error.message}</div>`;
            stopMetricsPolling();
        });
}

// Function to update historical data with new metrics
function updateHistoricalData(metrics) {
    // Check if we need to clear historical data (for testing)
    if (metrics.reset_historical_data) {
        historicalData = {
            timestamps: [],
            cpu: { data: {} },
            memory: { data: {} },
            disk: { data: {} },
            gpu: []
        };
        return;
    }
    
    // Add new timestamps
    let newTimestamps = [];
    if (metrics.cpu && metrics.cpu.timestamps) {
        newTimestamps = metrics.cpu.timestamps;
    } else if (metrics.memory && metrics.memory.timestamps) {
        newTimestamps = metrics.memory.timestamps;
    } else if (metrics.disk && metrics.disk.timestamps) {
        newTimestamps = metrics.disk.timestamps;
    } else if (metrics.gpu && metrics.gpu[0] && metrics.gpu[0].timestamps) {
        newTimestamps = metrics.gpu[0].timestamps;
    }
    
    // Skip if no new timestamps
    if (newTimestamps.length === 0) {
        return;
    }
    
    // Check for duplicates to avoid overlapping data
    const lastTimestamp = historicalData.timestamps.length > 0 ? 
        historicalData.timestamps[historicalData.timestamps.length - 1] : null;
    
    // Find the index of the first new timestamp that's after our last timestamp
    let startIndex = 0;
    if (lastTimestamp) {
        startIndex = newTimestamps.findIndex(ts => ts > lastTimestamp);
        if (startIndex === -1) {
            // All new timestamps are older or equal to our last one, skip them
            return;
        }
    }
    
    // Add only new timestamps to historical data
    const filteredTimestamps = newTimestamps.slice(startIndex);
    historicalData.timestamps = [...historicalData.timestamps, ...filteredTimestamps];
    
    // Helper function to update data for a specific metric type
    const updateMetricData = (metricData, historicalMetricData) => {
        if (!metricData) return;
        
        Object.keys(metricData).forEach(key => {
            if (!historicalMetricData[key]) {
                historicalMetricData[key] = [];
            }
            
            // Only add data points corresponding to the filtered timestamps
            const newData = metricData[key].slice(startIndex);
            historicalMetricData[key] = [...historicalMetricData[key], ...newData];
        });
    };
    
    // Update CPU data
    if (metrics.cpu && metrics.cpu.data) {
        updateMetricData(metrics.cpu.data, historicalData.cpu.data);
    }
    
    // Update Memory data
    if (metrics.memory && metrics.memory.data) {
        updateMetricData(metrics.memory.data, historicalData.memory.data);
    }
    
    // Update Disk data
    if (metrics.disk && metrics.disk.data) {
        updateMetricData(metrics.disk.data, historicalData.disk.data);
    }
    
    // Update GPU data
    if (metrics.gpu && Array.isArray(metrics.gpu)) {
        console.log('Updating GPU data for', metrics.gpu.length, 'GPUs');
        
        // Initialize GPU array if needed
        while (historicalData.gpu.length < metrics.gpu.length) {
            historicalData.gpu.push({ data: {} });
        }
        
        // Update each GPU's data
        metrics.gpu.forEach((gpuData, index) => {
            if (gpuData.data) {
                console.log(`Updating GPU ${index} data with fields:`, Object.keys(gpuData.data));
                updateMetricData(gpuData.data, historicalData.gpu[index].data);
                
                // Verify data was updated
                console.log(`After update, GPU ${index} data fields:`, Object.keys(historicalData.gpu[index].data));
                Object.keys(historicalData.gpu[index].data).forEach(key => {
                    console.log(`GPU ${index} ${key} now has ${historicalData.gpu[index].data[key].length} data points`);
                });
            } else {
                console.log(`GPU ${index} has no data object`);
            }
        });
    } else {
        console.log('No GPU data to update');
    }
    
    // Trim data to keep only the last 60 minutes (MAX_DATA_POINTS)
    if (historicalData.timestamps.length > MAX_DATA_POINTS) {
        const excess = historicalData.timestamps.length - MAX_DATA_POINTS;
        historicalData.timestamps = historicalData.timestamps.slice(excess);
        
        // Helper function to trim data arrays
        const trimData = (dataObj) => {
            Object.keys(dataObj).forEach(key => {
                if (dataObj[key].length > MAX_DATA_POINTS) {
                    dataObj[key] = dataObj[key].slice(excess);
                }
            });
        };
        
        // Trim all data
        trimData(historicalData.cpu.data);
        trimData(historicalData.memory.data);
        trimData(historicalData.disk.data);
        historicalData.gpu.forEach(gpu => trimData(gpu.data));
    }
}

// Create charts for each metric type
function createMetricsCharts(container, metrics, chartLabels) {
    // CPU Chart
    if (historicalData.cpu.data && Object.keys(historicalData.cpu.data).length > 0) {
        
        const canvasId = 'cpuChart';
        createCanvas('systemMetrics', canvasId, 'CPU Usage (%) - Last 60 Minutes');
        
        const datasets = [
            { label: '%user', data: historicalData.cpu.data['user'] || [], borderColor: 'blue', tension: 0.1 },
            { label: '%system', data: historicalData.cpu.data['system'] || [], borderColor: 'red', tension: 0.1 },
            { label: '%idle', data: historicalData.cpu.data['idle'] || [], borderColor: 'green', tension: 0.1 }
        ];
        
        const options = {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        displayFormats: {
                            minute: 'HH:mm'
                        }
                    },
                    min: getMinTimeForDisplay(),
                    max: getMaxTimeForDisplay()
                },
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: { position: 'top' }
            }
        };
        
        createOrUpdateChart(canvasId, 'line', chartLabels, datasets, options);
    }
    
    // Memory Chart
    if (historicalData.memory.data && Object.keys(historicalData.memory.data).length > 0) {
        
        const canvasId = 'memoryChart';
        createCanvas('systemMetrics', canvasId, 'Memory Usage (% Used) - Last 60 Minutes');
        
        const datasets = [
            { label: '%memused', data: historicalData.memory.data['memused'] || [], borderColor: 'purple', tension: 0.1 }
        ];
        
        const options = {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        displayFormats: {
                            minute: 'HH:mm'
                        }
                    },
                    min: getMinTimeForDisplay(),
                    max: getMaxTimeForDisplay()
                },
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: { position: 'top' }
            }
        };
        
        createOrUpdateChart(canvasId, 'line', chartLabels, datasets, options);
    }
    
    // Disk I/O Chart
    if (historicalData.disk.data && Object.keys(historicalData.disk.data).length > 0) {
        
        const canvasId = 'diskChart';
        const deviceName = metrics.disk ? metrics.disk.device : 'N/A';
        createCanvas('systemMetrics', canvasId, `Disk I/O (kB/s) - ${deviceName} - Last 60 Minutes`);
        
        const datasets = [
            { label: 'Read kB/s', data: historicalData.disk.data['rkB_s'] || [], borderColor: 'orange', tension: 0.1 },
            { label: 'Write kB/s', data: historicalData.disk.data['wkB_s'] || [], borderColor: 'brown', tension: 0.1 }
        ];
        
        const options = {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        displayFormats: {
                            minute: 'HH:mm'
                        }
                    },
                    min: getMinTimeForDisplay(),
                    max: getMaxTimeForDisplay()
                },
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: { position: 'top' }
            }
        };
        
        createOrUpdateChart(canvasId, 'line', chartLabels, datasets, options);
    }
    
    // GPU Charts
    if (historicalData.gpu && historicalData.gpu.length > 0) {
        console.log('Creating GPU charts for', historicalData.gpu.length, 'GPUs');
        
        historicalData.gpu.forEach((gpuData, index) => {
            console.log(`Creating charts for GPU ${index}`);
            console.log(`GPU ${index} data fields:`, gpuData.data ? Object.keys(gpuData.data) : 'No data');
            
            // Skip if no data available for this GPU
            if (!gpuData.data || Object.keys(gpuData.data).length === 0) {
                console.log(`No data available for GPU ${index}, skipping charts`);
                return;
            }
            
            console.log(`GPU ${index} has data with ${Object.keys(gpuData.data).length} fields`);
            // Debug the first data point for each field
            Object.keys(gpuData.data).forEach(field => {
                if (gpuData.data[field] && gpuData.data[field].length > 0) {
                    console.log(`GPU ${index} field ${field} first value:`, gpuData.data[field][0]);
                }
            });
            
            // GPU Utilization & Memory Chart
            const utilMemCanvasId = `gpuUtilMemChart_${index}`;
            createCanvas('systemMetrics', utilMemCanvasId, `GPU ${index} Utilization (%) & Memory (MiB) - Last 60 Minutes`);
            
            // Find the field names for utilization and memory
            // Try multiple patterns to increase chances of finding the right field
            const utilizationField = findField('utilization') || 
                                    findField('gpu__') || 
                                    findField('util');
                                    
            const memoryUsedField = findField('memory.used') || 
                                  findField('memory_used') || 
                                  findField('mem') || 
                                  findField('used');
            
            const hasUtilData = utilizationField && gpuData.data[utilizationField].length > 0;
            const hasMemData = memoryUsedField && gpuData.data[memoryUsedField].length > 0;
            
            // Debug available fields
            console.log(`Available GPU ${index} data fields:`, Object.keys(gpuData.data));
            
            // Helper function to find the closest matching field name
            function findField(pattern) {
                const fields = Object.keys(gpuData.data || {});
                if (!fields.length) {
                    console.log(`No fields available to match pattern: ${pattern}`);
                    return null;
                }
                
                console.log(`Searching for field matching '${pattern}' among:`, fields);
                
                // Try exact match first
                const exactMatch = fields.find(f => f === pattern);
                if (exactMatch) {
                    console.log(`Found exact match for '${pattern}': ${exactMatch}`);
                    return exactMatch;
                }
                
                // Try contains match
                const containsMatch = fields.find(f => f.includes(pattern));
                if (containsMatch) {
                    console.log(`Found contains match for '${pattern}': ${containsMatch}`);
                    return containsMatch;
                }
                
                // Try regex pattern match
                try {
                    const regex = new RegExp(pattern.replace('.', '\\.').
                        replace('[', '\\[').replace(']', '\\]'));
                    const regexMatch = fields.find(f => regex.test(f));
                    if (regexMatch) {
                        console.log(`Found regex match for '${pattern}': ${regexMatch}`);
                        return regexMatch;
                    }
                } catch (e) {
                    console.error(`Invalid regex pattern: ${pattern}`, e);
                }
                
                console.log(`No match found for '${pattern}'`);
                return null;
            }
            
            console.log(`GPU ${index} utilization data available:`, hasUtilData);
            console.log(`GPU ${index} memory data available:`, hasMemData);
            
            const utilMemDatasets = [];
            
            if (hasUtilData) {
                utilMemDatasets.push({ 
                    label: 'Util [%]', 
                    data: gpuData.data[utilizationField], 
                    borderColor: 'lime', 
                    tension: 0.1, 
                    yAxisID: 'yPercent' 
                });
            }
            
            if (hasMemData) {
                utilMemDatasets.push({ 
                    label: 'Mem Used [MiB]', 
                    data: gpuData.data[memoryUsedField], 
                    borderColor: 'cyan', 
                    tension: 0.1, 
                    yAxisID: 'yMiB' 
                });
            }
            
            // Only create chart if we have datasets
            if (utilMemDatasets.length === 0) {
                console.log(`No utilization or memory data for GPU ${index}, skipping chart`);
            } else {
                console.log(`Creating GPU ${index} utilization/memory chart with ${utilMemDatasets.length} datasets`);
            
            const utilMemOptions = {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'minute',
                            displayFormats: {
                                minute: 'HH:mm'
                            }
                        },
                        min: getMinTimeForDisplay(),
                        max: getMaxTimeForDisplay()
                    },
                    yPercent: {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Utilization (%)'
                        }
                    },
                    yMiB: {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Memory (MiB)'
                        }
                    }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            };
            
            createOrUpdateChart(utilMemCanvasId, 'line', chartLabels, utilMemDatasets, utilMemOptions);
            }
            
            // GPU Temperature & Power Chart
            const tempPowerCanvasId = `gpuTempPowerChart_${index}`;
            createCanvas('systemMetrics', tempPowerCanvasId, `GPU ${index} Temp (°C) & Power (W) - Last 60 Minutes`);
            
            // Find the field names for temperature and power
            const temperatureField = findField('temperature') || 
                                   findField('temp') || 
                                   findField('C_');
                                   
            const powerField = findField('power') || 
                            findField('draw') || 
                            findField('W_');
            
            const hasTempData = temperatureField && gpuData.data[temperatureField].length > 0;
            const hasPowerData = powerField && gpuData.data[powerField].length > 0;
            
            console.log(`GPU ${index} temperature data available:`, hasTempData);
            console.log(`GPU ${index} power data available:`, hasPowerData);
            
            const tempPowerDatasets = [];
            
            if (hasTempData) {
                tempPowerDatasets.push({ 
                    label: 'Temp [°C]', 
                    data: gpuData.data[temperatureField], 
                    borderColor: 'magenta', 
                    tension: 0.1 
                });
            }
            
            if (hasPowerData) {
                tempPowerDatasets.push({ 
                    label: 'Power [W]', 
                    data: gpuData.data[powerField], 
                    borderColor: 'gold', 
                    tension: 0.1 
                });
            }
            
            // Only create chart if we have datasets
            if (tempPowerDatasets.length === 0) {
                console.log(`No temperature or power data for GPU ${index}, skipping chart`);
            } else {
                const tempPowerOptions = {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'minute',
                            displayFormats: {
                                minute: 'HH:mm'
                            }
                        },
                        min: getMinTimeForDisplay(),
                        max: getMaxTimeForDisplay()
                    },
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            };
            
                createOrUpdateChart(tempPowerCanvasId, 'line', chartLabels, tempPowerDatasets, tempPowerOptions);
            }
        });
    } else {
        console.log('No GPU data available for charts');
    }
}

// Stop metrics polling
function stopMetricsPolling(message = 'Polling stopped.') {
    if (metricsIntervalId) {
        clearInterval(metricsIntervalId);
        metricsIntervalId = null;
        console.log(`[INFO] ${message}`);
    }
}

// Speed test functions
function updateStatus(message) {
    document.getElementById('speedTestStatus').textContent = `Status: ${message}`;
}

async function measurePing(samples = 10) {
    updateStatus('Testing latency...');
    let rtts = [];
    const endpoint = '/api/speedtest/ping';
    
    try {
        for (let i = 0; i < samples; i++) {
            const start = performance.now();
            try {
                await fetch(endpoint, { cache: 'no-store' });
                const end = performance.now();
                rtts.push(end - start);
            } catch (e) {
                console.error(`Ping ${i+1} failed:`, e);
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        if (rtts.length === 0) throw new Error('Ping test failed completely.');

        rtts.sort((a, b) => a - b);
        const minPing = rtts[0];
        const avgPing = rtts.reduce((a, b) => a + b, 0) / rtts.length;
        
        const mean = avgPing;
        const variance = rtts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rtts.length;
        const jitter = Math.sqrt(variance);
        
        document.getElementById('pingResult').textContent = minPing.toFixed(2);
        document.getElementById('jitterResult').textContent = jitter.toFixed(2);
        updateStatus('Latency test complete.');
        return { ping: minPing, jitter: jitter };
    } catch (err) {
        console.error('Error in ping measurement:', err);
        document.getElementById('pingResult').textContent = 'Error';
        document.getElementById('jitterResult').textContent = 'Error';
        updateStatus('Latency test failed.');
        throw err;
    }
}

async function measureDownload(endpoint = '/api/speedtest/download') {
    updateStatus('Testing download speed...');
    const start = performance.now();
    try {
        const response = await fetch(endpoint, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        const data = await response.blob();
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
    const data = new Blob([new ArrayBuffer(sizeBytes)], {type: 'application/octet-stream'});
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

// Video list functions
async function updateVideoList() {
    try {
        const response = await fetch('/api/videos');
        const videos = await response.json();
        
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
    } catch (error) {
        console.error('Error updating video list:', error);
    }
}

// Fallback initialization in case DOMContentLoaded already fired
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        const event = new Event('DOMContentLoaded');
        window.dispatchEvent(event);
    }, 500);
}
