# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added - 2026-02-12
- **Yandex.Metrika Integration**: Added analytics tracking for user interactions
  - Environment variable `YANDEX_METRIKA_ID` for configuring analytics counter
  - Analytics wrapper API (`analytics.js`) for normalized event tracking
  - Event tracking for key user actions:
    - `stop_selected`: Fired when user selects a stop
    - `subscribe_push`: Fired when user subscribes to push notifications
    - `notification_clicked`: Fired when user clicks on a notification
  - All events include contextual metadata (stop_id, route, user_action, timestamp)
  - Analytics script only loads when YANDEX_METRIKA_ID is configured
  - Unit and E2E tests for analytics functionality
