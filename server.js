const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure VAPID keys for web push
const VAPID_PUBLIC_KEY = process.env.PUBLIC_VAPID_KEY || 'BNqjZcSrxDzfY2S36e1sNne9Mzw6hWnxYHyJysWN9ZpvBxVDThtvMCiKmxufVRUyoBL8ZE4RqVDlU5s636Ayhls';
const VAPID_PRIVATE_KEY = process.env.PRIVATE_VAPID_KEY || '-8qg68XULGxzg8CPtcQNxhgaywt7XIaF1_NTLhcD7Y4';

webpush.setVapidDetails(
  'mailto:admin@transport-radar.ru',
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
// Structure: { stopId: [{ subscription, notificationMinutes }] }
const pushSubscriptions = new Map();

// Simple rate limiting for stop import endpoint
const importRateLimit = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_IMPORTS_PER_WINDOW = 10;

// Track recently sent notifications to avoid spam
const recentNotifications = new Map();
const NOTIFICATION_COOLDOWN = parseInt(process.env.NOTIFICATION_COOLDOWN) || 300000; // 5 minutes

// Retry configuration for push notifications
const PUSH_RETRY_ATTEMPTS = 3;
const PUSH_RETRY_DELAY = 1000; // 1 second

/**
 * Send push notification with retry logic
 * @param {Object} subscription - Push subscription object
 * @param {string} payload - Notification payload
 * @param {number} retries - Number of retry attempts remaining
 * @returns {Promise<Object>} - Send result
 */
async function sendPushWithRetry(subscription, payload, retries = PUSH_RETRY_ATTEMPTS) {
  try {
    const result = await webpush.sendNotification(subscription, payload);
    return { success: true, result };
  } catch (error) {
    // Don't retry on client errors (4xx) except for rate limiting (429)
    if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
      return { success: false, error, retryable: false };
    }
    
    // Retry on server errors (5xx) or network errors
    if (retries > 0) {
      console.log(`Push send failed, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, PUSH_RETRY_DELAY));
      return sendPushWithRetry(subscription, payload, retries - 1);
    }
    
    return { success: false, error, retryable: true };
  }
}

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

// Check and send push notifications for approaching trams
async function checkAndSendPushNotifications(stopId, routePath) {
  if (!pushSubscriptions.has(stopId) || !routePath) {
    return;
  }
  
  const subscriptions = pushSubscriptions.get(stopId);
  const now = Date.now();
  
  for (const { subscription, notificationMinutes } of subscriptions) {
    try {
      // Check each route for approaching trams
      for (const route of routePath) {
        if (!route.externalForecast) continue;
        
        // Find the earliest arrival time
        let minTime = Infinity;
        for (const forecast of route.externalForecast) {
          if (forecast.time < minTime) {
            minTime = forecast.time;
          }
        }
        
        if (minTime === Infinity) continue;
        
        const arrivalMinutes = Math.round(minTime / 60);
        
        // Check if we should send a notification
        if (arrivalMinutes <= notificationMinutes) {
          // Check cooldown to avoid spam
          const notifKey = `${subscription.endpoint}_${stopId}_${route.number}`;
          const lastSent = recentNotifications.get(notifKey);
          
          if (lastSent && (now - lastSent) < NOTIFICATION_COOLDOWN) {
            continue; // Skip, notification sent recently
          }
          
          // Get stop name
          const stop = stopsData?.stops?.find(s => s.uuid === stopId);
          const stopName = stop ? stop.name : 'остановку';
          
          // Send push notification with retry
          const payload = JSON.stringify({
            title: '🚊 Трамвай приближается',
            body: `Трамвай ${route.number} прибывает через ${arrivalMinutes} мин на ${stopName}`,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            tag: `tram-${route.number}-${stopId}`,
            data: {
              stopId,
              tramNumber: route.number,
              arrivalMinutes
            }
          });
          
          const sendResult = await sendPushWithRetry(subscription, payload);
          
          if (sendResult.success) {
            // Update last sent time
            recentNotifications.set(notifKey, now);
            console.log(`✅ Push notification sent for tram ${route.number} at stop ${stopId}`);
          } else if (!sendResult.retryable) {
            // Non-retryable error (likely invalid subscription)
            console.log(`❌ Invalid subscription detected for stop ${stopId}, will be removed`);
            throw sendResult.error; // Let outer catch handle removal
          } else {
            // Retryable error but all retries exhausted
            console.error(`❌ Failed to send notification after ${PUSH_RETRY_ATTEMPTS} attempts:`, sendResult.error.message);
          }
        }
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
      
      // If subscription is invalid, remove it
      if (error.statusCode === 410 || error.statusCode === 404) {
        const index = subscriptions.findIndex(
          sub => sub.subscription.endpoint === subscription.endpoint
        );
        if (index >= 0) {
          subscriptions.splice(index, 1);
          console.log('Removed invalid subscription');
        }
      }
    }
  }
  
  // Clean up old notification records
  const cutoff = now - NOTIFICATION_COOLDOWN;
  for (const [key, time] of recentNotifications.entries()) {
    if (time < cutoff) {
      recentNotifications.delete(key);
    }
  }
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
    
    // Check for push notifications
    await checkAndSendPushNotifications(uuid, routePath);
    
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

// Get VAPID public key for client
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Validation helper for subscription objects
function validateSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object') {
    return { valid: false, error: 'Subscription must be an object' };
  }
  
  if (!subscription.endpoint || typeof subscription.endpoint !== 'string') {
    return { valid: false, error: 'Subscription endpoint is required and must be a string' };
  }
  
  if (!subscription.keys || typeof subscription.keys !== 'object') {
    return { valid: false, error: 'Subscription keys are required' };
  }
  
  if (!subscription.keys.p256dh || !subscription.keys.auth) {
    return { valid: false, error: 'Subscription keys must include p256dh and auth' };
  }
  
  // Validate endpoint URL format
  try {
    new URL(subscription.endpoint);
  } catch (error) {
    return { valid: false, error: 'Invalid endpoint URL format' };
  }
  
  return { valid: true };
}

// Minimum endpoint length validation (typical push endpoints are much longer than this)
const MIN_ENDPOINT_LENGTH = 10;

// Rate limiting for subscription endpoints
const subscriptionRateLimit = new Map();
const SUBSCRIPTION_RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_SUBSCRIPTIONS_PER_WINDOW = 5;

function checkSubscriptionRateLimit(ip) {
  const now = Date.now();
  
  if (!subscriptionRateLimit.has(ip)) {
    subscriptionRateLimit.set(ip, []);
  }
  
  const requests = subscriptionRateLimit.get(ip);
  
  // Remove old requests outside the time window
  const recentRequests = requests.filter(time => now - time < SUBSCRIPTION_RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_SUBSCRIPTIONS_PER_WINDOW) {
    return false;
  }
  
  recentRequests.push(now);
  subscriptionRateLimit.set(ip, recentRequests);
  
  return true;
}

// Subscribe to push notifications for a stop
app.post('/api/stops/:stopId/subscribe', async (req, res) => {
  const { stopId } = req.params;
  const { subscription, notificationMinutes } = req.body;
  
  // Rate limiting check
  const clientIp = req.ip || req.connection.remoteAddress;
  if (!checkSubscriptionRateLimit(clientIp)) {
    return res.status(429).json({ 
      error: 'Слишком много запросов на подписку. Попробуйте позже.' 
    });
  }
  
  // Validate required fields
  if (!stopId || !subscription) {
    return res.status(400).json({ error: 'stopId and subscription are required' });
  }
  
  // Validate subscription object
  const validation = validateSubscription(subscription);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  
  // Validate notificationMinutes if provided
  if (notificationMinutes !== undefined) {
    const minutes = parseInt(notificationMinutes);
    if (isNaN(minutes) || minutes < 1 || minutes > 60) {
      return res.status(400).json({ 
        error: 'notificationMinutes must be a number between 1 and 60' 
      });
    }
  }
  
  try {
    if (!pushSubscriptions.has(stopId)) {
      pushSubscriptions.set(stopId, []);
    }
    
    const subscriptions = pushSubscriptions.get(stopId);
    
    // Limit subscriptions per stop (prevent abuse)
    const MAX_SUBSCRIPTIONS_PER_STOP = 100;
    if (subscriptions.length >= MAX_SUBSCRIPTIONS_PER_STOP) {
      // Remove oldest inactive subscriptions to make room
      const now = Date.now();
      const activeSubscriptions = subscriptions.filter(sub => {
        const subKey = `${sub.subscription.endpoint}_${stopId}`;
        const lastActive = recentNotifications.get(subKey);
        return lastActive && (now - lastActive) < 86400000; // Active in last 24h
      });
      
      if (activeSubscriptions.length >= MAX_SUBSCRIPTIONS_PER_STOP) {
        return res.status(429).json({ 
          error: 'Слишком много подписок на эту остановку' 
        });
      }
      
      pushSubscriptions.set(stopId, activeSubscriptions);
    }
    
    // Get updated subscriptions list after potential cleanup
    const currentSubscriptions = pushSubscriptions.get(stopId);
    
    // Check if this subscription already exists
    const existingIndex = currentSubscriptions.findIndex(
      sub => sub.subscription.endpoint === subscription.endpoint
    );
    
    if (existingIndex >= 0) {
      // Update existing subscription
      currentSubscriptions[existingIndex] = { 
        subscription, 
        notificationMinutes: notificationMinutes || 3,
        createdAt: currentSubscriptions[existingIndex].createdAt || new Date().toISOString(),
        lastActive: new Date().toISOString()
      };
      console.log(`✏️ Subscription updated for stop ${stopId}`);
    } else {
      // Add new subscription
      currentSubscriptions.push({ 
        subscription, 
        notificationMinutes: notificationMinutes || 3,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      });
      console.log(`➕ Subscription added for stop ${stopId}, total: ${currentSubscriptions.length}`);
    }
    
    res.json({ success: true, message: 'Subscription added successfully' });
  } catch (error) {
    console.error('Error adding subscription:', error);
    res.status(500).json({ error: 'Failed to add subscription' });
  }
});

// Unsubscribe from push notifications for a stop
app.post('/api/stops/:stopId/unsubscribe', async (req, res) => {
  const { stopId } = req.params;
  const { endpoint } = req.body;
  
  // Validate required fields
  if (!stopId || !endpoint) {
    return res.status(400).json({ error: 'stopId and endpoint are required' });
  }
  
  // Validate endpoint format
  if (typeof endpoint !== 'string' || endpoint.length < MIN_ENDPOINT_LENGTH) {
    return res.status(400).json({ error: 'Invalid endpoint format' });
  }
  
  try {
    if (!pushSubscriptions.has(stopId)) {
      return res.json({ success: true, message: 'No subscriptions found' });
    }
    
    const subscriptions = pushSubscriptions.get(stopId);
    const initialLength = subscriptions.length;
    
    const filteredSubscriptions = subscriptions.filter(
      sub => sub.subscription.endpoint !== endpoint
    );
    
    const removedCount = initialLength - filteredSubscriptions.length;
    
    if (filteredSubscriptions.length === 0) {
      pushSubscriptions.delete(stopId);
      console.log(`🗑️ All subscriptions removed for stop ${stopId}`);
    } else {
      pushSubscriptions.set(stopId, filteredSubscriptions);
      if (removedCount > 0) {
        console.log(`➖ Subscription removed for stop ${stopId} (${filteredSubscriptions.length} remaining)`);
      }
    }
    
    if (removedCount === 0) {
      res.json({ success: true, message: 'No matching subscription found' });
    } else {
      res.json({ success: true, message: 'Subscription removed successfully' });
    }
  } catch (error) {
    console.error('Error removing subscription:', error);
    res.status(500).json({ error: 'Failed to remove subscription' });
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
