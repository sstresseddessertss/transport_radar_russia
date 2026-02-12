# CI/CD Documentation

## GitHub Actions Workflows

### Smoke Tests Workflow

The smoke tests workflow (`.github/workflows/smoke.yml`) runs automated tests to verify core functionality.

#### Push Notification Emulation Test

This test validates that the push notification infrastructure is configured correctly.

**What it tests:**
- VAPID key configuration
- web-push library integration
- Test subscription loading
- Notification payload creation
- Push notification sending (in mock mode)

**Running locally:**

1. Install dependencies:
   ```bash
   npm install
   ```

2. (Optional) Set up environment variables by copying `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   
3. (Optional) Generate real VAPID keys if needed:
   ```bash
   npx web-push generate-vapid-keys
   ```
   Update your `.env` file with the generated keys.

4. Run the test:
   ```bash
   npm run test:push
   ```

**Note:** The test will work with default mock VAPID keys if no environment variables are set.

#### Required Secrets

For production deployments on protected branches (main, feature/*), configure these secrets in GitHub:

- `VAPID_PUBLIC_KEY` - Your VAPID public key for web push
- `VAPID_PRIVATE_KEY` - Your VAPID private key for web push  
- `VAPID_SUBJECT` - mailto: URL for VAPID (e.g., mailto:admin@example.com)

**To add secrets:**
1. Go to repository Settings
2. Navigate to Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with its value

#### Security Considerations

- **Pull Requests from Forks:** The workflow uses fallback mock values for VAPID keys when secrets are not available (e.g., PRs from forks). This ensures tests can run safely without exposing real credentials.

- **Protected Branches:** Real VAPID secrets are only accessible when running on protected branches (main, feature branches) in the repository's own environment.

- **Mock Endpoint:** The test uses a mock subscription endpoint (`fixtures/subscription.json`) to avoid sending real push notifications during testing.

## Continuous Integration

The workflow automatically runs on:
- Pushes to `main`, `feature/*`, and `copilot/*` branches
- Pull requests targeting these branches

## Test Output

The push emulation test provides detailed, color-coded console output showing:
1. Library loading status
2. VAPID key configuration
3. Subscription loading
4. Payload preparation
5. Send notification result
6. Overall test result (SUCCESS/FAILURE)

Failed tests will show error details and stack traces for debugging.
