#!/usr/bin/env node

/**
 * Test script for push notification emulation
 * 
 * This script helps test push notifications without waiting for real tram arrivals.
 * It sends a test notification to all subscribed endpoints.
 * 
 * Usage:
 *   node test-push.js [stopId] [tramNumber] [arrivalMinutes]
 * 
 * Examples:
 *   node test-push.js                           # Interactive mode
 *   node test-push.js 123 17 2                 # Send test for tram 17 arriving in 2 min
 */

const webpush = require('web-push');
const readline = require('readline');

// Configure VAPID keys (same as in server.js)
// WARNING: These are development-only keys for testing purposes.
// In production, always use environment variables or the keys will be exposed!
const VAPID_PUBLIC_KEY = process.env.PUBLIC_VAPID_KEY || 'BNqjZcSrxDzfY2S36e1sNne9Mzw6hWnxYHyJysWN9ZpvBxVDThtvMCiKmxufVRUyoBL8ZE4RqVDlU5s636Ayhls';
const VAPID_PRIVATE_KEY = process.env.PRIVATE_VAPID_KEY || '-8qg68XULGxzg8CPtcQNxhgaywt7XIaF1_NTLhcD7Y4';

webpush.setVapidDetails(
  'mailto:admin@transport-radar.ru',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Test subscription endpoint (replace with real subscription from browser console)
const TEST_SUBSCRIPTION = {
  endpoint: 'PASTE_SUBSCRIPTION_ENDPOINT_HERE',
  keys: {
    p256dh: 'PASTE_P256DH_KEY_HERE',
    auth: 'PASTE_AUTH_KEY_HERE'
  }
};

/**
 * Send a test push notification
 */
async function sendTestNotification(stopId, tramNumber, arrivalMinutes, subscription) {
  const payload = JSON.stringify({
    title: '🚊 Трамвай приближается (ТЕСТ)',
    body: `Трамвай ${tramNumber} прибывает через ${arrivalMinutes} мин на остановку (тестовое уведомление)`,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: `tram-${tramNumber}-${stopId}`,
    data: {
      stopId,
      tramNumber,
      arrivalMinutes,
      test: true
    }
  });

  try {
    const result = await webpush.sendNotification(subscription, payload);
    console.log('✅ Push notification sent successfully!');
    console.log('Response:', result.statusCode, result.body);
    return true;
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    if (error.statusCode) {
      console.error('Status code:', error.statusCode);
      console.error('Headers:', error.headers);
      console.error('Body:', error.body);
    }
    return false;
  }
}

/**
 * Interactive mode - prompt user for input
 */
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise((resolve) => {
    rl.question(prompt, resolve);
  });

  console.log('\n🚊 Push Notification Test Tool\n');
  console.log('This tool sends a test push notification to a subscribed endpoint.\n');
  
  console.log('First, you need to get the subscription object from your browser:');
  console.log('1. Open the app in your browser');
  console.log('2. Subscribe to notifications for a stop');
  console.log('3. Open browser console and run:');
  console.log('   navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription().then(sub => console.log(JSON.stringify(sub))))');
  console.log('4. Copy the entire subscription object\n');

  const hasSubscription = await question('Do you have a subscription object? (yes/no): ');
  
  if (hasSubscription.toLowerCase() !== 'yes' && hasSubscription.toLowerCase() !== 'y') {
    console.log('\nPlease get a subscription object first and run this script again.');
    rl.close();
    return;
  }

  console.log('\nPaste the subscription object (as one line) and press Enter:');
  const subInput = await question('> ');
  
  let subscription;
  try {
    subscription = JSON.parse(subInput);
    if (!subscription.endpoint || !subscription.keys) {
      throw new Error('Invalid subscription format');
    }
  } catch (error) {
    console.error('❌ Invalid subscription object:', error.message);
    rl.close();
    return;
  }

  const stopId = await question('\nEnter stop ID (or press Enter for "test-stop"): ') || 'test-stop';
  const tramNumber = await question('Enter tram number (or press Enter for "99"): ') || '99';
  const arrivalMinutes = await question('Enter arrival time in minutes (or press Enter for "2"): ') || '2';

  console.log('\n📤 Sending test notification...\n');
  
  const success = await sendTestNotification(
    stopId,
    tramNumber,
    parseInt(arrivalMinutes),
    subscription
  );

  if (success) {
    console.log('\n✅ Check your device for the notification!');
  } else {
    console.log('\n❌ Failed to send notification. Check the error above.');
  }

  rl.close();
}

/**
 * Command-line mode
 */
async function commandLineMode(stopId, tramNumber, arrivalMinutes) {
  console.log('\n🚊 Push Notification Test (Command-line mode)\n');
  
  if (TEST_SUBSCRIPTION.endpoint === 'PASTE_SUBSCRIPTION_ENDPOINT_HERE') {
    console.error('❌ Error: Please edit test-push.js and add a real subscription object.');
    console.error('\nHow to get a subscription:');
    console.error('1. Open the app in your browser and subscribe to notifications');
    console.error('2. Open browser console and run:');
    console.error('   navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription().then(sub => console.log(JSON.stringify(sub))))');
    console.error('3. Copy the output and paste it into TEST_SUBSCRIPTION in test-push.js\n');
    process.exit(1);
  }

  console.log(`Stop ID: ${stopId}`);
  console.log(`Tram Number: ${tramNumber}`);
  console.log(`Arrival Time: ${arrivalMinutes} minutes\n`);

  const success = await sendTestNotification(
    stopId,
    tramNumber,
    parseInt(arrivalMinutes),
    TEST_SUBSCRIPTION
  );

  if (success) {
    console.log('\n✅ Check your device for the notification!');
  } else {
    console.log('\n❌ Failed to send notification. Check the error above.');
  }
}

/**
 * Generate VAPID keys
 */
function generateVapidKeys() {
  console.log('\n🔑 Generating new VAPID keys...\n');
  const vapidKeys = webpush.generateVAPIDKeys();
  console.log('Public Key:');
  console.log(vapidKeys.publicKey);
  console.log('\nPrivate Key:');
  console.log(vapidKeys.privateKey);
  console.log('\nAdd these to your .env file:');
  console.log(`PUBLIC_VAPID_KEY=${vapidKeys.publicKey}`);
  console.log(`PRIVATE_VAPID_KEY=${vapidKeys.privateKey}\n`);
}

// Main
const args = process.argv.slice(2);

if (args[0] === '--help' || args[0] === '-h') {
  console.log(`
🚊 Push Notification Test Tool

Usage:
  node test-push.js                            # Interactive mode
  node test-push.js [stopId] [tram] [minutes]  # Command-line mode
  node test-push.js --generate-keys            # Generate new VAPID keys

Examples:
  node test-push.js                            # Interactive prompts
  node test-push.js test-stop 17 2             # Send test for tram 17 in 2 min
  node test-push.js --generate-keys            # Generate VAPID keys

Note: For command-line mode, edit TEST_SUBSCRIPTION in this file first.
`);
  process.exit(0);
}

if (args[0] === '--generate-keys' || args[0] === '-g') {
  generateVapidKeys();
  process.exit(0);
}

if (args.length === 0) {
  // Interactive mode
  interactiveMode().catch(console.error);
} else if (args.length === 3) {
  // Command-line mode
  commandLineMode(args[0], args[1], args[2]).catch(console.error);
} else {
  console.error('❌ Invalid arguments. Use --help for usage information.');
  process.exit(1);
}
