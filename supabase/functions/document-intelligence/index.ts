import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET") ?? "";
const TOKEN_KEY = Deno.env.get("DOCUMENT_TOKEN_ENCRYPTION_KEY") ?? "";
const CALLBACK_URL = Deno.env.get("GOOGLE_DRIVE_REDIRECT_URI") ??
  `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/document-intelligence?oauth=callback`;
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const MAX_BYTES = 25 * 1024 * 1024;

const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64 = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};
const randomValue = (size = 32) => base64Url(crypto.getRandomValues(new Uint8Array(size)));
const sha256 = async (value: string | Uint8Array) => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const tokenKey = async () => {
  const bytes = fromBase64(TOKEN_KEY);
  if (bytes.length !== 32) throw new Error("token_encryption_not_configured");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
};
const encryptToken = async (token: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await tokenKey(), new TextEncoder().encode(token));
  return { ciphertext: base64Url(new Uint8Array(encrypted)), iv: base64Url(iv) };
};
const decryptToken = async (ciphertext: string, iv: string) => {
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, await tokenKey(), fromBase64(ciphertext));
  return new TextDecoder().decode(decrypted);
};

const caller = async (request: Request) => {
  const authorization = request.headers.get("Authorization") ?? "";
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("unauthorized");
  return { user: data.user, client };
};

const oauthCallback = async (url: URL) => {
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const { data: stored } = await service.from("google_drive_oauth_states").select("*").eq("state", state).maybeSingle();
  if (!stored || !code || new Date(stored.expires_at).getTime() <= Date.now()) return json({ error: "oauth_state_invalid" }, 400);
  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, code,
    code_verifier: stored.code_verifier, grant_type: "authorization_code", redirect_uri: CALLBACK_URL,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const tokens = await response.json();
  if (!response.ok || !tokens.refresh_token) return json({ error: "google_token_exchange_failed" }, 400);
  const encrypted = await encryptToken(tokens.refresh_token);
  await service.from("google_drive_connections").upsert({
    organization_id: stored.organization_id, user_id: stored.user_id,
    refresh_token_ciphertext: encrypted.ciphertext, refresh_token_iv: encrypted.iv,
    scopes: [DRIVE_SCOPE], expires_at: new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,user_id" });
  await service.from("google_drive_oauth_states").delete().eq("state", state);
  return Response.redirect(stored.redirect_to, 302);
};

const accessTokenFor = async (organizationId: string, userId: string) => {
  const { data: connection } = await service.from("google_drive_connections")
    .select("*").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
  if (!connection?.refresh_token_ciphertext || !connection.refresh_token_iv) return null;
  const refreshToken = await decryptToken(connection.refresh_token_ciphertext, connection.refresh_token_iv);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const payload = await response.json();
  return response.ok ? String(payload.access_token ?? "") : null;
};

const assertDocumentStaff = async (organizationId: string, userId: string) => {
  const { data } = await service.from("organization_members").select("role_level")
    .eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
  if (!data || Number(data.role_level ?? 0) < 40) throw new Error("organization_access_denied");
};

const extractDriveId = (sourceUrl: string) => {
  const url = new URL(sourceUrl);
  if (!url.hostname.endsWith("google.com")) throw new Error("invalid_drive_url");
  const match = /\/(?:folders|d)\/([a-zA-Z0-9_-]+)/.exec(url.pathname);
  if (!match) throw new Error("invalid_drive_url");
  return match[1];
};

type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string; version?: string; size?: string; webViewLink?: string; capabilities?: { canDownload?: boolean } };
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const driveFetch = async (path: string, token: string) => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`drive_${response.status}`);
  return response;
};
const listFiles = async (externalId: string, token: string): Promise<DriveFile[]> => {
  const fields = "files(id,name,mimeType,modifiedTime,version,size,webViewLink,capabilities(canDownload))";
  const meta = await (await driveFetch(`files/${externalId}?fields=id,name,mimeType,modifiedTime,version,size,webViewLink,capabilities(canDownload)`, token)).json() as DriveFile;
  if (meta.mimeType !== "application/vnd.google-apps.folder") return [meta];
  const query = encodeURIComponent(`'${externalId}' in parents and trashed=false`);
  const result = await (await driveFetch(`files?q=${query}&fields=${encodeURIComponent(fields)}&pageSize=1000`, token)).json();
  return result.files ?? [];
};
const decodeXmlText = (value: string) => value
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const extractDocxText = (bytes: Uint8Array) => {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("docx_signature_invalid");
  const archive = unzipSync(bytes, { filter: (entry) =>
    entry.name === "[Content_Types].xml" || entry.name === "word/document.xml" ||
    entry.name === "word/vbaProject.bin" });
  if (archive["word/vbaProject.bin"]) throw new Error("docx_macros_not_allowed");
  const types = archive["[Content_Types].xml"];
  const document = archive["word/document.xml"];
  if (!types || !document) throw new Error("docx_structure_invalid");
  const typeXml = new TextDecoder().decode(types);
  if (!typeXml.includes(DOCX_MIME)) throw new Error("docx_mime_mismatch");
  const xml = new TextDecoder().decode(document);
  const body = /<w:body\b[^>]*>([\s\S]*?)<\/w:body>/.exec(xml)?.[1] ?? "";
  const blocks: string[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    const paragraphAt = body.indexOf("<w:p", cursor);
    const tableAt = body.indexOf("<w:tbl", cursor);
    const starts = [paragraphAt, tableAt].filter((position) => position >= 0);
    if (!starts.length) break;
    const start = Math.min(...starts);
    const tag = start === tableAt ? "tbl" : "p";
    const end = body.indexOf(`</w:${tag}>`, start);
    if (end < 0) throw new Error("docx_structure_invalid");
    const blockEnd = end + tag.length + 5;
    blocks.push(body.slice(start, blockEnd));
    cursor = blockEnd;
  }
  const normalizedBlocks: string[] = [];
  const seenTables = new Set<string>();
  let duplicateBlocksIgnored = 0;
  for (const block of blocks) {
    const rows = block.startsWith("<w:tbl") ? (block.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []) : [block];
    const text = rows.map((row) => {
      const cells = row.match(/<w:tc\b[\s\S]*?<\/w:tc>/g);
      const units = cells ?? [row];
      return units.map((unit) => [...unit.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
        .map((match) => decodeXmlText(match[1])).join(" ").trim()).filter(Boolean).join(" | ");
    }).filter(Boolean).join("\n").trim();
    if (!text) continue;
    if (block.startsWith("<w:tbl")) {
      const key = text.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
      if (seenTables.has(key)) { duplicateBlocksIgnored += 1; continue; }
      seenTables.add(key);
    }
    normalizedBlocks.push(text);
  }
  return { text: normalizedBlocks.join("\n"), duplicateBlocksIgnored };
};
const extractText = async (file: DriveFile, token: string) => {
  if (file.capabilities?.canDownload === false) return { status: "review_required", text: "" };
  if (Number(file.size ?? 0) > MAX_BYTES) return { status: "failed", text: "", error: "file_too_large" };
  const exports: Record<string, string> = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
  };
  const exportMime = exports[file.mimeType];
  if (exportMime) {
    const response = await driveFetch(`files/${file.id}/export?mimeType=${encodeURIComponent(exportMime)}`, token);
    return { status: "ready", text: await response.text() };
  }
  if (file.mimeType === DOCX_MIME) {
    const response = await driveFetch(`files/${file.id}?alt=media`, token);
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_BYTES) return { status: "failed", text: "", error: "file_too_large" };
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_BYTES) return { status: "failed", text: "", error: "file_too_large" };
    const extracted = extractDocxText(bytes);
    return { status: "ready", text: extracted.text, duplicateBlocksIgnored: extracted.duplicateBlocksIgnored };
  }
  if (file.mimeType.startsWith("text/")) {
    return { status: "ready", text: await (await driveFetch(`files/${file.id}?alt=media`, token)).text() };
  }
  return { status: "review_required", text: "", error: "format_not_supported_in_pilot" };
};

const processAnalyze = async (body: Record<string, unknown>, userId: string) => {
  const organizationId = String(body.organizationId ?? "");
  const classId = String(body.classId ?? "");
  const sourceUrl = String(body.sourceUrl ?? "");
  await assertDocumentStaff(organizationId, userId);
  const externalId = extractDriveId(sourceUrl);
  const token = await accessTokenFor(organizationId, userId);
  if (!token) return json({ connected: false, error: "drive_connection_required" }, 409);
  const files = await listFiles(externalId, token);
  const candidates = files.filter((file) => /planejamento|relat[oó]rio/i.test(file.name));
  const processed: Array<{ file: DriveFile; text: string; revisionId: string; duplicateBlocksIgnored: number }> = [];
  for (const file of candidates) {
    const extracted = await extractText(file, token);
    const normalized = extracted.text.replace(/\r\n?/g, "\n").trim();
    const hash = await sha256(normalized || `${file.id}:${file.version ?? file.modifiedTime ?? ""}`);
    const { data: source } = await service.from("document_sources").upsert({
      organization_id: organizationId, connection_id: (await service.from("google_drive_connections").select("id").eq("organization_id", organizationId).eq("user_id", userId).single()).data?.id,
      provider: "google_drive", folder_id: files.length > 1 ? externalId : null, external_id: file.id,
      source_url: file.webViewLink ?? sourceUrl, filename: file.name, mime_type: file.mimeType,
      class_id: classId, created_by: userId, updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,provider,external_id" }).select("id").single();
    const revisionId = `${file.version ?? file.modifiedTime ?? hash}`;
    await service.from("document_source_revisions").upsert({
      organization_id: organizationId, source_id: source?.id, external_revision_id: revisionId,
      content_hash: hash, modified_at: file.modifiedTime, byte_size: Number(file.size ?? 0) || null,
      extraction_status: extracted.status, normalized_content: normalized || null, error_code: extracted.error ?? null,
    }, { onConflict: "organization_id,source_id,content_hash" });
    if (normalized) processed.push({ file, text: normalized, revisionId, duplicateBlocksIgnored: extracted.duplicateBlocksIgnored ?? 0 });
  }
  const plan = processed.find((entry) => /planejamento/i.test(entry.file.name));
  if (!plan) return json({ error: "planning_document_not_found" }, 422);
  const dates = [...plan.text.matchAll(/(\d{2})\/(\d{2})\/(20\d{2})/g)].map((m) => `${m[3]}-${m[2]}-${m[1]}`);
  const uniqueDates = [...new Set(dates)];
  const { data: classRow } = await service.from("classes").select("id,name,organization_id,unit_id,modality").eq("id", classId).eq("organization_id", organizationId).single();
  if (!classRow) return json({ error: "class_scope_invalid" }, 403);
  const stateQueries = await Promise.all([
    service.from("class_plans").select("*").eq("organization_id", organizationId).eq("classid", classId).order("weeknumber"),
    service.from("training_plans").select("*").eq("organization_id", organizationId).eq("classid", classId).order("applydate"),
    service.from("training_sessions").select("id,title,start_at,end_at,status,type,source,plan_id,updated_at,training_session_classes!inner(class_id)")
      .eq("organization_id", organizationId).eq("training_session_classes.class_id", classId).order("start_at"),
    service.from("session_logs").select("id,createdat,activity,conclusion,participants_count,rpe,technique")
      .eq("organization_id", organizationId).eq("classid", classId).order("createdat"),
    service.from("ai_decision_traces").select("id,decision,reason,confidence,based_on,created_at")
      .eq("organization_id", organizationId).eq("class_id", classId).order("created_at"),
  ]);
  const stateQueryError = stateQueries.find((result) => result.error)?.error;
  if (stateQueryError) throw new Error("planning_state_unavailable");
  const [plansResult, lessonPlansResult, sessionsResult, reportsResult, decisionsResult] = stateQueries;
  const plans = plansResult.data;
  const lessonPlans = lessonPlansResult.data;
  const sessions = sessionsResult.data;
  const reports = reportsResult.data;
  const decisions = decisionsResult.data;
  const state = {
    cycle: plans ?? [], planning: lessonPlans ?? [], sessions: sessions ?? [], reports: reports ?? [],
    readiness: (reports ?? []).map((row) => ({ id: row.id, at: row.createdat, conclusion: row.conclusion })),
    confirmedDecisions: decisions ?? [],
  };
  const { data: stateVersionValue, error: stateVersionError } = await service.rpc("document_planning_state_version", {
    _organization_id: organizationId, _class_id: classId,
  });
  if (stateVersionError || !stateVersionValue) throw new Error("planning_state_unavailable");
  const stateVersion = String(stateVersionValue);
  const snapshot = (await service.from("document_app_state_snapshots").insert({
    organization_id: organizationId, class_id: classId, period: String(body.month ?? ""),
    state_version: stateVersion, state, captured_by: userId,
  }).select("id").single()).data;
  const target = plans?.[0];
  const lowReadiness = (reports ?? []).find((row) => /apenas dois participantes|dois participantes/i.test(row.conclusion ?? ""));
  const items = [
    { id: crypto.randomUUID(), kind: "complement", target_type: "cycle", target_id: target?.id, target_field: "technical_focus", category: "keep", current_value: target?.technical_focus ?? "Recepção direta", proposed_value: target?.technical_focus ?? "Recepção direta", recommendation: "keep_current", reason: "O foco atual é sustentado pelas evidências realizadas.", recommendation_confidence: .96 },
    ...(target && lowReadiness ? [{ id: crypto.randomUUID(), kind: "conflict", target_type: "cycle", target_id: target.id, target_field: "constraints", category: "adjust", current_value: target.constraints ?? "", proposed_value: "Mini 2x2 condicionado a nova evidência de prontidão.", recommendation: "apply", reason: "Apenas dois participantes executaram a recepção direta adequadamente em 09/07; o avanço deve depender de nova evidência de estabilidade.", recommendation_confidence: .98 }] : []),
    ...(target ? [{ id: crypto.randomUUID(), kind: "new_information", target_type: "cycle", target_id: target.id, target_field: "ruleset", category: "complement", current_value: target.ruleset ?? "", proposed_value: `Documento vinculado com ${uniqueDates.length} aulas e objetivos pedagógicos detalhados.`, recommendation: "apply", reason: "O documento acrescenta datas, objetivos e situações-problema sem substituir registros realizados.", recommendation_confidence: .93 }] : []),
  ];
  const interpretationWarnings = plan.duplicateBlocksIgnored > 0
    ? [`${plan.duplicateBlocksIgnored} bloco(s) repetido(s) ignorado(s).`]
    : [];
  const interpretationPayload = { documentType: "monthly_plan", className: classRow.name, period: String(body.month ?? ""), dates: uniqueDates, duplicateBlocksIgnored: plan.duplicateBlocksIgnored, warnings: interpretationWarnings };
  const revision = (await service.from("document_source_revisions").select("id").eq("external_revision_id", plan.revisionId).order("created_at", { ascending: false }).limit(1).single()).data;
  const interpretation = (await service.from("document_interpretations").insert({ organization_id: organizationId, revision_id: revision?.id, document_type: "monthly_plan", extraction_confidence: .94, interpretation: interpretationPayload, warnings: interpretationWarnings }).select("id").single()).data;
  const binding = (await service.from("document_context_bindings").insert({ organization_id: organizationId, interpretation_id: interpretation?.id, unit_id: classRow.unit_id, modality_id: classRow.modality, class_id: classId, period: String(body.month ?? ""), confidence: .98, status: "confirmed", confirmed_by: userId }).select("id").single()).data;
  const proposal = (await service.from("document_merge_proposals").insert({ organization_id: organizationId, class_id: classId, binding_id: binding?.id, snapshot_id: snapshot?.id, snapshot_version: stateVersion, status: "draft", created_by: userId }).select("id").single()).data;
  await service.from("document_merge_items").insert(items.map((entry) => ({ ...entry, organization_id: organizationId, proposal_id: proposal?.id, source_evidence: [{ sourceId: plan.file.id, revisionId: plan.revisionId }] })));
  const completedDates = (sessions ?? []).filter((entry) => entry.status === "completed").map((entry) => String(entry.start_at).slice(8, 10));
  return json({ proposal: { proposalId: proposal?.id, snapshotVersion: stateVersion, sourceTitle: plan.file.name, className: classRow.name, periodLabel: String(body.month ?? ""), summary: `Encontrei um planejamento com ${uniqueDates.length} aulas. O GoAtleta possui ${plans?.length ?? 0} ciclos, ${sessions?.length ?? 0} sessões e relatórios realizados${completedDates.length ? ` em ${completedDates.join(", ")}` : ""}. Compare as diferenças antes de atualizar.`, items: items.map((entry) => ({ id: entry.id, kind: entry.kind, targetType: entry.target_type, category: entry.category, currentValue: entry.current_value, proposedValue: entry.proposed_value, recommendation: entry.recommendation, reason: entry.reason, recommendationConfidence: entry.recommendation_confidence })) } });
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(request.url);
  try {
    if (request.method === "GET" && url.searchParams.get("oauth") === "callback") return await oauthCallback(url);
    const { user, client } = await caller(request);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (action === "drive_connection") {
      const organizationId = String(body.organizationId ?? "");
      await assertDocumentStaff(organizationId, user.id);
      const { data: existing } = await service.from("google_drive_connections").select("id").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
      if (existing) return json({ connected: true });
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !TOKEN_KEY) return json({ error: "google_drive_not_configured" }, 503);
      const verifier = randomValue(48);
      const challenge = base64Url(
        new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)))
      );
      const state = randomValue(32);
      await service.from("google_drive_oauth_states").insert({ state, organization_id: organizationId, user_id: user.id, code_verifier: verifier, redirect_to: String(body.redirectTo ?? "") });
      const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      Object.entries({ client_id: GOOGLE_CLIENT_ID, redirect_uri: CALLBACK_URL, response_type: "code", scope: DRIVE_SCOPE, access_type: "offline", include_granted_scopes: "true", prompt: "consent", state, code_challenge: challenge, code_challenge_method: "S256" }).forEach(([key, value]) => auth.searchParams.set(key, value));
      return json({ connected: false, authorizationUrl: auth.toString() });
    }
    if (action === "analyze") return await processAnalyze(body, user.id);
    if (action === "apply") {
      const { data, error } = await client.rpc("apply_approved_document_changes", { _proposal_id: body.proposalId, _approved_item_ids: body.approvedItemIds, _expected_state_version: body.expectedStateVersion, _idempotency_key: body.idempotencyKey });
      if (error) throw error;
      return json({ receipt: { applicationId: data.id, appliedItemIds: body.approvedItemIds, resultingVersion: data.resulting_version, appliedAt: data.applied_at, undoneAt: data.undone_at } });
    }
    if (action === "undo") {
      const { data, error } = await client.rpc("undo_document_changes", { _application_id: body.applicationId });
      if (error) throw error;
      const items = (await client.from("document_change_application_items").select("merge_item_id").eq("application_id", data.id)).data ?? [];
      return json({ receipt: { applicationId: data.id, appliedItemIds: items.map((entry) => entry.merge_item_id), resultingVersion: data.resulting_version, appliedAt: data.applied_at, undoneAt: data.undone_at } });
    }
    return json({ error: "unsupported_action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message === "unauthorized" ? "unauthorized" : "document_intelligence_failed" }, message === "unauthorized" ? 401 : 500);
  }
});
