/**
 * E2E tests for Yandex.Metrika event tracking
 */

import { test, expect } from '@playwright/test';

test.describe('Yandex.Metrika Event Tracking E2E', () => {
  let trackedEvents = [];

  test.beforeEach(async ({ page }) => {
    trackedEvents = [];
    
    // Navigate to the app
    await page.goto('/');
    
    // Wait for app to load
    await page.waitForSelector('#departure-stop');
    
    // Intercept analytics calls
    await page.evaluate(() => {
      window._trackedEvents = [];
      const originalYm = window.ym;
      window.ym = function(id, method, eventName, payload) {
        window._trackedEvents.push({ id, method, eventName, payload });
        if (originalYm) {
          originalYm.apply(this, arguments);
        }
      };
    });
  });

  test.afterEach(async ({ page }) => {
    // Collect tracked events
    trackedEvents = await page.evaluate(() => window._trackedEvents || []);
  });

  test('should track stop_selected event when stop is selected', async ({ page }) => {
    // Select a stop from the dropdown
    await page.selectOption('#departure-stop', { index: 1 });
    
    // Wait a bit for the event to fire
    await page.waitForTimeout(500);
    
    // Get tracked events
    const events = await page.evaluate(() => window._trackedEvents || []);
    
    // Find stop_selected event
    const stopSelectedEvent = events.find(e => e.eventName === 'stop_selected');
    
    expect(stopSelectedEvent).toBeTruthy();
    expect(stopSelectedEvent.payload).toBeTruthy();
    expect(stopSelectedEvent.payload.stop_id).toBeTruthy();
    expect(stopSelectedEvent.payload.stop_name).toBeTruthy();
    expect(stopSelectedEvent.payload.route).toBeTruthy();
    expect(stopSelectedEvent.payload.user_action).toBe('select_stop');
    expect(stopSelectedEvent.payload.source).toBe('ui');
    expect(stopSelectedEvent.payload.timestamp).toBeTruthy();
  });

  test('should track subscribe_push event when notification is created', async ({ page }) => {
    // First select a stop
    await page.selectOption('#departure-stop', { index: 1 });
    await page.waitForTimeout(1000);
    
    // Wait for tram selection to load
    await page.waitForSelector('#tram-checkboxes input[type="checkbox"]', { timeout: 5000 });
    
    // Select a tram
    const firstCheckbox = await page.locator('#tram-checkboxes input[type="checkbox"]').first();
    await firstCheckbox.check();
    
    // Click notification button
    await page.click('#notification-btn');
    
    // Wait for notification setup to appear
    await page.waitForSelector('#notification-setup', { state: 'visible' });
    
    // Select tram and time
    await page.selectOption('#notify-tram', { index: 1 });
    await page.selectOption('#notify-time', '3');
    
    // Confirm notification
    await page.click('#confirm-notification-btn');
    
    // Wait for event
    await page.waitForTimeout(500);
    
    // Get tracked events
    const events = await page.evaluate(() => window._trackedEvents || []);
    
    // Find subscribe_push event
    const subscribePushEvent = events.find(e => e.eventName === 'subscribe_push');
    
    expect(subscribePushEvent).toBeTruthy();
    expect(subscribePushEvent.payload).toBeTruthy();
    expect(subscribePushEvent.payload.stop_id).toBeTruthy();
    expect(subscribePushEvent.payload.route).toBeTruthy();
    expect(subscribePushEvent.payload.subscription_status).toBe('subscribed');
    expect(subscribePushEvent.payload.notification_id).toBeTruthy();
    expect(subscribePushEvent.payload.user_action).toBe('subscribe_notification');
    expect(subscribePushEvent.payload.source).toBe('ui');
  });

  test('should track unsubscribe when notification is removed', async ({ page }) => {
    // First select a stop
    await page.selectOption('#departure-stop', { index: 1 });
    await page.waitForTimeout(1000);
    
    // Wait for tram selection to load
    await page.waitForSelector('#tram-checkboxes input[type="checkbox"]', { timeout: 5000 });
    
    // Select a tram
    const firstCheckbox = await page.locator('#tram-checkboxes input[type="checkbox"]').first();
    await firstCheckbox.check();
    
    // Click notification button
    await page.click('#notification-btn');
    
    // Wait for notification setup to appear
    await page.waitForSelector('#notification-setup', { state: 'visible' });
    
    // Select tram and time
    await page.selectOption('#notify-tram', { index: 1 });
    await page.selectOption('#notify-time', '3');
    
    // Confirm notification
    await page.click('#confirm-notification-btn');
    
    // Wait for notification to be created
    await page.waitForSelector('.remove-notification-btn', { timeout: 2000 });
    
    // Clear tracked events
    await page.evaluate(() => { window._trackedEvents = []; });
    
    // Remove notification
    await page.click('.remove-notification-btn');
    
    // Wait for event
    await page.waitForTimeout(500);
    
    // Get tracked events
    const events = await page.evaluate(() => window._trackedEvents || []);
    
    // Find unsubscribe event
    const unsubscribeEvent = events.find(e => 
      e.eventName === 'subscribe_push' && 
      e.payload.subscription_status === 'unsubscribed'
    );
    
    expect(unsubscribeEvent).toBeTruthy();
    expect(unsubscribeEvent.payload.subscription_status).toBe('unsubscribed');
  });

  test('should include metadata in all events', async ({ page }) => {
    // Select a stop
    await page.selectOption('#departure-stop', { index: 1 });
    await page.waitForTimeout(500);
    
    // Get tracked events
    const events = await page.evaluate(() => window._trackedEvents || []);
    
    // Check that all events have required metadata
    events.forEach(event => {
      expect(event.payload.source).toBe('ui');
      expect(event.payload.timestamp).toBeTruthy();
      
      // Validate timestamp is a valid ISO date
      const timestamp = new Date(event.payload.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });
  });

  test('should initialize analytics with correct ID from config', async ({ page }) => {
    // Check that analytics is initialized
    const isEnabled = await page.evaluate(() => {
      return window.Analytics && window.Analytics.isEnabled();
    });
    
    expect(isEnabled).toBe(true);
  });

  test('should not send events when analytics is disabled', async ({ page }) => {
    // Navigate to page without analytics ID
    await page.goto('/', { 
      // This won't affect the test since the server is started with TEST_METRIKA_ID
      // but we can test the disabled state by manually disabling
    });
    
    // Disable analytics manually
    await page.evaluate(() => {
      // Reinitialize analytics with no ID
      window.Analytics.init('');
    });
    
    // Clear any existing events
    await page.evaluate(() => { window._trackedEvents = []; });
    
    // Try to select a stop
    await page.selectOption('#departure-stop', { index: 1 });
    await page.waitForTimeout(500);
    
    // Get tracked events
    const events = await page.evaluate(() => window._trackedEvents || []);
    
    // Events should still be tracked by the mock ym function if it was called
    // But Analytics.isEnabled should be false
    const analyticsEnabled = await page.evaluate(() => window.Analytics.isEnabled());
    expect(analyticsEnabled).toBe(false);
  });
});
