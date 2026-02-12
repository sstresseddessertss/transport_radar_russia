# Architecture Decision Records

This document records important architectural decisions made during the development of Transport Radar Russia.

## GPS Timing and ETA Indicator

**Date:** 2026-02-12  
**Status:** Implemented  
**Decision Makers:** Development team  
**Model Usage:** Claude Sonnet 4.5 for code generation (backend + frontend), GPT-5 mini for documentation snippets

### Context

Users monitoring tram arrivals needed a way to see estimated time of arrival (ETA) with confidence levels to help them plan their departure timing. The existing system showed raw arrival times in minutes but lacked:
1. Absolute ETA timestamps for better planning
2. Confidence indicators to distinguish GPS-based (accurate) from schedule-based (approximate) predictions
3. A visual component that updates automatically

### Decision

We implemented a comprehensive ETA system consisting of:

#### Backend (server.js)
- **Endpoint:** `GET /api/runs/{runId}/eta`
- **runId Format:** `{stopUuid}_{tramNumber}_{vehicleId}_{time}`
  - Uniquely identifies a specific vehicle forecast
  - Allows tracking individual tram runs
  
#### ETA Calculation Algorithm

The ETA is calculated based on the forecast data from the Moscow Transport API:

1. **Data Source Detection:**
   - Check `byTelemetry` field to determine if forecast is GPS-based (value = 1) or schedule-based (value ≠ 1)

2. **Time Calculation:**
   - Extract `time` field from forecast (in seconds)
   - Calculate absolute ETA: `current_time + time_seconds`
   - Round to nearest second for consistency

3. **Confidence Scoring:**
   - **GPS-based predictions** (higher confidence):
     - < 5 minutes: 0.95 confidence
     - 5-10 minutes: 0.90 confidence
     - 10-15 minutes: 0.85 confidence
     - > 15 minutes: 0.75 confidence
   - **Schedule-based predictions** (lower confidence):
     - < 5 minutes: 0.60 confidence
     - ≥ 5 minutes: 0.50 confidence
   
   Rationale: GPS telemetry provides real-time vehicle positions, making predictions more accurate. Confidence decreases with prediction distance due to increasing uncertainty in traffic conditions.

4. **Fallback Strategy:**
   - If exact vehicle match not found, use closest forecast for same tram number
   - Return 404 if no matching data available
   - This handles cases where vehicle data becomes stale

#### Caching Strategy

**Server-side caching (15 seconds TTL):**
- Reduces load on external Moscow Transport API
- Balances freshness with performance
- Includes cache expiration in response headers

**Client-side caching (25 seconds):**
- Prevents redundant requests during polling
- Slightly longer than server cache to avoid constant misses
- Cleared when monitoring stops

**Polling interval (20 seconds):**
- Provides timely updates without overwhelming the server
- Aligned with typical tram arrival update frequency
- Configurable for future tuning

#### Rate Limiting

- **Limit:** 60 requests per minute per IP address
- **Window:** Rolling 60-second window
- **Rationale:** Allows one request per second on average, sufficient for normal usage while preventing abuse

#### Frontend Component

**ETA Badge Visual Design:**
- Color-coded by confidence level:
  - High (≥80%): Green - indicates GPS data, highly reliable
  - Medium (≥60%): Yellow - indicates less reliable GPS or good schedule data
  - Low (<60%): Gray - indicates schedule-based approximation
- Icon: ⏱️ for visual identification
- Time format: "X min" for readability
- Tooltip: Shows exact confidence percentage on hover

**Accessibility:**
- `aria-label` attributes describe ETA and confidence for screen readers
- `role="status"` indicates live-updating content
- Keyboard-navigable tooltips
- Sufficient color contrast for visual clarity

### Alternatives Considered

1. **WebSocket-based real-time updates:**
   - Rejected: Added complexity, external API doesn't support WebSockets
   - Polling is simpler and sufficient for update frequency needed

2. **Predictive ML model for ETA:**
   - Rejected: Would require historical data collection and training
   - Current algorithm using API forecasts is adequate and simpler

3. **Longer cache TTL (60+ seconds):**
   - Rejected: Would make ETA data feel stale
   - 15-20 seconds balances freshness and load

4. **Per-user authentication for rate limiting:**
   - Rejected: Application is anonymous, IP-based limiting sufficient
   - Keeps implementation simple

### Consequences

**Positive:**
- Users can better plan departure timing with ETA information
- Confidence indicators help users understand prediction reliability
- Caching reduces server and API load significantly
- Graceful degradation maintains usability if ETA unavailable
- Accessible to all users including screen reader users

**Negative:**
- Additional API calls increase backend load (mitigated by caching)
- Requires external API availability (handled with error states)
- Client-side JavaScript requirement for ETA display

**Neutral:**
- Adds complexity to codebase (balanced by modular design)
- runId format must remain stable for backwards compatibility

### Monitoring and Metrics

Future improvements could track:
- ETA accuracy (predicted vs. actual arrival)
- Cache hit rates
- API failure rates
- User interaction with confidence tooltips

### Configuration

The following parameters are configurable in the code:

**Server (server.js):**
```javascript
const ETA_CACHE_TTL = 15000; // 15 seconds
const MAX_ETA_REQUESTS_PER_WINDOW = 60; // 60 requests per minute
```

**Client (public/app.js):**
```javascript
const ETA_POLLING_INTERVAL = 20000; // 20 seconds
const ETA_CACHE_DURATION = 25000; // 25 seconds
```

These can be adjusted based on:
- Server capacity
- API rate limits
- User experience requirements
- Network conditions

### References

- Moscow Transport API: https://moscowtransport.app/
- Existing tram tracking infrastructure in server.js
- Frontend monitoring system in public/app.js
