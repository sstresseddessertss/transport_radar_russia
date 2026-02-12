# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added - 2026-02-12

#### Arrival History Feature
- **Backend:** Implemented persistent storage for arrival events using SQLite database
  - New endpoint: `GET /api/stops/{stopId}/history` with pagination and filtering support
  - Query parameters: `page`, `page_size`, `date_from`, `date_to`, `vehicle_id`
  - Deduplication logic to prevent duplicate arrival events within 5-minute window
  - Rate limiting (30 requests per minute per IP) to prevent abuse
  - Database indexes on `stop_id` and `recorded_at` for query performance
  - Automatic persistence of arrival events when trams are tracked

- **Frontend:** Added comprehensive history view with modern UI
  - History button appears when a stop is selected
  - Paginated display of arrival events (20 items per page by default)
  - Filters: date range (from/to), vehicle ID selector
  - Loading and error states with user-friendly messages
  - Mobile-responsive design with accessible markup
  - Dark theme consistent with existing application design

- **Data:** Seeding script to generate sample historical data for testing
  - Generates realistic arrival events for past 30 days
  - Covers multiple stops and vehicles

- **Documentation:** Architecture decisions and implementation notes
  - Database schema and migration strategy
  - Performance considerations and indexing
  - Security measures including rate limiting and input validation
