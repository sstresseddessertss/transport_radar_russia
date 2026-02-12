# Architecture Decision Records

## Model Usage

This document tracks which AI models were used for different aspects of the codebase.

### Yandex.Metrika Integration (2026-02-12)

**Task**: Implement analytics tracking system for user interactions

**Models Used**:
- **Claude Sonnet 4.5**: Used for code generation and implementation
  - Analytics wrapper module (`analytics.js`)
  - Event tracking integration in frontend (`app.js` modifications)
  - Server-side environment configuration
  - Test infrastructure and test cases
  - Integration logic and error handling

- **GPT-5 mini**: Used for documentation and code snippets
  - Documentation files (changelog.md, tasks.yaml, decisions.md)
  - Code comments and JSDoc annotations
  - Example configurations and usage snippets
  - README updates for analytics features

**Rationale**: Claude Sonnet 4.5 was chosen for complex code generation tasks requiring deep understanding of the existing codebase architecture, while GPT-5 mini was used for documentation tasks where conciseness and clarity were prioritized.

## Technical Decisions

### Analytics Implementation Approach

**Decision**: Use environment variable-based configuration for Yandex.Metrika

**Context**: Need to support optional analytics without committing secrets or breaking functionality when analytics is disabled.

**Chosen Approach**:
- Read `YANDEX_METRIKA_ID` from `process.env`
- Only inject Yandex.Metrika script when ID is present
- Provide wrapper API that safely no-ops when analytics is disabled

**Alternatives Considered**:
- Hard-coded analytics ID: Rejected due to security concerns
- Client-side configuration: Rejected due to exposure of analytics ID
- Build-time configuration: Rejected due to deployment complexity

**Consequences**:
- Analytics can be enabled/disabled via environment variable
- No code changes needed to toggle analytics
- Safe for local development (no analytics by default)
- Production deployment requires setting environment variable
