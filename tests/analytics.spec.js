/**
 * Unit tests for Analytics wrapper
 * Run in browser context using Playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Analytics Wrapper', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a blank page and inject analytics.js
    await page.goto('about:blank');
    await page.addScriptTag({ path: './public/analytics.js' });
  });

  test('should initialize with valid ID', async ({ page }) => {
    const isEnabled = await page.evaluate(() => {
      window.Analytics.init('12345678');
      return window.Analytics.isEnabled();
    });
    expect(isEnabled).toBe(true);
  });

  test('should not enable without ID', async ({ page }) => {
    const isEnabled = await page.evaluate(() => {
      window.Analytics.init('');
      return window.Analytics.isEnabled();
    });
    expect(isEnabled).toBe(false);
  });

  test('should not enable with null ID', async ({ page }) => {
    const isEnabled = await page.evaluate(() => {
      window.Analytics.init(null);
      return window.Analytics.isEnabled();
    });
    expect(isEnabled).toBe(false);
  });

  test('should format stop_selected event correctly', async ({ page }) => {
    const eventData = await page.evaluate(() => {
      window.Analytics.init('12345678');
      
      // Mock ym function to capture calls
      let capturedEvent = null;
      window.ym = (id, method, eventName, payload) => {
        capturedEvent = { id, method, eventName, payload };
      };
      
      window.Analytics.trackStopSelected({
        stop_id: 'test-uuid-123',
        stop_name: 'Test Stop',
        route: 'Test Route',
        user_id: 'user-123'
      });
      
      return capturedEvent;
    });

    expect(eventData).toBeTruthy();
    expect(eventData.eventName).toBe('stop_selected');
    expect(eventData.payload.stop_id).toBe('test-uuid-123');
    expect(eventData.payload.stop_name).toBe('Test Stop');
    expect(eventData.payload.route).toBe('Test Route');
    expect(eventData.payload.user_id).toBe('user-123');
    expect(eventData.payload.user_action).toBe('select_stop');
    expect(eventData.payload.source).toBe('ui');
    expect(eventData.payload.timestamp).toBeTruthy();
  });

  test('should format subscribe_push event correctly', async ({ page }) => {
    const eventData = await page.evaluate(() => {
      window.Analytics.init('12345678');
      
      let capturedEvent = null;
      window.ym = (id, method, eventName, payload) => {
        capturedEvent = { id, method, eventName, payload };
      };
      
      window.Analytics.trackSubscribePush({
        stop_id: 'test-uuid-123',
        route: '5',
        subscription_status: 'subscribed',
        notification_id: 'notif-123'
      });
      
      return capturedEvent;
    });

    expect(eventData).toBeTruthy();
    expect(eventData.eventName).toBe('subscribe_push');
    expect(eventData.payload.stop_id).toBe('test-uuid-123');
    expect(eventData.payload.route).toBe('5');
    expect(eventData.payload.subscription_status).toBe('subscribed');
    expect(eventData.payload.notification_id).toBe('notif-123');
    expect(eventData.payload.user_action).toBe('subscribe_notification');
    expect(eventData.payload.source).toBe('ui');
  });

  test('should format notification_clicked event correctly', async ({ page }) => {
    const eventData = await page.evaluate(() => {
      window.Analytics.init('12345678');
      
      let capturedEvent = null;
      window.ym = (id, method, eventName, payload) => {
        capturedEvent = { id, method, eventName, payload };
      };
      
      window.Analytics.trackNotificationClicked({
        stop_id: 'test-uuid-123',
        route: '5',
        notification_id: 'notif-123',
        user_id: 'user-123'
      });
      
      return capturedEvent;
    });

    expect(eventData).toBeTruthy();
    expect(eventData.eventName).toBe('notification_clicked');
    expect(eventData.payload.stop_id).toBe('test-uuid-123');
    expect(eventData.payload.route).toBe('5');
    expect(eventData.payload.notification_id).toBe('notif-123');
    expect(eventData.payload.user_action).toBe('click_notification');
  });

  test('should not send events when disabled', async ({ page }) => {
    const eventData = await page.evaluate(() => {
      // Don't initialize analytics
      
      let capturedEvent = null;
      window.ym = (id, method, eventName, payload) => {
        capturedEvent = { id, method, eventName, payload };
      };
      
      window.Analytics.trackStopSelected({
        stop_id: 'test-uuid-123',
        stop_name: 'Test Stop',
        route: 'Test Route'
      });
      
      return capturedEvent;
    });

    expect(eventData).toBeNull();
  });

  test('should include timestamp in all events', async ({ page }) => {
    const eventData = await page.evaluate(() => {
      window.Analytics.init('12345678');
      
      let capturedEvent = null;
      window.ym = (id, method, eventName, payload) => {
        capturedEvent = { id, method, eventName, payload };
      };
      
      window.Analytics.trackEvent('custom_event', { test: 'data' });
      
      return capturedEvent;
    });

    expect(eventData.payload.timestamp).toBeTruthy();
    const timestamp = new Date(eventData.payload.timestamp);
    expect(timestamp).toBeInstanceOf(Date);
    expect(timestamp.getTime()).toBeGreaterThan(0);
  });
});
