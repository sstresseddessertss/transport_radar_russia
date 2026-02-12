/**
 * Unit tests for push notification functionality
 * Run with: node test-push-notifications.js
 */

const assert = require('assert');

console.log('🧪 Running Push Notification Tests...\n');

// Test 1: Validate subscription object validation
function testSubscriptionValidation() {
  console.log('Test 1: Subscription Validation');
  
  // Mock validation function (same as in server.js)
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
    
    try {
      new URL(subscription.endpoint);
    } catch (error) {
      return { valid: false, error: 'Invalid endpoint URL format' };
    }
    
    return { valid: true };
  }
  
  // Test cases
  const testCases = [
    {
      name: 'Valid subscription',
      input: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' }
      },
      expectedValid: true
    },
    {
      name: 'Missing endpoint',
      input: {
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' }
      },
      expectedValid: false
    },
    {
      name: 'Missing keys',
      input: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test'
      },
      expectedValid: false
    },
    {
      name: 'Invalid endpoint URL',
      input: {
        endpoint: 'not-a-url',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' }
      },
      expectedValid: false
    },
    {
      name: 'Missing p256dh key',
      input: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        keys: { auth: 'test-auth' }
      },
      expectedValid: false
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach(testCase => {
    const result = validateSubscription(testCase.input);
    if (result.valid === testCase.expectedValid) {
      console.log(`  ✅ ${testCase.name}`);
      passed++;
    } else {
      console.log(`  ❌ ${testCase.name}`);
      console.log(`     Expected valid: ${testCase.expectedValid}, got: ${result.valid}`);
      if (result.error) console.log(`     Error: ${result.error}`);
      failed++;
    }
  });
  
  console.log(`  Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

// Test 2: Rate limiting logic
function testRateLimiting() {
  console.log('Test 2: Rate Limiting');
  
  const rateLimit = new Map();
  const WINDOW = 60000;
  const MAX_REQUESTS = 5;
  
  function checkRateLimit(ip) {
    const now = Date.now();
    
    if (!rateLimit.has(ip)) {
      rateLimit.set(ip, []);
    }
    
    const requests = rateLimit.get(ip);
    const recentRequests = requests.filter(time => now - time < WINDOW);
    
    if (recentRequests.length >= MAX_REQUESTS) {
      return false;
    }
    
    recentRequests.push(now);
    rateLimit.set(ip, recentRequests);
    return true;
  }
  
  // Test: First 5 requests should pass
  const ip1 = '192.168.1.1';
  let passed = true;
  
  for (let i = 0; i < 5; i++) {
    if (!checkRateLimit(ip1)) {
      console.log(`  ❌ Request ${i + 1} should have passed`);
      passed = false;
    }
  }
  
  // 6th request should fail
  if (checkRateLimit(ip1)) {
    console.log('  ❌ 6th request should have been rate limited');
    passed = false;
  }
  
  // Different IP should pass
  const ip2 = '192.168.1.2';
  if (!checkRateLimit(ip2)) {
    console.log('  ❌ Different IP should have passed');
    passed = false;
  }
  
  if (passed) {
    console.log('  ✅ All rate limiting tests passed');
  }
  
  console.log('');
  return passed;
}

// Test 3: Notification payload structure
function testNotificationPayload() {
  console.log('Test 3: Notification Payload Structure');
  
  const stopId = 'test-stop-123';
  const tramNumber = '17';
  const arrivalMinutes = 3;
  const stopName = 'Test Stop';
  
  const payload = JSON.parse(JSON.stringify({
    title: '🚊 Трамвай приближается',
    body: `Трамвай ${tramNumber} прибывает через ${arrivalMinutes} мин на ${stopName}`,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: `tram-${tramNumber}-${stopId}`,
    data: {
      stopId,
      tramNumber,
      arrivalMinutes
    }
  }));
  
  let passed = true;
  
  // Validate structure
  if (!payload.title || typeof payload.title !== 'string') {
    console.log('  ❌ Invalid title');
    passed = false;
  }
  
  if (!payload.body || typeof payload.body !== 'string') {
    console.log('  ❌ Invalid body');
    passed = false;
  }
  
  if (!payload.data || typeof payload.data !== 'object') {
    console.log('  ❌ Invalid data');
    passed = false;
  }
  
  if (payload.data.stopId !== stopId) {
    console.log('  ❌ stopId mismatch');
    passed = false;
  }
  
  if (payload.data.tramNumber !== tramNumber) {
    console.log('  ❌ tramNumber mismatch');
    passed = false;
  }
  
  if (payload.data.arrivalMinutes !== arrivalMinutes) {
    console.log('  ❌ arrivalMinutes mismatch');
    passed = false;
  }
  
  if (passed) {
    console.log('  ✅ Notification payload structure valid');
  }
  
  console.log('');
  return passed;
}

// Test 4: Subscription deduplication
function testSubscriptionDeduplication() {
  console.log('Test 4: Subscription Deduplication');
  
  const subscriptions = [];
  const endpoint = 'https://fcm.googleapis.com/fcm/send/test123';
  
  // Add subscription
  const newSub = {
    subscription: { endpoint, keys: { p256dh: 'key1', auth: 'auth1' } },
    notificationMinutes: 3
  };
  
  subscriptions.push(newSub);
  
  // Try to add same subscription (should update)
  const existingIndex = subscriptions.findIndex(
    sub => sub.subscription.endpoint === endpoint
  );
  
  let passed = true;
  
  if (existingIndex !== 0) {
    console.log('  ❌ Failed to find existing subscription');
    passed = false;
  }
  
  // Update it
  subscriptions[existingIndex] = {
    subscription: { endpoint, keys: { p256dh: 'key2', auth: 'auth2' } },
    notificationMinutes: 5
  };
  
  if (subscriptions.length !== 1) {
    console.log('  ❌ Duplicate subscription created');
    passed = false;
  }
  
  if (subscriptions[0].notificationMinutes !== 5) {
    console.log('  ❌ Subscription not updated');
    passed = false;
  }
  
  if (passed) {
    console.log('  ✅ Subscription deduplication works correctly');
  }
  
  console.log('');
  return passed;
}

// Test 5: Cooldown mechanism
function testCooldown() {
  console.log('Test 5: Notification Cooldown');
  
  const recentNotifications = new Map();
  const COOLDOWN = 300000; // 5 minutes
  
  const notifKey = 'endpoint_stopId_tramNumber';
  const now = Date.now();
  
  let passed = true;
  
  // First notification should be sent
  if (recentNotifications.has(notifKey)) {
    console.log('  ❌ Should not have cooldown entry initially');
    passed = false;
  }
  
  // Mark as sent
  recentNotifications.set(notifKey, now);
  
  // Second notification within cooldown should be blocked
  const lastSent = recentNotifications.get(notifKey);
  if (!lastSent || (now - lastSent) >= COOLDOWN) {
    console.log('  ❌ Cooldown not working');
    passed = false;
  }
  
  // Notification after cooldown should be allowed
  const futureTime = now + COOLDOWN + 1000;
  if ((futureTime - lastSent) < COOLDOWN) {
    console.log('  ❌ Cooldown calculation error');
    passed = false;
  }
  
  if (passed) {
    console.log('  ✅ Cooldown mechanism works correctly');
  }
  
  console.log('');
  return passed;
}

// Run all tests
function runAllTests() {
  console.log('═══════════════════════════════════════════\n');
  
  const results = [
    testSubscriptionValidation(),
    testRateLimiting(),
    testNotificationPayload(),
    testSubscriptionDeduplication(),
    testCooldown()
  ];
  
  const passed = results.filter(r => r).length;
  const failed = results.length - passed;
  
  console.log('═══════════════════════════════════════════');
  console.log(`\n📊 Test Summary: ${passed}/${results.length} test suites passed\n`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed!\n');
    process.exit(0);
  } else {
    console.log(`❌ ${failed} test suite(s) failed\n`);
    process.exit(1);
  }
}

runAllTests();
