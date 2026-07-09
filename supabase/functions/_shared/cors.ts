/**
 * Centralised CORS helpers for Edge Functions.
 *
 * Rules:
 * - Browser requests include an Origin header → validate against allow-list.
 * - Mobile-app / server-to-server calls have no Origin → fall back to the
 *   first production allowed origin so the browser never receives "*".
 *
 * Environments:
 * - Production: strict allowlist only
 * - Preview/staging: set CORS_ALLOW_PREVIEW=true to also allow *.vercel.app
 *   and localhost origins (controlled by Supabase project secrets)
 * - Local dev (SUPABASE_ENV=local): always allows localhost origins
 */

const PRODUCTION_ORIGINS = [
  "https://go-atleta.vercel.app",
  "https://goatleta.com",
  "https://www.goatleta.com",
];

const isLocalDev = () => Deno.env.get("SUPABASE_ENV") === "local";
const isPreviewAllowed = () => Deno.env.get("CORS_ALLOW_PREVIEW") === "true";

const isLocalhostOrigin = (origin: string) =>
  /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
  /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin);

const isVercelPreviewOrigin = (origin: string) =>
  /^https:\/\/[a-z0-9-]+-[a-z0-9]+-otaldogustas-company\.vercel\.app$/.test(origin) ||
  origin.endsWith(".vercel.app");

export const resolveCorsOrigin = (req: Request): string => {
  const origin = req.headers.get("Origin") ?? "";

  if (PRODUCTION_ORIGINS.includes(origin)) return origin;

  if (isLocalDev() && isLocalhostOrigin(origin)) return origin;

  if (isPreviewAllowed()) {
    if (isLocalhostOrigin(origin)) return origin;
    if (isVercelPreviewOrigin(origin)) return origin;
  }

  // Fallback: production origin (mobile app calls have no Origin header)
  return PRODUCTION_ORIGINS[0];
};

export const buildCorsHeaders = (req: Request) => ({
  "Access-Control-Allow-Origin": resolveCorsOrigin(req),
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
});

/** Returns a ready-made 200 preflight response. */
export const corsPreflight = (req: Request): Response =>
  new Response("ok", { headers: buildCorsHeaders(req) });
