# Architecture Decision Records

## ADR-001: Searchable Stop Dropdown Implementation

### Context
We need to implement a searchable dropdown for stop selection to improve user experience when dealing with a large number of stops.

### Decision
Implemented a vanilla JavaScript component that provides:
- Server-side pagination to handle large datasets efficiently
- Client-side caching to reduce API calls
- Debouncing to prevent excessive requests during typing
- Keyboard navigation for accessibility
- ARIA attributes for screen reader support

### Model Usage
- **Claude Sonnet 4.5**: Used for component code generation, API endpoint implementation, and test development
- **GPT-5 mini**: Used for documentation text generation (this file and changelog.md)

### Consequences
- Improved user experience with faster stop search
- Reduced server load through caching and debouncing
- Better accessibility for all users
- Increased code complexity requiring thorough testing

### Status
Accepted

### Date
2026-02-12
