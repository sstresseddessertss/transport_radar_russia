# Changelog

## 2026-02-12 - Vehicles by Stop Endpoint

### Added
- **New API Endpoint**: `GET /api/stops/{stopId}/vehicles`
  - Returns paginated list of vehicles serving a specific stop
  - Includes vehicle position, ETA, and status information
  - Supports query parameters:
    - `page` (default: 1) - Page number for pagination
    - `page_size` (default: 50, max: 100) - Number of items per page
    - `include_positions` (default: true) - Whether to include lat/lon coordinates
  
- **Response Format**:
  ```json
  {
    "data": [
      {
        "vehicle_id": "vehicle_abc123_0",
        "run_id": "run_001",
        "lat": 55.7558,
        "lon": 37.6173,
        "eta_seconds": 180,
        "eta_human": "3 мин",
        "status": "approaching",
        "last_update": "2026-02-12T12:30:00Z"
      }
    ],
    "meta": {
      "page": 1,
      "page_size": 50,
      "total_pages": 2,
      "total_items": 75
    }
  }
  ```

- **Features**:
  - In-memory caching with 10-second TTL to reduce server load
  - Rate limiting (60 requests per minute per IP)
  - 404 response for invalid stop IDs
  - Automatic ETA calculation and human-readable formatting
  - Vehicle status tracking (approaching, boarding, departed, delayed)

### Sample Usage

```bash
# Get vehicles for a stop with default pagination
curl http://localhost:3000/api/stops/760d1406-363e-4b1a-a604-a6c75db93493/vehicles

# Get second page with 20 items per page
curl "http://localhost:3000/api/stops/760d1406-363e-4b1a-a604-a6c75db93493/vehicles?page=2&page_size=20"

# Get vehicles without position data (lighter payload)
curl "http://localhost:3000/api/stops/760d1406-363e-4b1a-a604-a6c75db93493/vehicles?include_positions=false"
```

### Frontend Components
- Vehicle list component with real-time updates
- Vehicle detail panel showing position and route information
- Automatic polling every 15 seconds for live updates
- Responsive design with accessibility features
- Empty state and error handling

### Technical Details
- Uses Express.js middleware for rate limiting
- In-memory cache implementation for performance
- Mock vehicle data generation for demonstration
- Validates all input parameters
- RESTful API design following best practices
