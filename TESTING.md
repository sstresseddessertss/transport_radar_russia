# Web Push Notifications - Testing Guide

## Manual Testing

### Prerequisites
- Node.js 18+ installed
- Modern browser with Service Worker and Push API support (Chrome, Firefox, Edge)
- Russian IP address (for accessing moscowtransport.app API)

### Test Flow

#### 1. Start the Server
```bash
npm start
```

You should see:
```
⚠️  WARNING: Using default VAPID keys. Generate and set your own keys via environment variables for production!
Stops data loaded successfully
Starting push notification worker...
🚊 Transport Radar Russia запущен на http://localhost:3000
```

#### 2. Open Browser
Navigate to `http://localhost:3000`

#### 3. Test Subscription Flow

1. **Select a stop** from the dropdown (e.g., "Плодоовощной комбинат (в центр)")
2. **Check one or more trams** (e.g., tram 17)
3. Click the **"🔔 Оповестить"** button
4. **Allow notifications** when browser prompts
5. Select notification time (e.g., "3 минуты")
6. Select a tram number
7. Click **"Включить"**

Expected result: You should see "✓ Push-уведомления настроены для трамвая XX" message

#### 4. Test Notification Sending

The background worker checks for approaching trams every 20 seconds. To test:

1. Start monitoring by clicking **"МОНИТОРИНГ"** button
2. Wait for the worker to detect an approaching tram
3. If a tram is within your notification threshold (e.g., 3 minutes away), you should receive a push notification

Note: Notifications are only sent for trams with GPS data (green "GPS" badges)

#### 5. Test Unsubscription

1. In the active notifications section, click **"Удалить"** on a notification
2. The notification should be removed
3. If it was the last notification, the push subscription is removed

### API Testing

#### Get VAPID Public Key
```bash
curl http://localhost:3000/api/push/vapid-public-key
```

Expected:
```json
{"publicKey":"BGfd...DV38"}
```

#### Subscribe to Push
```bash
curl -X POST http://localhost:3000/api/stops/760d1406-363e-4b1a-a604-a6c75db93493/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "subscription": {
      "endpoint": "https://fcm.googleapis.com/fcm/send/test",
      "keys": {
        "p256dh": "test-key-p256dh",
        "auth": "test-key-auth"
      }
    },
    "notify_minutes": 5,
    "tram_numbers": ["17", "23"]
  }'
```

Expected:
```json
{"success":true,"message":"Подписка создана"}
```

#### Unsubscribe from Push
```bash
curl -X POST http://localhost:3000/api/stops/760d1406-363e-4b1a-a604-a6c75db93493/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://fcm.googleapis.com/fcm/send/test"
  }'
```

Expected:
```json
{"success":true,"message":"Подписка удалена"}
```

## Browser Console Testing

Open browser console (F12) and check:

### Service Worker Registration
```javascript
navigator.serviceWorker.getRegistration().then(reg => console.log('SW:', reg));
```

### Push Subscription Status
```javascript
navigator.serviceWorker.ready.then(reg => 
  reg.pushManager.getSubscription().then(sub => 
    console.log('Push subscription:', sub)
  )
);
```

### Request Permission
```javascript
Notification.requestPermission().then(result => console.log('Permission:', result));
```

## Troubleshooting

### "Push notifications not supported"
- Use a modern browser (Chrome 42+, Firefox 44+, Edge 17+)
- Check that you're using HTTPS or localhost (required for Service Workers)

### "API недоступен" error
- You need a Russian IP address to access moscowtransport.app API
- Disable VPN if active

### No notifications received
- Check browser notification permission is granted
- Verify tram has GPS data (green "GPS" badge)
- Check browser console for errors
- Verify the tram is within the notification threshold time

### Service Worker not registering
- Check browser console for errors
- Verify `/service-worker.js` is accessible
- Clear browser cache and reload

## Expected Behavior

### Notification Timing
- Background worker checks every 20 seconds
- Notifications sent when tram is ≤ specified minutes away
- Only GPS-tracked trams trigger notifications
- Each tram notifies only once per arrival

### Multiple Notifications
- You can set up notifications for multiple trams
- Subscription updates automatically when adding/removing notifications
- Minimum notification time is used when multiple notifications are active

### Subscription Persistence
- Subscriptions are stored in-memory on the server
- Subscriptions are lost when server restarts
- Browser-side push subscription persists across page reloads
