const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3000;

// VAPID keys for Web Push - MUST be set via environment variables in production
// Generate keys with: node -e "const webpush = require('web-push'); const vapidKeys = webpush.generateVAPIDKeys(); console.log('PUBLIC_KEY=' + vapidKeys.publicKey); console.log('PRIVATE_KEY=' + vapidKeys.privateKey);"
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BGfdeIltToBqItxeeAskdTLYZ6SWUSVgZ_LokE4JseCF2p3nBZB7ZdzpYDPPRnnMwXYgE3hUvKxtyAzHGw5DV38';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'tgIFaCRTyErycHAR_JewsPRLBJirUu8Yab50NfcoYyY';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@transport-radar.ru';

// Warn if using default VAPID keys
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.warn('⚠️  WARNING: Using default VAPID keys. Generate and set your own keys via environment variables for production!');
  console.warn('   Generate keys: node -e "const webpush = require(\'web-push\'); const vapidKeys = webpush.generateVAPIDKeys(); console.log(\'PUBLIC_KEY=\' + vapidKeys.publicKey); console.log(\'PRIVATE_KEY=\' + vapidKeys.privateKey);"');
}

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

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

// In-memory storage for push subscriptions
// Structure: { stopId: [{ subscription, user_id (defaults to null), created_at, last_active, notify_minutes, tram_numbers }] }
const subscriptions = new Map();

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

// API endpoint to get VAPID public key
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// API endpoint to subscribe to push notifications for a stop
app.post('/api/stops/:stopId/subscribe', (req, res) => {
  const { stopId } = req.params;
  const { subscription, user_id, notify_minutes, tram_numbers } = req.body;
  
  // Validate subscription object
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ 
      error: 'Отсутствует endpoint подписки' 
    });
  }
  
  if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
    return res.status(400).json({ 
      error: 'Отсутствуют ключи подписки (p256dh, auth)' 
    });
  }
  
  // Validate notify_minutes
  if (!notify_minutes || notify_minutes < 1 || notify_minutes > 30) {
    return res.status(400).json({ 
      error: 'Некорректное значение notify_minutes (должно быть 1-30)' 
    });
  }
  
  // Validate tram_numbers
  if (!tram_numbers || !Array.isArray(tram_numbers) || tram_numbers.length === 0) {
    return res.status(400).json({ 
      error: 'Укажите хотя бы один номер трамвая' 
    });
  }
  
  try {
    // Get or create subscriptions array for this stop
    if (!subscriptions.has(stopId)) {
      subscriptions.set(stopId, []);
    }
    
    const stopSubscriptions = subscriptions.get(stopId);
    
    // Check if subscription already exists (by endpoint)
    const existingIndex = stopSubscriptions.findIndex(
      sub => sub.subscription.endpoint === subscription.endpoint
    );
    
    const subscriptionData = {
      subscription,
      user_id: user_id || null,
      created_at: existingIndex === -1 ? new Date().toISOString() : stopSubscriptions[existingIndex].created_at,
      last_active: new Date().toISOString(),
      notify_minutes,
      tram_numbers,
      notified_trams: new Set() // Track which trams have been notified
    };
    
    if (existingIndex !== -1) {
      // Update existing subscription
      stopSubscriptions[existingIndex] = subscriptionData;
    } else {
      // Add new subscription
      stopSubscriptions.push(subscriptionData);
    }
    
    console.log(`Subscription ${existingIndex !== -1 ? 'updated' : 'added'} for stop ${stopId}, trams: ${tram_numbers.join(', ')}, notify at ${notify_minutes} min`);
    
    res.json({ 
      success: true,
      message: existingIndex !== -1 ? 'Подписка обновлена' : 'Подписка создана'
    });
    
  } catch (error) {
    console.error('Error subscribing:', error);
    res.status(500).json({ 
      error: 'Ошибка при создании подписки',
      details: error.message 
    });
  }
});

// API endpoint to unsubscribe from push notifications
app.post('/api/stops/:stopId/unsubscribe', (req, res) => {
  const { stopId } = req.params;
  const { endpoint } = req.body;
  
  if (!endpoint) {
    return res.status(400).json({ 
      error: 'Отсутствует endpoint для удаления' 
    });
  }
  
  try {
    if (!subscriptions.has(stopId)) {
      return res.status(404).json({ 
        error: 'Подписки для этой остановки не найдены' 
      });
    }
    
    const stopSubscriptions = subscriptions.get(stopId);
    const initialLength = stopSubscriptions.length;
    
    // Remove subscription by endpoint
    const filteredSubscriptions = stopSubscriptions.filter(
      sub => sub.subscription.endpoint !== endpoint
    );
    
    if (filteredSubscriptions.length === initialLength) {
      return res.status(404).json({ 
        error: 'Подписка не найдена' 
      });
    }
    
    subscriptions.set(stopId, filteredSubscriptions);
    
    console.log(`Subscription removed for stop ${stopId}`);
    
    res.json({ 
      success: true,
      message: 'Подписка удалена'
    });
    
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ 
      error: 'Ошибка при удалении подписки',
      details: error.message 
    });
  }
});

// Background worker to check for approaching trams and send push notifications
async function checkAndSendPushNotifications() {
  // Iterate through all stops with subscriptions
  for (const [stopId, stopSubscriptions] of subscriptions.entries()) {
    if (stopSubscriptions.length === 0) continue;
    
    try {
      // Fetch current stop data
      const url = `https://moscowtransport.app/api/stop_v2/${stopId}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:79.0) Gecko/20100101 Firefox/79.0'
        }
      });
      
      if (!response.ok) {
        console.warn(`Failed to fetch data for stop ${stopId}: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (!data.routePath || data.routePath.length === 0) {
        continue;
      }
      
      // Check each subscription
      for (const subData of stopSubscriptions) {
        try {
          // Check each tram number in the subscription
          for (const tramNumber of subData.tram_numbers) {
            // Find route for this tram
            const route = data.routePath.find(r => r.number === tramNumber);
            
            if (!route || !route.externalForecast) {
              continue;
            }
            
            // Find earliest arrival time with GPS data
            let minTime = Infinity;
            let hasTelemetry = false;
            
            route.externalForecast.forEach(forecast => {
              if (forecast.byTelemetry === 1 && forecast.time < minTime) {
                minTime = forecast.time;
                hasTelemetry = true;
              }
            });
            
            if (!hasTelemetry || minTime === Infinity) {
              continue;
            }
            
            const arrivalMinutes = Math.round(minTime / 60);
            const notifKey = `${stopId}_${tramNumber}_${arrivalMinutes}`;
            
            // Check if we should send notification
            if (arrivalMinutes <= subData.notify_minutes && 
                arrivalMinutes > 0 && 
                !subData.notified_trams.has(notifKey)) {
              
              // Get stop name
              const stopName = data.name || 'остановка';
              
              // Send push notification
              const payload = JSON.stringify({
                title: '🚊 Радар трамваев Москвы',
                body: `Трамвай ${tramNumber} прибывает через ${arrivalMinutes} мин на остановку ${stopName}`,
                icon: '/icon-192.svg',
                badge: '/badge-72.svg',
                tag: `tram-${tramNumber}-${stopId}`,
                data: {
                  stopId,
                  tramNumber,
                  arrivalMinutes,
                  stopName,
                  url: '/'
                }
              });
              
              try {
                await webpush.sendNotification(subData.subscription, payload);
                console.log(`Push sent: Tram ${tramNumber} arriving in ${arrivalMinutes} min at ${stopName}`);
                
                // Mark as notified
                subData.notified_trams.add(notifKey);
                
                // Clean up old notified trams (keep only recent ones)
                if (subData.notified_trams.size > 20) {
                  const toDelete = Array.from(subData.notified_trams).slice(0, 10);
                  toDelete.forEach(key => subData.notified_trams.delete(key));
                }
                
              } catch (pushError) {
                console.error('Push notification error:', pushError);
                
                // If subscription is invalid/expired, remove it
                if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                  console.log(`Removing invalid subscription for stop ${stopId}`);
                  const filteredSubs = stopSubscriptions.filter(
                    s => s.subscription.endpoint !== subData.subscription.endpoint
                  );
                  subscriptions.set(stopId, filteredSubs);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing subscription:', error);
        }
      }
      
    } catch (error) {
      console.error(`Error checking stop ${stopId}:`, error);
    }
  }
}

// Start background worker (check every 20 seconds)
let pushWorkerInterval = null;

function startPushWorker() {
  if (!pushWorkerInterval) {
    console.log('Starting push notification worker...');
    pushWorkerInterval = setInterval(checkAndSendPushNotifications, 20000);
    // Also run immediately
    checkAndSendPushNotifications();
  }
}

// Start server
async function start() {
  await loadStops();
  
  // Start push notification worker
  startPushWorker();
  
  app.listen(PORT, () => {
    console.log(`🚊 Transport Radar Russia запущен на http://localhost:${PORT}`);
    console.log('Нажмите Ctrl+C для остановки');
  });
}

start();
