# Changelog

## [Unreleased]

### Added
- Searchable dropdown component for stop selection with the following features:
  - Debounced search input (300ms default) with cancellation of in-flight requests
  - Client-side caching with TTL (5 minutes) for improved performance
  - Keyboard navigation support (arrow keys, enter to select)
  - ARIA attributes for screen reader accessibility
  - Graceful handling of loading, error, and no-results states
  - Pagination support for large result sets
- Backend API endpoint `GET /api/stops` with:
  - Prefix-based search on stop name and code
  - Pagination support (page and page_size parameters)
  - Efficient querying with proper validation
  - Return total count and metadata for client-side pagination
- Comprehensive test coverage for both frontend and backend components
