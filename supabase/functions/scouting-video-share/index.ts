import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.115.0';
import { buildCorsHeaders, corsPreflight } from '../_shared/cors.ts';
import { parseVideoDocument } from '../../../src/core/scouting-video.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return corsPreflight(req);
  const headers = { ...buildCorsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method !== 'POST') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    // Bound the body before parsing, even when Content-Length is absent.
    const reader = req.body?.getReader();
    if (!reader) return reply({ error: 'LINK_UNAVAILABLE' }, 400);
    const chunks: Uint8Array[] = []; let length = 0;
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 1024) { await reader.cancel(); return reply({ error: 'LINK_UNAVAILABLE' }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const { id, code } = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof id !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id) || typeof code !== 'string' || !/^[a-f0-9]{64}$/.test(code)) return reply({ error: 'LINK_UNAVAILABLE' }, 400);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    let userId: string | null = null;
    const authorization = req.headers.get('Authorization');
    if (authorization) {
      const { data, error } = await client.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
      if (error || !data.user || !data.user.email_confirmed_at) return reply({ error: 'LOGIN_REQUIRED' }, 401);
      userId = data.user.id;
    }
    const { data, error } = await client.rpc('resolve_scouting_video_share', { p_share: id, p_proof: code, p_user: userId });
    if (error) return reply({ error: 'SERVICE_UNAVAILABLE' }, 503);
    if (!data || data.error) return reply({ error: data?.error || 'LINK_UNAVAILABLE' }, data?.error === 'LOGIN_REQUIRED' ? 401 : 404);
    // Whitelist the domain projection again at the public boundary. No internal
    // identifiers, unknown properties, storage paths or editing APIs are exposed.
    const document = parseVideoDocument(data.document);
    const { data: media, error: mediaError } = await client.storage.from('scouting-videos').createSignedUrl(data.objectPath, 300);
    if (mediaError || !media) return reply({ error: 'MEDIA_UNAVAILABLE' }, 503);
    return reply({ document, teamName: data.teamName, title: data.title, opponent: data.opponent,
      updatedAt: data.updatedAt, expiresAt: data.expiresAt, permission: 'viewer', mediaUrl: media.signedUrl, mediaExpiresAt: Date.now() + 300000 });
  } catch {
    return reply({ error: 'LINK_UNAVAILABLE' }, 400);
  }
});
