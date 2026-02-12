# Changelog

## [Unreleased]

### Added - 2026-02-12

#### GitHub Actions Smoke CI Implementation

- **Workflow File** (`.github/workflows/smoke.yml`)
  - Added comprehensive CI/CD workflow with three jobs:
    - **Lint Job**: Runs ESLint code quality checks
    - **Unit Tests Job**: Executes Mocha test suite
    - **Push Emulation Smoke Job**: Tests web-push notification functionality
  - Configured triggers: `pull_request`, `push`, `workflow_dispatch`
  - Implemented fork-safe secret handling with mock fallbacks

- **Testing Infrastructure**
  - Created `test/basic.test.js` - Unit tests for configuration and file validation
  - Created `test/push-emulation.test.js` - Integration test for web-push notifications
  - Added Mocha as test runner with 10-second timeout

- **Code Quality Tools**
  - Added ESLint configuration (`.eslintrc.js`)
  - Implemented standard JavaScript linting rules
  - Added support for browser, Node.js, and Mocha environments

- **Dependencies**
  - Added `web-push@^3.6.7` for push notification functionality
  - Added `eslint@^8.57.0` for code linting
  - Added `mocha@^10.3.0` for test running

- **Scripts** (package.json)
  - `npm test` - Runs unit tests with Mocha
  - `npm run test:push-emulation` - Runs push notification emulation test
  - `npm run lint` - Runs ESLint checks
  - `npm run lint:fix` - Auto-fixes ESLint issues

- **Documentation**
  - Created `docs/ci.md` - Comprehensive CI/CD documentation
    - Workflow overview and job descriptions
    - Environment variables and secrets setup instructions
    - VAPID key generation guide
    - Local testing instructions
    - Troubleshooting guide
  - Created `.env.example` - Template for environment variables
  - Created `docs/changelog.md` - This changelog

- **Security Features**
  - Fork-safe CI implementation with mocked secrets for PRs from forks
  - Environment variable override support in workflow
  - Secure secret handling via GitHub Actions secrets

### Technical Notes

- **Model Usage**: 
  - Claude Sonnet 4 used for workflow implementation and test scripts
  - Documentation created with AI assistance
- **Compatibility**: Requires Node.js 18+ (existing requirement)
- **CI Environment**: Runs on Ubuntu latest with Node.js 18

### Migration Notes

To use the new CI workflow:

1. Install new dependencies:
   ```bash
   npm install
   ```

2. Set up repository secrets (Settings → Secrets and variables → Actions):
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `YANDEX_METRIKA_ID` (optional)

3. Generate VAPID keys if needed:
   ```bash
   npx web-push generate-vapid-keys
   ```

4. Copy `.env.example` to `.env` for local development

### Known Limitations

- Push emulation test uses mock subscription endpoint (expected network errors)
- Lint and test jobs run on all events; push-emulation-smoke only on push/dispatch
- Fork PRs use mocked secrets (will not test real push functionality)
