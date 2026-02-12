/**
 * Analytics wrapper for Yandex.Metrika
 * Provides a normalized API for tracking events
 * Only sends events when YANDEX_METRIKA_ID is configured
 */

// Analytics singleton
const Analytics = (function() {
    let metrikaId = null;
    let initialized = false;

    /**
     * Initialize analytics with Yandex.Metrika ID
     * @param {string} id - Yandex.Metrika counter ID
     */
    function init(id) {
        if (!id) {
            console.log('[Analytics] No Yandex.Metrika ID provided, analytics disabled');
            return;
        }

        metrikaId = id;
        initialized = true;
        console.log('[Analytics] Initialized with counter ID:', id);
    }

    /**
     * Check if analytics is enabled
     * @returns {boolean}
     */
    function isEnabled() {
        return initialized && metrikaId !== null;
    }

    /**
     * Track a custom event
     * @param {string} eventName - Name of the event
     * @param {Object} payload - Event data
     */
    function trackEvent(eventName, payload = {}) {
        if (!isEnabled()) {
            console.log('[Analytics] Event not sent (analytics disabled):', eventName, payload);
            return;
        }

        // Add metadata
        const enrichedPayload = {
            ...payload,
            timestamp: new Date().toISOString(),
            source: 'ui'
        };

        console.log('[Analytics] Tracking event:', eventName, enrichedPayload);

        // Send to Yandex.Metrika
        try {
            if (window.ym) {
                window.ym(metrikaId, 'reachGoal', eventName, enrichedPayload);
            } else {
                console.warn('[Analytics] Yandex.Metrika not loaded');
            }
        } catch (error) {
            console.error('[Analytics] Error tracking event:', error);
        }
    }

    /**
     * Track stop selection event
     * @param {Object} params
     * @param {string} params.stop_id - UUID of the selected stop
     * @param {string} params.stop_name - Name of the stop
     * @param {string} params.route - Route information
     * @param {string} [params.user_id] - Optional user identifier
     */
    function trackStopSelected(params) {
        trackEvent('stop_selected', {
            stop_id: params.stop_id,
            stop_name: params.stop_name,
            route: params.route,
            user_id: params.user_id,
            user_action: 'select_stop'
        });
    }

    /**
     * Track push subscription event
     * @param {Object} params
     * @param {string} params.stop_id - UUID of the stop
     * @param {string} params.route - Route/tram number
     * @param {string} params.subscription_status - Status of subscription (subscribed/unsubscribed)
     * @param {string} [params.user_id] - Optional user identifier
     * @param {string} [params.notification_id] - Optional notification identifier
     */
    function trackSubscribePush(params) {
        trackEvent('subscribe_push', {
            stop_id: params.stop_id,
            route: params.route,
            subscription_status: params.subscription_status,
            user_id: params.user_id,
            notification_id: params.notification_id,
            user_action: 'subscribe_notification'
        });
    }

    /**
     * Track notification click event
     * @param {Object} params
     * @param {string} params.stop_id - UUID of the stop
     * @param {string} params.route - Route/tram number
     * @param {string} params.notification_id - Notification identifier
     * @param {string} [params.user_id] - Optional user identifier
     */
    function trackNotificationClicked(params) {
        trackEvent('notification_clicked', {
            stop_id: params.stop_id,
            route: params.route,
            notification_id: params.notification_id,
            user_id: params.user_id,
            user_action: 'click_notification'
        });
    }

    // Public API
    return {
        init,
        isEnabled,
        trackEvent,
        trackStopSelected,
        trackSubscribePush,
        trackNotificationClicked
    };
})();

// Make available globally
window.Analytics = Analytics;
