import { Linking } from "react-native";

export function isMockMediaUri(uri: string): boolean {
  return String(uri ?? "").trim().toLowerCase().startsWith("mock://");
}

export function isHttpMediaUri(uri: string): boolean {
  return /^https?:\/\//i.test(String(uri ?? "").trim());
}

function normalizeMediaUri(uri: string): string {
  const trimmed = String(uri ?? "").trim();
  if (!trimmed) {
    return "";
  }
  if (isHttpMediaUri(trimmed) || isMockMediaUri(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

export function getMockMediaMessage(uri: string): string {
  const normalized = String(uri ?? "").trim();
  if (!normalized) {
    return "Esta mídia foi criada pelo provider mockado. Configure o Higgsfield real para gerar um vídeo ou imagem reproduzível.";
  }

  return `Esta mídia foi criada pelo provider mockado. Configure o Higgsfield real para gerar um vídeo ou imagem reproduzível.\n\nOrigem: ${normalized}`;
}

export async function openExerciseMediaUri(
  uri: string,
): Promise<{ ok: boolean; reason?: string }> {
  const normalized = normalizeMediaUri(uri);

  if (!normalized) {
    return { ok: false, reason: "empty_uri" };
  }

  if (isMockMediaUri(normalized)) {
    return { ok: false, reason: "mock_uri" };
  }

  try {
    const canOpen = await Linking.canOpenURL(normalized);
    if (!canOpen) {
      return { ok: false, reason: "open_failed" };
    }

    await Linking.openURL(normalized);
    return { ok: true };
  } catch {
    return { ok: false, reason: "open_failed" };
  }
}
