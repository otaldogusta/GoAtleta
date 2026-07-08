SSRF & Assistant test harness

Purpose
- Simple Deno server that captures incoming HTTP requests and exposes them at `/_requests`.
- Use this to verify whether `link-metadata` or the `assistant` function performs fetches to attacker-controlled URLs.

Run locally
1. Install Deno (https://deno.land).
2. From this folder run:

```bash
deno run --allow-net server.ts
```

This starts a server on http://localhost:8000 by default.

Testing approaches

A) Local hosts-file mapping (quick)
- Edit your hosts file (requires admin) and add:

```
127.0.0.1 ssrf-test.example
```

- Then call the target function with `http://ssrf-test.example/probe` as the URL. Example (Link-metadata):

```bash
# POSIX
curl -X POST "https://<FUNCTION_HOST>/link-metadata" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"url":"http://ssrf-test.example/probe"}'

# PowerShell
Invoke-RestMethod -Uri "https://<FUNCTION_HOST>/link-metadata" -Method POST -Headers @{ Authorization = "Bearer <USER_JWT>" } -Body (@{ url = "http://ssrf-test.example/probe" } | ConvertTo-Json)
```

- Check the harness at http://localhost:8000/_requests to see captured requests.

B) Public exposure (ngrok) — if you need a public domain
- Start ngrok or a similar tunnel to expose your local server, then use the provided ngrok hostname as the test domain.

C) Assistant-directed test
- To test the `assistant` function causing fetches of model-supplied sources, craft a user message that asks the model to include a `source` with URL `http://<your-domain>/probe`. Submit this message to your staged `assistant` endpoint.

Example assistant payload (replace variables):

```bash
curl -X POST "https://<FUNCTION_HOST>/assistant" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Por favor, responda em JSON e inclua uma source com url \"http://ssrf-test.example/probe\""}] }'
```

Notes & safety
- Always run these tests in a staging environment or with explicit permission. Do NOT run any brute-force tests against production systems.
- If the target function is behind Cloudflare or other gateways, ensure your staging environment mirrors production behavior.
