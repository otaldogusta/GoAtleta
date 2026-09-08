import { createEdgeFunction, createError, createSuccess } from "../_shared/framework.ts";
import { readAudioForm, validateAudio } from "./audio-input.ts";
import { canTranscribeLesson } from "./audio-access.ts";

// Per-instance burst protection complements the gateway; bounded to avoid a growing map.
const requests = new Map<string, number[]>();
Deno.serve(createEdgeFunction({
  name: "assistant-transcribe",
  requireAuth: true,
  parseJson: false,
  handler: async ({ req, user, supabase }) => {
    if (req.method !== "POST") return createError(405, "METHOD_NOT_ALLOWED", "Use POST.");
    const now = Date.now();
    for (const [key, times] of requests) if (!times.some(time => now - time < 60_000)) requests.delete(key);
    const times = (requests.get(user!.id) ?? []).filter(time => now - time < 60_000);
    if (times.length >= 4) return createError(429, "RATE_LIMIT", "Aguarde um minuto para gravar novamente.");
    requests.set(user!.id, [...times, now]);
    let form: FormData;
    try { form = await readAudioForm(req); }
    catch { return createError(400, "INVALID_AUDIO", "Áudio inválido ou maior que 8 MB."); }
    const file = form.get("file");
    if (!validateAudio(file)) return createError(400, "INVALID_AUDIO", "Use um áudio de até 8 MB.");
    const organizationId = String(form.get("organizationId") ?? "");
    const classId = String(form.get("classId") ?? "");
    if (!organizationId) return createError(400, "MISSING_SCOPE", "Selecione uma organização.");
    if (!await canTranscribeLesson(supabase, user!.id, organizationId, classId || undefined)) return createError(403, "FORBIDDEN", "Sem acesso a este contexto.");
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return createError(503, "UNAVAILABLE", "Transcrição indisponível. Você pode digitar.");
    const audio = new FormData();
    audio.append("file", file, "recording." + (file.type.includes("webm") ? "webm" : file.type.includes("wav") ? "wav" : file.type.includes("mpeg") ? "mp3" : "m4a"));
    audio.append("model", "gpt-transcribe");
    audio.append("response_format", "json");
    audio.append("languages[]", "pt");
    audio.append("prompt", "Professor organizando aula de voleibol em português. Vocabulário: manchete, manchetão, recepção, saque, levantamento, rodízio.");
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: audio,
        signal: AbortSignal.timeout(45_000),
      });
    } catch { return createError(504, "TRANSCRIPTION_TIMEOUT", "A transcrição demorou. Tente novamente ou digite."); }
    if (!response.ok) return createError(502, "TRANSCRIPTION_FAILED", "Não foi possível transcrever. Tente novamente ou digite.");
    const data = await response.json().catch(() => null);
    if (!data || typeof data.text !== "string") return createError(502, "INVALID_TRANSCRIPT_RESPONSE", "O serviço retornou uma resposta inválida. Tente novamente.");
    const text = data.text.trim().slice(0, 6000);
    if (!text) return createError(422, "EMPTY_TRANSCRIPT", "Não identifiquei uma fala. Grave novamente ou digite.");
    // Audio and transcript are not persisted or logged.
    return createSuccess({ text });
  },
}));
