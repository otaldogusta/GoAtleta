Node.js variant: SSRF & Assistant test harness

If you don't have Deno, use this Node.js server instead.

Run locally
1. Ensure you have Node.js installed.
2. From this folder run:

```bash
node server-node.js
```

This starts a server on http://localhost:8000 by default.

Then use the same testing approaches described in README.md (hosts file mapping, ngrok or calling the target function with `http://ssrf-test.example/probe`).
