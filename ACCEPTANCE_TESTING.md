# Acceptance Testing Instructions

## Push Notifications Feature Testing Guide

This document provides step-by-step instructions for testing the push notifications feature.

### Prerequisites

1. **Browser**: Chrome, Firefox, or Edge (Safari 16+ on macOS)
2. **HTTPS or localhost**: Push notifications require secure context
3. **Server running**: `npm start` 
4. **Dependencies installed**: `npm install`

---

## Test Suite 1: Unit Tests

### Automated Tests
Run the automated test suite:

```bash
npm test
```

**Expected Result**: All 5 test suites should pass:
- ✅ Subscription Validation
- ✅ Rate Limiting
- ✅ Notification Payload Structure
- ✅ Subscription Deduplication
- ✅ Notification Cooldown

**Pass Criteria**: Output shows "🎉 All tests passed!"

---

## Test Suite 2: Manual Frontend Testing

### Test 2.1: Service Worker Registration

**Steps:**
1. Open browser DevTools (F12)
2. Navigate to http://localhost:3000
3. Go to Application tab → Service Workers

**Expected Result:**
- Service worker `/sw.js` should be registered and activated
- Status should show "activated and is running"

**Pass Criteria:** ✅ Service worker is active

---

### Test 2.2: Subscribe to Notifications

**Steps:**
1. Select a stop from the dropdown
2. Wait for available trams to load
3. Look for the "🔔 Включить уведомления" button
4. Click the button
5. Accept the browser notification permission prompt

**Expected Result:**
- Permission prompt appears
- After accepting, button changes to "🔕 Отключить уведомления"
- Status message shows "Уведомления включены для этой остановки"
- In DevTools Console: "Subscription added for stop [stopId]"

**Pass Criteria:** 
- ✅ Button text changed
- ✅ Status message displayed
- ✅ Console shows successful subscription

---

### Test 2.3: Unsubscribe from Notifications

**Steps:**
1. With an active subscription, click "🔕 Отключить уведомления"
2. Wait for response

**Expected Result:**
- Button changes back to "🔔 Включить уведомления"
- Status message disappears
- In DevTools Console: "Subscription removed for stop [stopId]"

**Pass Criteria:**
- ✅ Button text changed
- ✅ Console shows successful unsubscription

---

### Test 2.4: Re-subscribe (Update Subscription)

**Steps:**
1. Subscribe to a stop (Test 2.2)
2. Refresh the page
3. Select the same stop
4. Subscribe again

**Expected Result:**
- Subscription is updated (not duplicated)
- Console shows: "✏️ Subscription updated for stop [stopId]"

**Pass Criteria:** ✅ No duplicate subscriptions created

---

## Test Suite 3: Backend API Testing

### Test 3.1: Get VAPID Public Key

**Request:**
```bash
curl http://localhost:3000/api/vapid-public-key
```

**Expected Response:**
```json
{
  "publicKey": "BNqjZcSrxDzfY2S36e1sNne9Mzw6hWnxYHyJysWN9ZpvBxVDThtvMCiKmxufVRUyoBL8ZE4RqVDlU5s636Ayhls"
}
```

**Pass Criteria:** ✅ Returns valid VAPID public key

---

### Test 3.2: Subscribe Endpoint Validation

**Invalid Subscription (Missing Keys):**
```bash
curl -X POST http://localhost:3000/api/stops/test-stop/subscribe \
  -H "Content-Type: application/json" \
  -d '{"subscription": {"endpoint": "https://test.com"}}'
```

**Expected Response:** 400 Bad Request
```json
{
  "error": "Subscription keys are required"
}
```

**Pass Criteria:** ✅ Validation error returned

---

**Invalid Notification Minutes:**
```bash
curl -X POST http://localhost:3000/api/stops/test-stop/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "subscription": {
      "endpoint": "https://fcm.googleapis.com/test",
      "keys": {"p256dh": "test", "auth": "test"}
    },
    "notificationMinutes": 100
  }'
```

**Expected Response:** 400 Bad Request
```json
{
  "error": "notificationMinutes must be a number between 1 and 60"
}
```

**Pass Criteria:** ✅ Range validation works

---

### Test 3.3: Rate Limiting

**Steps:**
1. Send 5 subscription requests rapidly
2. Send a 6th request

**Request (repeat 6 times):**
```bash
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/stops/test-stop/subscribe \
    -H "Content-Type: application/json" \
    -d '{
      "subscription": {
        "endpoint": "https://fcm.googleapis.com/test'$i'",
        "keys": {"p256dh": "test", "auth": "test"}
      }
    }'
  echo ""
done
```

**Expected Result:**
- First 5 requests: 200 OK
- 6th request: 429 Too Many Requests

**Pass Criteria:** ✅ Rate limit enforced

---

## Test Suite 4: Push Notification Delivery

### Test 4.1: Interactive Push Test

**Steps:**
1. Subscribe to a stop via the UI
2. Get your subscription object from browser console:
   ```javascript
   navigator.serviceWorker.ready
     .then(reg => reg.pushManager.getSubscription())
     .then(sub => console.log(JSON.stringify(sub)))
   ```
3. Run the test script:
   ```bash
   node test-push.js
   ```
4. Follow the interactive prompts
5. Paste your subscription object
6. Enter test values (tram number, minutes)

**Expected Result:**
- Script shows "✅ Push notification sent successfully!"
- Notification appears on your device
- Notification contains correct tram number and time

**Pass Criteria:** 
- ✅ Notification received
- ✅ Correct data displayed

---

### Test 4.2: Notification Click Handling

**Steps:**
1. Receive a push notification (from Test 4.1)
2. Click on the notification

**Expected Result:**
- If app tab is open: tab gets focused
- If app tab is closed: new tab opens to http://localhost:3000

**Pass Criteria:** ✅ Click action works correctly

---

### Test 4.3: Automatic Notification (Real Tram)

**Steps:**
1. Subscribe to a stop that has active tram routes
2. Set notification time to a high value (10-15 minutes)
3. Start monitoring the stop
4. Wait for a tram to be within notification range

**Expected Result:**
- Push notification appears automatically
- Console shows: "✅ Push notification sent for tram [number] at stop [stopId]"
- Notification shows correct ETA

**Pass Criteria:** 
- ✅ Auto-notification sent
- ✅ Correct timing and data

---

### Test 4.4: Cooldown Mechanism

**Steps:**
1. Subscribe to a stop
2. Trigger a notification for a specific tram
3. Wait < 5 minutes
4. Try to trigger another notification for the same tram

**Expected Result:**
- Second notification is NOT sent (within cooldown)
- No console message about sending
- After 5+ minutes, notification is sent again

**Pass Criteria:** ✅ Cooldown prevents spam

---

### Test 4.5: Invalid Subscription Removal

**Steps:**
1. Subscribe to a stop
2. In browser DevTools → Application → Service Workers → Unregister
3. Trigger a notification (tram approaching)

**Expected Result:**
- Server attempts to send notification
- Receives 404/410 error
- Console shows: "Removed invalid subscription"
- Subscription is deleted from server

**Pass Criteria:** ✅ Invalid subscriptions auto-removed

---

## Test Suite 5: Retry Logic

### Test 5.1: Network Failure Simulation

**Note:** This requires modifying code temporarily or using a proxy to simulate network failures.

**Approach 1: Code Modification**
1. In `server.js`, temporarily modify `sendPushWithRetry` to always throw an error on first attempt
2. Subscribe and trigger notification
3. Observe retry attempts in console

**Expected Result:**
- Console shows: "Push send failed, retrying... (2 attempts left)"
- Console shows: "Push send failed, retrying... (1 attempt left)"
- Eventually succeeds or fails after 3 attempts

**Pass Criteria:** ✅ Retry mechanism activates

---

## Test Suite 6: Configuration

### Test 6.1: Environment Variables

**Steps:**
1. Create `.env` file from `.env.example`
2. Set custom `PORT=4000`
3. Restart server: `npm start`

**Expected Result:**
- Server starts on port 4000
- Console shows: "🚊 Transport Radar Russia запущен на http://localhost:4000"

**Pass Criteria:** ✅ Environment variables work

---

### Test 6.2: Generate VAPID Keys

**Steps:**
```bash
npm run generate-keys
```

**Expected Result:**
- Displays new public and private VAPID keys
- Shows format to add to .env file

**Pass Criteria:** ✅ New keys generated successfully

---

## Test Suite 7: Cross-Browser Testing

### Test 7.1: Chrome
- ✅ Service Worker registers
- ✅ Notifications work
- ✅ Click handling works

### Test 7.2: Firefox
- ✅ Service Worker registers
- ✅ Notifications work
- ✅ Click handling works

### Test 7.3: Edge
- ✅ Service Worker registers
- ✅ Notifications work
- ✅ Click handling works

### Test 7.4: Safari (macOS 16+)
- ✅ Service Worker registers
- ✅ Notifications work
- ✅ Click handling works

**Note:** Safari on iOS does not support push notifications.

---

## Test Suite 8: Performance & Load

### Test 8.1: Multiple Subscriptions

**Steps:**
1. Subscribe to 10 different stops
2. Monitor server memory usage
3. Check subscription count in server console

**Expected Result:**
- All subscriptions stored successfully
- Memory usage remains reasonable
- No performance degradation

**Pass Criteria:** ✅ Handles multiple subscriptions

---

### Test 8.2: Subscription Limit

**Steps:**
1. Attempt to create 101 subscriptions for the same stop (requires script)
2. Observe server response

**Expected Result:**
- After 100 subscriptions, server returns 429 error
- Error message: "Слишком много подписок на эту остановку"

**Pass Criteria:** ✅ Subscription limit enforced

---

## Common Issues & Troubleshooting

### Issue: Notification permission denied
**Solution:** Reset browser permissions in Settings → Privacy → Site Settings → Notifications

### Issue: Service worker not updating
**Solution:** 
1. DevTools → Application → Service Workers
2. Check "Update on reload"
3. Refresh page

### Issue: Push not received
**Debugging:**
1. Check browser console for errors
2. Verify subscription exists: `navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(console.log)`
3. Check server console for send attempts
4. Verify VAPID keys match

### Issue: Rate limit triggered
**Solution:** Wait 1 minute or restart server to reset

---

## Success Criteria Summary

All tests should pass with the following results:

- ✅ Unit tests: 5/5 passed
- ✅ Service Worker: Registered and active
- ✅ Subscribe/Unsubscribe: Working correctly
- ✅ API validation: Rejecting invalid inputs
- ✅ Rate limiting: Enforced
- ✅ Push delivery: Notifications received
- ✅ Click handling: Navigation works
- ✅ Auto-notifications: Triggered correctly
- ✅ Cooldown: Spam prevented
- ✅ Invalid subscription cleanup: Working
- ✅ Retry logic: Functions as expected
- ✅ Environment config: Variables applied
- ✅ Cross-browser: Works in major browsers
- ✅ Performance: No degradation under load

---

## Reporting Issues

If any test fails, please report with:
1. Test suite and test number
2. Expected vs actual result
3. Browser and version
4. Console errors (if any)
5. Network tab details (for API tests)

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-12
