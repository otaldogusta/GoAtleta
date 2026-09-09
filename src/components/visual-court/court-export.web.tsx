import type { CourtVisualPayload } from "../../core/visual-court";
import { CourtEditorScene } from "./CourtEditorScene";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function courtPng(p: CourtVisualPayload, stepIndex: number): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  let svg = renderToStaticMarkup(<CourtEditorScene payload={p} stepIndex={stepIndex} landscape width={1600} height={980} />);
  if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("Não foi possível gerar a imagem.")); img.src = url; });
    const canvas = document.createElement("canvas"); canvas.width = 1600; canvas.height = 980;
    const context = canvas.getContext("2d"); if (!context) throw new Error("Exportação de imagem indisponível.");
    context.drawImage(img, 0, 0); return canvas.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}
export async function exportCourt(p: CourtVisualPayload, index: number, kind: "png" | "pdf" | "json") {
  if (kind === "json") {
    const safe = { ...p, editor: { ...p.editor!, actorMeta: Object.fromEntries(Object.entries(p.editor!.actorMeta).map(([id, m]) => [id, { team: m.team, locked: m.locked }])), lessonLink: undefined } };
    download(new Blob([JSON.stringify({ format: "goatleta-court", version: 1, payload: safe }, null, 2)], { type: "application/json" }), "jogada.goatleta.json"); return;
  }
  if (kind === "png") { const data = await courtPng(p, index); download(await (await fetch(data)).blob(), "quadra.png"); return; }
  const { Document, Page, Image: PdfImage, Text, pdf } = await import("@react-pdf/renderer");
  const frames: string[] = [];
  for (let i = 0; i < p.timeline.steps.length; i++) frames.push(await courtPng(p, i));
  const doc = <Document>{p.timeline.steps.map((step, i) => <Page key={step.id} size="A4" orientation="landscape" style={{ padding: 24, fontFamily: "Helvetica" }}>
    <Text style={{ fontSize: 16 }}>{p.editor?.title || "Quadra visual"}</Text>
    <Text style={{ fontSize: 11, marginTop: 6 }}>{i + 1}. {step.label}</Text>
    <PdfImage src={frames[i]} style={{ width: 730, height: 440, objectFit: "contain" }} />
    <Text style={{ fontSize: 10 }}>{step.note || ""}</Text>
  </Page>)}</Document>;
  download(await pdf(doc).toBlob(), "sequencia.pdf");
}
