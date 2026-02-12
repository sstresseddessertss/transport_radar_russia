/**
 * E2E tests for Yandex.Metrika event tracking
 */

import { test, expect } from '@playwright/test';

test.describe('Yandex.Metrika Event Tracking E2E', () => {
  test.beforeEach(async ({ page }) => {
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

  test('should initialize analytics with correct ID from config', async ({ page }) => {
    // Check that analytics is initialized
    const isEnabled = await page.evaluate(() => {
      return window.Analytics && window.Analytics.isEnabled();
    });
    
    expect(isEnabled).toBe(true);
  });

  test('should track stop_selected event when stop is selected', async ({ page }) => {
    // Mock the API response for stop data
    await page.route('**/api/stop/*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Test Stop',
          routePath: [
            { number: '5', type: 'tram', externalForecast: [] }
          ]
        })
      });
    });
    
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

  test('should include metadata in all events', async ({ page }) => {
    // Mock the API response
    await page.route('**/api/stop/*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Test Stop',
          routePath: [{ number: '5', type: 'tram', externalForecast: [] }]
        })
      });
    });
    
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

  test('should not send events when analytics is disabled', async ({ page }) => {
    // Disable analytics by reinitializing without ID
    await page.evaluate(() => {
      window.Analytics.init('');
    });
    
    // Verify analytics is disabled
    const analyticsEnabled = await page.evaluate(() => window.Analytics.isEnabled());
    expect(analyticsEnabled).toBe(false);
    
    // Clear any existing events
    await page.evaluate(() => { window._trackedEvents = []; });
    
    // Try to track an event manually
    await page.evaluate(() => {
      window.Analytics.trackStopSelected({
        stop_id: 'test-123',
        stop_name: 'Test',
        route: 'Test'
      });
    });
    
    await page.waitForTimeout(500);
    
    // Get tracked events - should be empty since analytics is disabled
    const events = await page.evaluate(() => window._trackedEvents || []);
    
    // No events should have been tracked
    expect(events.length).toBe(0);
  });
});

