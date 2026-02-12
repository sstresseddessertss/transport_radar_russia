-- Database schema for persistent subscription storage
-- This is a future enhancement. Current implementation uses in-memory storage.

-- Table for push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    stop_id VARCHAR(255) NOT NULL,
    subscription_json JSONB NOT NULL,
    notification_minutes INTEGER DEFAULT 3,
    user_id VARCHAR(255),  -- Optional: for multi-user support
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(stop_id, subscription_json->>'endpoint')
);

-- Index for faster lookups by stop_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_stop_id ON push_subscriptions(stop_id);

-- Index for finding active subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON push_subscriptions(is_active, last_active);

-- Index for user subscriptions (if user_id is used)
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON push_subscriptions(user_id) WHERE user_id IS NOT NULL;

-- Table for tracking sent notifications (for analytics and debugging)
CREATE TABLE IF NOT EXISTS notification_history (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER REFERENCES push_subscriptions(id) ON DELETE CASCADE,
    stop_id VARCHAR(255) NOT NULL,
    tram_number VARCHAR(50) NOT NULL,
    arrival_minutes INTEGER NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'sent',  -- sent, failed, invalid_subscription
    error_message TEXT
);

-- Index for notification history lookups
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON notification_history(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_history_subscription ON notification_history(subscription_id);

-- Cleanup function to remove old inactive subscriptions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_subscriptions(days_inactive INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM push_subscriptions
    WHERE last_active < CURRENT_TIMESTAMP - (days_inactive || ' days')::INTERVAL
    AND is_active = FALSE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function to remove old notification history (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_notification_history(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notification_history
    WHERE sent_at < CURRENT_TIMESTAMP - (days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Example queries:

-- Get all active subscriptions for a stop
-- SELECT * FROM push_subscriptions WHERE stop_id = 'some-uuid' AND is_active = TRUE;

-- Get subscription statistics
-- SELECT 
--   stop_id,
--   COUNT(*) as subscription_count,
--   MAX(last_active) as most_recent_activity
-- FROM push_subscriptions
-- WHERE is_active = TRUE
-- GROUP BY stop_id;

-- Get notification statistics
-- SELECT 
--   DATE(sent_at) as date,
--   status,
--   COUNT(*) as count
-- FROM notification_history
-- WHERE sent_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
-- GROUP BY DATE(sent_at), status
-- ORDER BY date DESC;
