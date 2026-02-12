const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the public directory
app.use(express.static('public'));

// Load stops data
let stopsData = null;

// In-memory storage for tracking trams and arrival history
// Structure: { stopId: { tramNumber: { currentTrams: Set, history: Array } } }
const tramTracking = new Map();
const MAX_HISTORY_ITEMS = 3;

// Simple rate limiting for stop import endpoint
const importRateLimit = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_IMPORTS_PER_WINDOW = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  
  if (!importRateLimit.has(ip)) {
    importRateLimit.set(ip, []);
  }
  
  const requests = importRateLimit.get(ip);
  
  // Remove old requests outside the time window
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_IMPORTS_PER_WINDOW) {
    return false;
  }
  
  recentRequests.push(now);
  importRateLimit.set(ip, recentRequests);
  
  return true;
}
async function loadStops() {
  try {
    const data = await fs.readFile(path.join(__dirname, 'stops.json'), 'utf8');
    stopsData = JSON.parse(data);
    console.log('Stops data loaded successfully');
  } catch (error) {
    console.error('Error loading stops.json:', error);
    process.exit(1);
  }
}

// API endpoint to get stops list
app.get('/api/stops', (req, res) => {
  if (!stopsData) {
    return res.status(500).json({ error: 'Stops data not loaded' });
  }
  res.json(stopsData);
});

// API proxy endpoint to fetch stop data from moscowtransport.app
app.get('/api/stop/:uuid', async (req, res) => {
  const { uuid } = req.params;
  
  if (!uuid) {
    return res.status(400).json({ error: 'UUID parameter is required' });
  }

  try {
    const url = `https://moscowtransport.app/api/stop_v2/${uuid}`;
    
    // Use built-in fetch (Node.js 18+)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:79.0) Gecko/20100101 Firefox/79.0'
      }
    });

    if (!response.ok) {
      if (response.status === 477) {
        return res.status(477).json({ 
          error: 'API недоступен. Требуется российский IP-адрес. Убедитесь, что VPN отключен.',
          status: 477
        });
      }
      
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: `API error: ${response.statusText}`,
        details: errorText,
        status: response.status
      });
    }

    const data = await response.json();
    
    // Filter only tram routes
    if (data.routePath) {
      data.routePath = data.routePath.filter(route => route.type === 'tram');
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching stop data:', error);
    res.status(500).json({ 
      error: 'Ошибка при получении данных',
      details: error.message 
    });
  }
});

// API endpoint to add a stop by URL
app.post('/api/stops/import', async (req, res) => {
  const { url } = req.body;
  
  // Rate limiting check
  const clientIp = req.ip || req.connection.remoteAddress;
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ 
      error: 'Слишком много запросов. Попробуйте позже.' 
    });
  }
  
  if (!url) {
    return res.status(400).json({ error: 'URL параметр обязателен' });
  }
  
  try {
    // Parse UUID from URL
    const urlPattern = /https:\/\/moscowapp\.mos\.ru\/stop\?id=([a-f0-9-]+)/i;
    const match = url.match(urlPattern);
    
    if (!match) {
      return res.status(400).json({ 
        error: 'Неверный формат ссылки. Используйте ссылку вида: https://moscowapp.mos.ru/stop?id=...' 
      });
    }
    
    const uuid = match[1];
    
    // Check if stop already exists
    if (stopsData.stops.some(stop => stop.uuid === uuid)) {
      return res.status(409).json({ 
        error: 'Эта остановка уже добавлена',
        uuid 
      });
    }
    
    // Fetch stop data from API
    const apiUrl = `https://moscowtransport.app/api/stop_v2/${uuid}`;
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:79.0) Gecko/20100101 Firefox/79.0'
      }
    });
    
    if (!response.ok) {
      if (response.status === 477) {
        return res.status(477).json({ 
          error: 'API недоступен. Требуется российский IP-адрес.',
          status: 477
        });
      }
      return res.status(response.status).json({ 
        error: `Ошибка при получении данных: ${response.statusText}`,
        status: response.status
      });
    }
    
    const data = await response.json();
    
    if (!data.name) {
      return res.status(400).json({ error: 'Не удалось получить название остановки' });
    }
    
    // Extract direction from API data if available
    let direction = 'не указано';
    if (data.direction) {
      direction = data.direction;
    } else if (data.routePath && data.routePath.length > 0) {
      // Try to infer direction from route path
      const firstRoute = data.routePath[0];
      if (firstRoute.lastStopName) {
        direction = `→ ${firstRoute.lastStopName}`;
      }
    }
    
    // Create new stop object
    const newStop = {
      name: data.name,
      uuid: uuid,
      direction: direction
    };
    
    // Add to stops data
    stopsData.stops.push(newStop);
    
    // Save to file
    const stopsPath = path.join(__dirname, 'stops.json');
    await fs.writeFile(stopsPath, JSON.stringify(stopsData, null, 2), 'utf8');
    
    console.log(`Added new stop: ${newStop.name} (${newStop.direction})`);
    
    res.json({ 
      success: true, 
      stop: newStop 
    });
    
  } catch (error) {
    console.error('Error importing stop:', error);
    res.status(500).json({ 
      error: 'Ошибка при добавлении остановки',
      details: error.message 
    });
  }
});

// API endpoint to track trams (called by frontend during monitoring)
app.post('/api/track/:uuid', async (req, res) => {
  const { uuid } = req.params;
  const { routePath } = req.body;
  
  if (!uuid || !routePath) {
    return res.status(400).json({ error: 'UUID and routePath required' });
  }
  
  try {
    if (!tramTracking.has(uuid)) {
      tramTracking.set(uuid, new Map());
    }
    
    const stopTracking = tramTracking.get(uuid);
    const currentTime = new Date().toISOString();
    
    // Process each route
    routePath.forEach(route => {
      const tramNumber = route.number;
      
      if (!stopTracking.has(tramNumber)) {
        stopTracking.set(tramNumber, {
          currentTrams: new Set(),
          history: []
        });
      }
      
      const tramData = stopTracking.get(tramNumber);
      const previousTrams = new Set(tramData.currentTrams);
      const newTrams = new Set();
      
      // Track trams from GPS data only
      if (route.externalForecast) {
        route.externalForecast.forEach(forecast => {
          if (forecast.byTelemetry === 1) {
            // Use a combination of time and vehicle ID as unique identifier
            const tramId = `${forecast.time}_${forecast.vehicleId || ''}`;
            newTrams.add(tramId);
          }
        });
      }
      
      // Find trams that disappeared (arrived)
      previousTrams.forEach(tramId => {
        if (!newTrams.has(tramId)) {
          // Tram has arrived!
          const arrivalTime = new Date();
          tramData.history.unshift({
            time: arrivalTime.toISOString(),
            displayTime: arrivalTime.toLocaleTimeString('ru-RU', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })
          });
          
          // Keep only last N arrivals
          if (tramData.history.length > MAX_HISTORY_ITEMS) {
            tramData.history = tramData.history.slice(0, MAX_HISTORY_ITEMS);
          }
        }
      });
      
      // Update current trams
      tramData.currentTrams = newTrams;
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error tracking trams:', error);
    res.status(500).json({ error: 'Ошибка отслеживания' });
  }
});

// API endpoint to get arrival history
app.get('/api/history/:uuid', (req, res) => {
  const { uuid } = req.params;
  
  try {
    if (!tramTracking.has(uuid)) {
      return res.json({});
    }
    
    const stopTracking = tramTracking.get(uuid);
    const history = {};
    
    // Convert Map to object for JSON response
    stopTracking.forEach((data, tramNumber) => {
      if (data.history.length > 0) {
        history[tramNumber] = data.history;
      }
    });
    
    res.json(history);
    
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ error: 'Ошибка получения истории' });
  }
});

// Start server
async function start() {
  await loadStops();
  
  app.listen(PORT, () => {
    console.log(`🚊 Transport Radar Russia запущен на http://localhost:${PORT}`);
    console.log('Нажмите Ctrl+C для остановки');
  });
}

start();
