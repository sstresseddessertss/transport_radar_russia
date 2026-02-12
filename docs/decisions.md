# Architecture Decision Records

## Vehicles Endpoint Caching Strategy

**Date**: 2026-02-12

### Context
The vehicles endpoint (`/api/stops/{stopId}/vehicles`) needs to handle potentially high traffic while providing real-time vehicle position and ETA data.

### Decision
Implemented in-memory caching with a 10-second Time-To-Live (TTL).

### Rationale
1. **Performance**: In-memory caching is the fastest option for this use case
2. **TTL Selection**: 10 seconds balances freshness with server load
   - Short enough to provide near real-time updates
   - Long enough to prevent excessive API calls during traffic spikes
   - Aligns with typical user polling intervals (10-30 seconds)
3. **Scalability**: For current scale, in-memory is sufficient
   - Easy to migrate to Redis if needed in the future
   - No additional infrastructure dependencies

### Alternatives Considered
- **Redis**: More scalable but adds infrastructure complexity
- **No caching**: Would increase server load unnecessarily
- **Longer TTL (30-60s)**: Would reduce freshness unacceptably

### Consequences
- Fast response times for cached data
- Reduced load on downstream services
- May need to switch to Redis for horizontal scaling
- Cache invalidation is automatic via TTL

---

## Pagination Strategy

**Date**: 2026-02-12

### Context
Vehicle data can vary significantly in size per stop, requiring efficient data transfer.

### Decision
Implemented offset-based pagination with:
- Default page size: 50 items
- Maximum page size: 100 items
- Minimum page: 1

### Rationale
1. **Predictable URLs**: Easy to bookmark and share
2. **Simple Implementation**: No cursor management required
3. **Client-friendly**: Easy for frontend to implement
4. **Reasonable Defaults**: 50 items balances payload size with UX

### Alternatives Considered
- **Cursor-based pagination**: More complex, better for large datasets
- **Infinite scroll**: Could be added on frontend later

### Consequences
- Simple to implement and maintain
- Works well for current dataset sizes
- May need cursor-based pagination if datasets grow significantly

---

## Model Usage

**Date**: 2026-02-12

### AI Models Used in Development

#### Claude Sonnet 4.5
**Used for**: Code generation and implementation
- Backend endpoint development (Express.js routes, middleware)
- Frontend component architecture (JavaScript, HTML, CSS)
- Data structure design (DTOs, response formats)
- Error handling and validation logic
- Rate limiting and caching implementation

**Rationale**: Superior coding capabilities, better understanding of complex logic and architecture patterns

#### GPT-5 Mini
**Used for**: Documentation and text content
- API documentation (OpenAPI specs, usage examples)
- Code comments and inline documentation
- Changelog entries
- Decision records (this document)
- README updates

**Rationale**: Excellent for concise, clear documentation; faster for text generation tasks

### Development Approach
1. Used Claude Sonnet 4.5 for all code implementation
2. Used GPT-5 Mini for all documentation writing
3. Human review for architecture decisions
4. Iterative refinement based on testing

---

## Rate Limiting Implementation

**Date**: 2026-02-12

### Context
Prevent abuse of the vehicles endpoint while maintaining good user experience.

### Decision
Implemented IP-based rate limiting:
- 60 requests per minute per IP address
- Sliding window implementation
- Returns 429 status code when exceeded

### Rationale
1. **Protection**: Prevents denial-of-service scenarios
2. **Fair Use**: 60 req/min allows polling every second with headroom
3. **Simple**: No user authentication required
4. **In-Memory**: Fast and simple for current scale

### Alternatives Considered
- **Token bucket algorithm**: More complex, not needed yet
- **User-based limiting**: Requires authentication
- **No rate limiting**: Risky for public APIs

### Consequences
- Protects server from abuse
- May need adjustment based on real usage patterns
- Could be bypassed by distributed attackers (acceptable risk for now)
