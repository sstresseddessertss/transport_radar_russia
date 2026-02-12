# Usage Guide

## GPS Timing and ETA Indicator

### Overview

The ETA (Estimated Time of Arrival) indicator provides real-time predictions for tram arrivals with confidence scores, helping you plan your departure more effectively.

### How It Works

When you start monitoring trams, the application automatically:
1. Fetches ETA data for each upcoming tram
2. Displays an ETA badge next to the arrival time
3. Updates the ETA every 20 seconds
4. Shows confidence levels through color coding

### Understanding the ETA Badge

#### Visual Elements

- **⏱️ Icon:** Indicates this is an ETA prediction
- **Time Display:** Shows minutes until arrival (e.g., "2 min")
- **Color Coding:**
  - 🟢 **Green:** High confidence (≥80%) - GPS-based prediction
  - 🟡 **Yellow:** Medium confidence (≥60%) - Less reliable GPS or good schedule data
  - ⚪ **Gray:** Low confidence (<60%) - Schedule-based approximation

#### Confidence Tooltip

Hover over any ETA badge to see the exact confidence percentage. For example:
- "Точность: 95%" means the prediction is very reliable (GPS-based, near-term arrival)
- "Точность: 50%" means the prediction is approximate (schedule-based)

### Configuration Options

#### Polling Interval

The default polling interval is 20 seconds. You can adjust this in the code if needed:

**File:** `public/app.js`
```javascript
const ETA_POLLING_INTERVAL = 20000; // Change to desired milliseconds
```

**Recommendations:**
- **10-15 seconds:** More responsive, higher server load
- **20-30 seconds:** Balanced (default)
- **45-60 seconds:** Lower load, less responsive

#### Cache Duration

**Client-side cache:** 25 seconds (default)

**File:** `public/app.js`
```javascript
const ETA_CACHE_DURATION = 25000; // Change to desired milliseconds
```

**Server-side cache:** 15 seconds (configured in server.js)

**File:** `server.js`
```javascript
const ETA_CACHE_TTL = 15000; // Change to desired milliseconds
```

**Important:** Client cache should be slightly longer than server cache to prevent constant cache misses.

### API Endpoint

The ETA endpoint can be accessed programmatically:

**Endpoint:** `GET /api/runs/{runId}/eta`

**runId Format:** `{stopUuid}_{tramNumber}_{vehicleId}_{time}`

Example:
```
GET /api/runs/760d1406-363e-4b1a-a604-a6c75db93493_17_ABC123_120/eta
```

**Response:**
```json
{
  "run_id": "760d1406-363e-4b1a-a604-a6c75db93493_17_ABC123_120",
  "eta": "2026-02-12T12:34:00Z",
  "eta_seconds": 120,
  "confidence": 0.87,
  "generated_at": "2026-02-12T12:32:00Z"
}
```

**Response Headers:**
- `Cache-Control: public, max-age=15`
- `Expires: <timestamp>`

### Rate Limiting

The ETA endpoint is rate-limited to prevent abuse:
- **Limit:** 60 requests per minute per IP address
- **Response when exceeded:** HTTP 429 (Too Many Requests)

If you encounter rate limiting:
1. Check your polling interval isn't too aggressive
2. Ensure you're using client-side caching
3. Consider increasing polling interval to 30+ seconds

### Accessibility

The ETA badge is fully accessible:
- **Screen readers:** Announce ETA time and confidence level
- **Keyboard navigation:** Tooltips accessible via keyboard
- **Color contrast:** Meets WCAG guidelines
- **ARIA labels:** Provide context for assistive technologies

Example screen reader announcement:
> "ETA: 2 min, точность 87 процентов"

### Troubleshooting

#### ETA badge shows "N/A"
- **Cause:** Data unavailable or stale
- **Solution:** Wait for next polling cycle (20s), or refresh page

#### ETA badge not appearing
- **Cause:** JavaScript error or monitoring not active
- **Solution:** Check browser console for errors, ensure monitoring is started

#### ETAs seem inaccurate
- **Cause:** External API data quality or traffic changes
- **Solution:** Check confidence level - low confidence indicates less reliable prediction

#### Rate limiting errors
- **Cause:** Too many requests
- **Solution:** Increase polling interval or reduce number of monitored trams

### Best Practices

1. **Monitor only needed trams:** Select only the trams you actually need to reduce API calls
2. **Use confidence indicators:** Trust high-confidence (green) predictions more
3. **Plan with buffer:** Add 1-2 minutes buffer for low-confidence predictions
4. **Refresh if stale:** If data seems very outdated, stop and restart monitoring

### Performance Tips

For optimal performance:
- Keep default 20-second polling interval
- Don't manually refresh too frequently
- Close monitoring when not actively using
- Monitor 2-4 trams at once (not all available trams)

### Privacy

- No user data is stored or tracked
- IP addresses used only for rate limiting (not logged)
- All data fetched from public Moscow Transport API
- No cookies or local storage (except session state)
