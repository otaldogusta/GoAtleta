import type { CourtVisualPayload } from "../../core/visual-court";
import { CourtEditorScene } from "./CourtEditorScene";
import { buildGifFramePlan, gifStepFilename, serveRotationLabel, usesSingleLowerCourtSide } from "./court-export-utils";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function courtCanvas(
  p: CourtVisualPayload,
  stepIndex: number,
  options: { width: number; height: number; progress?: number; landscape?: boolean; half?: boolean },
): Promise<HTMLCanvasElement> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  let svg = renderToStaticMarkup(
    <CourtEditorScene
      payload={p}
      stepIndex={stepIndex}
      landscape={options.landscape ?? true}
      half={options.half}
      progress={options.progress}
      width={options.width}
      height={options.height}
    />,
  );
  if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("Não foi possível gerar a imagem.")); img.src = url; });
    const canvas = document.createElement("canvas"); canvas.width = options.width; canvas.height = options.height;
    const context = canvas.getContext("2d"); if (!context) throw new Error("Exportação de imagem indisponível.");
    context.drawImage(img, 0, 0, options.width, options.height);
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}

export async function courtPng(p: CourtVisualPayload, stepIndex: number, progress?: number): Promise<string> {
  return (await courtCanvas(p, stepIndex, { width: 1600, height: 980, progress })).toDataURL("image/png");
}

async function exportCourtGif(p: CourtVisualPayload, stepIndex: number) {
  const step = p.timeline.steps[stepIndex];
  if (!step) throw new Error("Etapa não encontrada para exportação.");
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const gif = GIFEncoder();
  const width = 800;
  const height = 490;
  const frames = buildGifFramePlan(step.durationMs);
  let sharedPalette: ReturnType<typeof quantize> | undefined;

  for (const [frameIndex, frame] of frames.entries()) {
    const canvas = await courtCanvas(p, stepIndex, { width, height, progress: frame.progress });
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Exportação de GIF indisponível.");
    const rgba = context.getImageData(0, 0, width, height).data;
    const palette = sharedPalette ?? quantize(rgba, 128);
    sharedPalette = palette;
    const indexed = applyPalette(rgba, palette);
    gif.writeFrame(indexed, width, height, {
      ...(frameIndex === 0 ? { palette, repeat: 0 } : {}),
      delay: frame.delayMs,
    });
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }

  gif.finish();
  const bytes = gif.bytes();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  download(new Blob([buffer], { type: "image/gif" }), gifStepFilename(stepIndex, step.label));
}

export async function exportCourt(p: CourtVisualPayload, index: number, kind: "png" | "gif" | "pdf" | "json") {
  if (kind === "json") {
    const safe = { ...p, editor: { ...p.editor!, actorMeta: Object.fromEntries(Object.entries(p.editor!.actorMeta).map(([id, m]) => [id, { team: m.team, locked: m.locked }])), lessonLink: undefined } };
    download(new Blob([JSON.stringify({ format: "goatleta-court", version: 1, payload: safe }, null, 2)], { type: "application/json" }), "jogada.goatleta.json"); return;
  }
  if (kind === "png") { const data = await courtPng(p, index); download(await (await fetch(data)).blob(), "quadra.png"); return; }
  if (kind === "gif") { await exportCourtGif(p, index); return; }
  const { Buffer } = await import("buffer");
  if (!("Buffer" in globalThis)) Object.assign(globalThis, { Buffer });
  const { Document, Page, Image: PdfImage, Text, View: PdfView, pdf } = await import("@react-pdf/renderer");
  const halfCourt = p.sport === "volleyball_indoor" && usesSingleLowerCourtSide(p.timeline.steps);
  const frames: { initial: string; final: string }[] = [];
  for (let i = 0; i < p.timeline.steps.length; i++) {
    frames.push({
      initial: (await courtCanvas(p, i, halfCourt
        ? { width: 900, height: 844, progress: 0, landscape: false, half: true }
        : { width: 1_000, height: 612, progress: 0 })).toDataURL("image/png"),
      final: (await courtCanvas(p, i, halfCourt
        ? { width: 900, height: 844, progress: 1, landscape: false, half: true }
        : { width: 1_000, height: 612, progress: 1 })).toDataURL("image/png"),
    });
  }
  const doc = <Document>{p.timeline.steps.map((step, i) => <Page key={step.id} size="A4" orientation={halfCourt ? "portrait" : "landscape"} style={{ padding: 24, fontFamily: "Helvetica" }}>
    <Text style={{ fontSize: 16, fontWeight: 700 }}>{p.editor?.title || "Quadra visual"}</Text>
    <Text style={{ fontSize: 11, marginTop: 5 }}>{i + 1}. {step.label} · {(step.durationMs / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s</Text>
    {serveRotationLabel(step.label) ? <Text style={{ fontSize: 10, marginTop: 4, color: "#475569" }}>{serveRotationLabel(step.label)}</Text> : null}
    {halfCourt ? <PdfView style={{ alignItems: "center", marginTop: 10 }}>
      <Text style={{ width: 346, fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Posição inicial (saque)</Text>
      <PdfImage src={frames[i].initial} style={{ width: 346, height: 325, objectFit: "contain" }} />
      <Text style={{ width: 346, fontSize: 10, fontWeight: 700, marginTop: 8, marginBottom: 4 }}>Posição final</Text>
      <PdfImage src={frames[i].final} style={{ width: 346, height: 325, objectFit: "contain" }} />
    </PdfView> : <PdfView style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
      <PdfView style={{ width: 370 }}>
        <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 5 }}>Posição inicial</Text>
        <PdfImage src={frames[i].initial} style={{ width: 370, height: 227, objectFit: "contain" }} />
      </PdfView>
      <PdfView style={{ width: 370 }}>
        <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 5 }}>Posição final</Text>
        <PdfImage src={frames[i].final} style={{ width: 370, height: 227, objectFit: "contain" }} />
      </PdfView>
    </PdfView>}
    {step.note ? <Text style={{ fontSize: 10, marginTop: 8 }}>{step.note}</Text> : null}
  </Page>)}</Document>;
  download(await pdf(doc).toBlob(), "sequencia.pdf");
}
