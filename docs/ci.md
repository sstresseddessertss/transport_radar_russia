# CI/CD Documentation

## Overview

This project uses GitHub Actions for continuous integration and smoke testing.

## Workflows

### Smoke CI (`smoke.yml`)

The smoke CI workflow runs automatically on pull requests and pushes to ensure code quality and functionality.

#### Jobs

1. **Lint** - Code quality checks using ESLint
2. **Unit Tests** - Runs the test suite using Mocha
3. **Push Emulation Smoke** - Tests web push notification functionality (only on push/manual dispatch)

#### Triggers

- `pull_request`: Runs on all pull requests
- `push`: Runs on all pushes to branches
- `workflow_dispatch`: Can be triggered manually from GitHub Actions UI

#### Environment Variables & Secrets

The workflow requires the following environment variables for full functionality:

- `VAPID_PUBLIC_KEY` - Public VAPID key for web push notifications
- `VAPID_PRIVATE_KEY` - Private VAPID key for web push notifications
- `YANDEX_METRIKA_ID` - (Optional) Yandex Metrika analytics ID

##### Setting up Secrets

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with its corresponding value

##### Generating VAPID Keys

To generate VAPID keys for web push notifications:

```bash
npx web-push generate-vapid-keys
```

This will output a public and private key pair. Add these to your repository secrets.

##### Fork Protection

For pull requests from forks, the workflow uses mocked values to prevent exposing real secrets:
- Mock VAPID keys are used if real secrets are not available
- This allows the workflow to run without failures on forked PRs

## Running Tests Locally

### Prerequisites

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Edit `.env` file with your values:
```env
VAPID_PUBLIC_KEY=your-public-key-here
VAPID_PRIVATE_KEY=your-private-key-here
YANDEX_METRIKA_ID=your-metrika-id
```

### Run Lint

```bash
npm run lint
```

To automatically fix linting issues:
```bash
npm run lint:fix
```

### Run Unit Tests

```bash
npm test
```

### Run Push Emulation Test

```bash
npm run test:push-emulation
```

Make sure `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are set in your environment before running this test.

## Workflow Status

You can check the status of workflows in the **Actions** tab of your repository on GitHub.

## Troubleshooting

### Lint Errors

If you encounter linting errors:
1. Review the error messages in the CI output
2. Run `npm run lint` locally to see the same errors
3. Fix the errors or run `npm run lint:fix` to auto-fix some issues

### Test Failures

If tests fail:
1. Check the test output in the CI logs
2. Run `npm test` locally to reproduce
3. Fix the failing tests and push again

### Push Emulation Failures

If the push emulation test fails:
1. Verify that VAPID keys are correctly set in repository secrets
2. Check that the keys are in the correct format
3. Ensure no whitespace or special characters in the secret values

## Best Practices

1. **Always run tests locally** before pushing to avoid CI failures
2. **Keep secrets secure** - never commit them to the repository
3. **Use `.env.example`** as a template for required environment variables
4. **Monitor CI status** after pushing to catch issues early
