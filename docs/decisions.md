# Architecture Decision Records (ADR)

## ADR-001: Component-Based Architecture

**Date**: 2026-02-12  
**Status**: Accepted

### Context
The application was initially built as a monolithic vanilla JavaScript application with all logic in a single `app.js` file. As features grew, maintainability and testability became concerns.

### Decision
Implement a component-based architecture using vanilla JavaScript classes:
- `StopCard`: Reusable stop display component
- `ArrivalList`: Reusable arrival information display
- `HistoryPagination`: Reusable pagination component

### Consequences
**Positive**:
- Improved code organization and maintainability
- Components are independently testable
- Easier to reason about individual pieces of functionality
- Reusable across the application
- Better separation of concerns

**Negative**:
- Slight increase in file count
- Need to maintain component APIs
- No build step, so components use CommonJS for Node/Jest compatibility

**Neutral**:
- Components use vanilla JS classes instead of framework (React/Vue)
- This maintains the project's lightweight nature

---

## ADR-002: Vanilla JavaScript Over Framework

**Date**: 2026-02-12  
**Status**: Accepted

### Context
Modern web development often uses frameworks like React, Vue, or Angular. The application currently uses vanilla JavaScript.

### Decision
Continue using vanilla JavaScript with component patterns rather than introducing a framework.

### Rationale
- Application is relatively small and doesn't justify framework overhead
- Faster load times without framework bundle
- Lower barrier to entry for contributors
- No build step required for development
- Direct DOM manipulation is sufficient for current features

### Consequences
**Positive**:
- Minimal dependencies
- Fast page load times
- No build step complexity
- Easy to understand for JavaScript developers

**Negative**:
- Manual DOM manipulation is more verbose
- No reactive state management
- Testing requires more setup (jsdom)

---

## ADR-003: Testing Strategy with Jest

**Date**: 2026-02-12  
**Status**: Accepted

### Context
The application had no automated testing, making refactoring risky and reducing confidence in changes.

### Decision
Implement comprehensive testing using Jest with:
- Unit tests for all components
- Snapshot tests for UI consistency
- jsdom for DOM testing environment
- @testing-library for DOM queries

### Consequences
**Positive**:
- Increased confidence in refactoring
- Documentation through tests
- Catches regressions early
- CI/CD can validate changes automatically

**Negative**:
- Initial setup time
- Tests must be maintained
- Snapshot tests can be fragile

---

## ADR-004: URL-Based State Sharing

**Date**: 2026-02-12  
**Status**: Accepted

### Context
Users wanted to share specific stops with others, but there was no way to deep link into the application.

### Decision
Implement URL parameter-based state management:
- `?stopId=UUID`: Auto-select a stop by UUID
- `?importUrl=URL`: Auto-import a stop from external URL
- Share button with native Web Share API and clipboard fallback

### Consequences
**Positive**:
- Users can share links to specific stops
- Bookmarkable application states
- Works across devices and platforms
- Fallback for browsers without Share API

**Negative**:
- Adds complexity to initialization
- URL state must be managed carefully
- Must clean up URL after processing

---

## ADR-005: Accessibility-First Approach

**Date**: 2026-02-12  
**Status**: Accepted

### Context
The application lacked proper accessibility features, making it difficult for users with disabilities to navigate.

### Decision
Implement comprehensive accessibility improvements:
- ARIA labels and roles for all interactive elements
- Keyboard navigation support with visible focus states
- Semantic HTML5 elements
- Live regions for dynamic content
- Proper color contrast

### Rationale
- Legal compliance (accessibility laws)
- Improved user experience for all users
- Better SEO and discoverability
- Social responsibility

### Consequences
**Positive**:
- Application usable by screen readers
- Keyboard-only navigation works
- Better mobile experience
- Improved SEO

**Negative**:
- Requires ongoing maintenance
- Testing requires accessibility tools
- More verbose HTML markup

---

## ADR-006: ESLint v10 with Flat Config

**Date**: 2026-02-12  
**Status**: Accepted

### Context
ESLint v9+ uses a new flat config format instead of `.eslintrc.*` files.

### Decision
Use ESLint v10 with the new flat config format (`eslint.config.mjs`).

### Consequences
**Positive**:
- Future-proof configuration
- Better TypeScript support (if needed later)
- Simpler configuration format
- Better performance

**Negative**:
- Different from older ESLint setups
- Requires newer Node.js version
- Migration effort from old config

---

## Model Usage

All architecture decisions, component designs, and documentation were created with assistance from **Claude Sonnet 4.5**, which provided:
- Component architecture design
- Accessibility best practices
- Testing strategies
- Documentation structure
- Code implementation guidance
