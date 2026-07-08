import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const requests: Array<Record<string, unknown>> = [];

serve(async (req) => {
  const url = new URL(req.url);
  const entry: Record<string, unknown> = {
    time: new Date().toISOString(),
    method: req.method,
    path: url.pathname + url.search,
    headers: Object.fromEntries(req.headers.entries()),
  };

  try {
    const text = await req.text();
    entry.body = text;
  } catch {
    entry.body = null;
  }

  requests.push(entry);
  console.log("Captured request:", JSON.stringify(entry));

  if (url.pathname === "/_requests") {
    return new Response(JSON.stringify({ requests }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Simple probe response
  return new Response(JSON.stringify({ ok: true, seen: entry.time }), {
    headers: { "Content-Type": "application/json" },
  });
});
