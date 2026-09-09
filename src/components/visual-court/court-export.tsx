import * as FileSystem from "expo-file-system/legacy";
// Keep the same extension as court-export.web.tsx so Metro selects the web implementation.
import * as Sharing from "expo-sharing";
import type { CourtVisualPayload } from "../../core/visual-court";

export async function exportCourt(p: CourtVisualPayload, _index: number, kind: "png" | "pdf" | "json") {
  if (kind !== "json") throw new Error("PNG e PDF estão disponíveis no navegador. Use a cópia editável neste dispositivo.");
  const safe = { ...p, editor: { ...p.editor!, actorMeta: Object.fromEntries(Object.entries(p.editor!.actorMeta).map(([id, m]) => [id, { team: m.team, locked: m.locked }])), lessonLink: undefined } };
  const uri = `${FileSystem.cacheDirectory}jogada.goatleta.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify({ format: "goatleta-court", version: 1, payload: safe }));
  if (!await Sharing.isAvailableAsync()) throw new Error("Compartilhamento indisponível neste dispositivo.");
  await Sharing.shareAsync(uri, { mimeType: "application/json" });
}
