# Changelog

## [Unreleased] - 2026-02-12

### Added - UI Overhaul
- **URL-based stop import**: Users can now share direct links to specific stops using `?stopId=UUID` or `?importUrl=URL` query parameters
  - Automatically opens the stop view when visiting shared links
  - Share button with native share API support and clipboard fallback
- **Reusable Components**:
  - `StopCard`: Modular component for displaying stop information with keyboard navigation
  - `ArrivalList`: Component for displaying tram arrivals with history toggle
  - `HistoryPagination`: Pagination component for history items with full accessibility
- **Accessibility Improvements**:
  - Added ARIA labels and roles throughout the application
  - Enhanced keyboard navigation with proper focus states
  - Improved color contrast for better readability
  - Screen reader friendly markup with live regions
  - Semantic HTML5 elements (main, nav, role attributes)
- **Testing Infrastructure**:
  - Configured Jest with jsdom environment for component testing
  - 42 comprehensive unit tests across all components
  - Snapshot testing for UI consistency
  - ESLint with modern configuration (v10)
  - CI/CD pipeline with automated testing

### Changed
- Enhanced focus states with visible outlines for better keyboard navigation
- Improved mobile responsiveness with better button layouts
- Updated meta description for better SEO

### Technical Improvements
- Modern ESLint configuration (v10) with flat config format
- Component-based architecture for better code organization
- Comprehensive test coverage with Jest and @testing-library
- CI workflow for automated testing on push and PR

### Model Usage
- Components (StopCard, ArrivalList, HistoryPagination): **Claude Sonnet 4.5**
- Documentation (changelog.md, decisions.md): **Claude Sonnet 4.5**
- Code reviews and architecture decisions: **Claude Sonnet 4.5**
