# Sentry CLI

The repository already uses `@sentry/react-native`. This document only covers local CLI usage.

## Scripts

- `npm run sentry:info`
- `npm run sentry:releases`

## Required environment variables

Do not hardcode these in the repository.

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Depending on your workflow, you may also use:

- `SENTRY_URL`
- `SENTRY_RELEASE`

## Example

```bash
$env:SENTRY_AUTH_TOKEN="..."
$env:SENTRY_ORG="your-org"
$env:SENTRY_PROJECT="your-project"
npm run sentry:info
```

## Notes

- Keep secrets out of source control.
- Prefer local shell environment variables or CI secrets.
- Sourcemap upload wiring is intentionally not added in this package.
