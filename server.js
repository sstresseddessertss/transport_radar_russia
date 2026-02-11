const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

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
