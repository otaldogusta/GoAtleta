const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const buildTargetUrl = (token: string) => {
  const appBase = (Deno.env.get("APP_INVITE_URL") ?? Deno.env.get("APP_URL") ?? "").trim();
  if (appBase) {
    return `${appBase.replace(/\/$/, "")}/invite/${encodeURIComponent(token)}`;
  }
  return `goatleta://invite/${encodeURIComponent(token)}`;
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const url = new URL(req.url);
  const token = (url.searchParams.get("token") ?? "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing token" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const targetUrl = buildTargetUrl(token);
  return Response.redirect(targetUrl, 302);
});
