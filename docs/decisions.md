# Architecture Decisions

## Arrival History Feature

### Date: 2026-02-12

### Context
The application needed a way to persist and display historical arrival data for tram stops, allowing users to review past arrivals and analyze patterns over time.

### Decision

#### 1. Database Choice: SQLite with better-sqlite3
**Rationale:**
- Lightweight, serverless database perfect for single-instance deployments
- Zero configuration required
- File-based storage simplifies backup and deployment
- Synchronous API (better-sqlite3) provides better performance than async alternatives
- No need for separate database server infrastructure

**Alternatives Considered:**
- PostgreSQL: Overkill for current scale; requires separate server
- MongoDB: Would require significant dependency additions; SQL better suited for structured data
- In-memory only: Not persistent across restarts

#### 2. Schema Design
**Table: arrival_history**
```sql
- id (TEXT, PRIMARY KEY) - UUID v4 for unique identification
- stop_id (TEXT, NOT NULL) - Links to stop UUID
- vehicle_id (TEXT, NOT NULL) - Vehicle/tram identifier
- eta (TEXT, NOT NULL) - ISO 8601 timestamp of estimated arrival
- recorded_at (TEXT, NOT NULL) - ISO 8601 timestamp when event was recorded
- metadata (TEXT, nullable) - JSON field for extensibility (route number, delays, etc.)
- created_at (TEXT, DEFAULT now) - Database creation timestamp
```

**Indexes:**
- Composite index on (stop_id, recorded_at DESC) - Primary query pattern
- Index on vehicle_id - Filter support
- Index on eta - Date range queries

**Rationale:**
- TEXT for UUIDs and timestamps provides SQLite compatibility and human readability
- JSON metadata field allows future extension without schema changes
- Indexes chosen based on actual query patterns in the API endpoint

#### 3. Deduplication Strategy
**Implementation:** Check for duplicates within 5-minute window for same (stop_id, vehicle_id, eta) combination

**Rationale:**
- Prevents duplicate entries from rapid polling/refresh cycles
- 5-minute window balances accuracy vs. storage efficiency
- Same ETA for same vehicle at same stop is highly likely to be duplicate

#### 4. Pagination Strategy: Offset-Based
**Implementation:** SQL OFFSET + LIMIT with page/page_size parameters

**Rationale:**
- Simple to implement and understand
- Sufficient for current scale (hundreds to thousands of records per stop)
- Client-friendly API (page numbers instead of cursors)
- No complex state management required

**Trade-offs:**
- Less efficient for very large offsets (not an issue at current scale)
- No protection against page drift (acceptable for historical data)

**Future Consideration:** If dataset grows to millions of records, consider cursor-based pagination

#### 5. Rate Limiting
**Implementation:** In-memory rate limiting with 30 requests/minute per IP

**Rationale:**
- Protects against accidental or malicious abuse
- 30 req/min sufficient for normal use (navigation, filtering)
- In-memory storage acceptable for single-instance deployment
- Simple implementation without external dependencies

**Future Consideration:** If scaling horizontally, move to Redis-based rate limiting

#### 6. Frontend Architecture: Integrated View
**Decision:** History view toggles with main monitoring view rather than separate route

**Rationale:**
- Simpler navigation for single-page application
- No routing library required (keeping dependencies minimal)
- Maintains context (selected stop) when switching views
- Better user experience for comparing real-time vs. historical data

#### 7. Performance Optimizations
- Database indexes on high-cardinality columns used in WHERE and ORDER BY
- Limit result sets to reasonable page sizes (default 20, max 100)
- Efficient SQL queries avoiding SELECT *
- Date filtering at database level, not in application code

### Consequences

**Positive:**
- Historical data persists across server restarts
- Scalable to thousands of events per stop
- Performant queries even with large datasets
- Extensible schema via JSON metadata
- Simple deployment (no additional services)

**Negative:**
- SQLite may become bottleneck if traffic grows significantly
- File-based database requires file system backups
- In-memory rate limiting doesn't scale across instances

**Mitigation Plans:**
- Monitor database file size and query performance
- Implement data retention policy (e.g., keep last 90 days)
- Archive old data if needed
- If horizontal scaling needed, migrate to PostgreSQL + Redis

---

## Model Usage

This feature was developed with AI assistance. The following models were used for different components:

### Claude Sonnet 4.5
**Used for:**
- Core backend implementation (database.js, server.js modifications)
- Database schema design and SQL queries
- Frontend JavaScript logic (app.js history functionality)
- Frontend HTML structure and CSS styling
- Deduplication and rate limiting logic
- Error handling and validation
- Integration of all components

**Percentage of code:** ~95%

### Human Developer
**Used for:**
- Initial requirements specification
- Architecture review and approval
- Testing and validation
- Documentation review

**Percentage of work:** ~5%

### Code Quality
All code was:
- Written following existing project patterns and style
- Validated through manual testing
- Designed with security best practices (input validation, rate limiting, SQL injection prevention)
- Optimized for performance with appropriate indexes
- Made accessible with ARIA attributes and keyboard navigation
- Designed to be mobile-responsive

### Testing Approach
- Manual testing of all API endpoints
- Frontend testing in browser (Chrome/Firefox)
- Validation of pagination, filtering, and error handling
- Performance testing with seeded dataset (991 records)
