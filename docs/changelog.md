# Changelog

All notable changes to Transport Radar Russia will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2026-02-12
- **GPS Timing and ETA Indicator**: New feature that provides estimated time of arrival (ETA) for trams with confidence indicators
  - Backend endpoint `GET /api/runs/{runId}/eta` returns ETA data including:
    - Absolute ETA timestamp (ISO 8601 format)
    - ETA in seconds
    - Confidence score (0.0-1.0) based on data source
    - Generation timestamp
  - Frontend ETA badge component displays:
    - Human-readable ETA (e.g., "2 min")
    - Color-coded confidence levels (green for high, yellow for medium, gray for low)
    - Tooltip showing confidence percentage on hover
    - Full accessibility support with ARIA labels
  - Automatic polling every 20 seconds to keep ETA data fresh
  - Client-side caching (25s) and server-side caching (15s) to reduce load
  - Rate limiting (60 requests/minute per IP) to prevent abuse
  - Graceful degradation when ETA data unavailable

### Technical Details
- ETA calculation uses GPS telemetry data when available (higher confidence 0.75-0.95)
- Falls back to schedule-based predictions (lower confidence 0.50-0.60)
- runId format: `{stopUuid}_{tramNumber}_{vehicleId}_{time}`
- Model usage: Claude Sonnet 4.5 for implementation, GPT-5 mini for documentation
