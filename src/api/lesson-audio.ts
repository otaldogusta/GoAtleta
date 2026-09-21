import { Platform } from "react-native";
import { getValidAccessToken } from "../auth/session";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

function transcriptionError(status: number) {
  if (status === 404 || status === 503) return "A transcrição ainda não está disponível no servidor. Você pode digitar.";
  if (status === 401) return "Entre novamente para transcrever.";
  if (status === 403) return "Você não tem acesso à transcrição neste contexto.";
  if (status === 429) return "Aguarde um minuto antes de gravar novamente.";
  if (status === 422) return "Não identifiquei uma fala. Grave novamente ou digite.";
  return "Não foi possível transcrever. Tente novamente ou digite.";
}

export async function checkLessonAudioAvailability(signal: AbortSignal) {
  const token = await getValidAccessToken();
  if (!token) throw new Error(transcriptionError(401));
  // The deployed endpoint rejects GET with 405 before handling audio or billing.
  const response = await fetch(`${SUPABASE_URL}/functions/v1/assistant-transcribe`, {
    method: "GET", headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY }, signal,
  }).catch(() => { throw new Error("Não foi possível acessar o serviço de transcrição. Você pode digitar."); });
  if (response.status !== 405) throw new Error(transcriptionError(response.status));
}

export async function transcribeLessonAudio(uri: string, scope: { organizationId: string; classId?: string }, signal: AbortSignal) {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Entre novamente para transcrever.");
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri, { signal })).blob();
    if (blob.size > 8 * 1024 * 1024) throw new Error("A gravação excedeu 8 MB. Envie um trecho menor.");
    form.append("file", blob, blob.type.includes("mp4") ? "lesson.m4a" : "lesson.webm");
  } else {
    form.append("file", { uri, type: "audio/m4a", name: "lesson.m4a" } as unknown as Blob);
  }
  form.append("organizationId", scope.organizationId);
  if (scope.classId) form.append("classId", scope.classId);
  const response = await fetch(`${SUPABASE_URL}/functions/v1/assistant-transcribe`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY }, body: form, signal,
  });
  if (!response.ok) throw new Error(transcriptionError(response.status));
  const data = await response.json();
  if (typeof data.text !== "string") throw new Error("O serviço retornou uma resposta inválida. Tente novamente.");
  if (!data.text.trim()) throw new Error(transcriptionError(422));
  return data.text as string;
}
