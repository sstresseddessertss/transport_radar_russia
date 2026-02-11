const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory rate limiter for POST /api/stops
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // max 10 requests per minute per IP

function checkRateLimit(ip) {
  const now = Date.now();
  const requests = rateLimitMap.get(ip) || [];
  
  // Remove old requests outside the time window
  const recentRequests = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false; // Rate limit exceeded
  }
  
  // Add current request
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  
  return true; // Request allowed
}

// Middleware
app.use(express.json());

// Serve static files from the public directory
app.use(express.static('public'));

// Load stops data
let stopsData = null;
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

// API endpoint to add a new stop
app.post('/api/stops', async (req, res) => {
  try {
    // Rate limiting check
    const clientIp = req.ip || req.connection.remoteAddress;
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ 
        error: 'Слишком много запросов. Пожалуйста, попробуйте позже.' 
      });
    }
    
    const { uuid, name, direction } = req.body;
    
    // Validate input
    if (!uuid || !name || !direction) {
      return res.status(400).json({ 
        error: 'Все поля обязательны: uuid, name, direction' 
      });
    }
    
    // Validate UUID format (8-4-4-4-12)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      return res.status(400).json({ 
        error: 'Неверный формат UUID. Формат: 8-4-4-4-12 hex символов' 
      });
    }
    
    // Check for duplicates
    const exists = stopsData.stops.find(s => s.uuid.toLowerCase() === uuid.toLowerCase());
    if (exists) {
      return res.status(409).json({ 
        error: 'Остановка с таким UUID уже существует' 
      });
    }
    
    // Validate direction
    const validDirections = ['в центр', 'из центра'];
    if (!validDirections.includes(direction)) {
      return res.status(400).json({ 
        error: 'Неверное направление. Должно быть "в центр" или "из центра"' 
      });
    }
    
    // Create new stop
    const newStop = {
      name: name.trim(),
      uuid: uuid.toLowerCase().trim(),
      direction: direction.trim()
    };
    
    // Add to stops array
    stopsData.stops.push(newStop);
    
    // Save to file
    await fs.writeFile(
      path.join(__dirname, 'stops.json'),
      JSON.stringify(stopsData, null, 2),
      'utf8'
    );
    
    console.log(`New stop added: ${newStop.name} (${newStop.direction}) - ${newStop.uuid}`);
    
    res.status(201).json({ 
      success: true,
      stop: newStop,
      message: 'Остановка успешно добавлена' 
    });
    
  } catch (error) {
    console.error('Error adding stop:', error);
    res.status(500).json({ 
      error: 'Ошибка при сохранении остановки',
      details: error.message 
    });
  }
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

// Start server
async function start() {
  await loadStops();
  
  app.listen(PORT, () => {
    console.log(`🚊 Transport Radar Russia запущен на http://localhost:${PORT}`);
    console.log('Нажмите Ctrl+C для остановки');
  });
}

start();
