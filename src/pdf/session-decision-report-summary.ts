type SessionDecisionReportViewModelLike = {
  shouldShow: boolean;
  shortReason?: string;
  items?: string[];
  avoidItems?: string[];
  evidenceItems?: Array<{
    label?: string;
    confidence?: string;
  }>;
};

export type SessionDecisionReportPdfSummary = {
  title: string;
  shortReason: string;
  signals: string[];
  avoid: string[];
  evidence: string[];
};

const cleanList = (values: Array<string | null | undefined> | undefined, limit: number) => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values ?? []) {
    const cleaned = String(value ?? "").trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
    if (output.length >= limit) break;
  }
  return output;
};

export function buildSessionDecisionReportPdfSummary(
  viewModel: SessionDecisionReportViewModelLike | null | undefined,
): SessionDecisionReportPdfSummary | null {
  if (!viewModel?.shouldShow) return null;

  const shortReason = String(viewModel.shortReason ?? "").trim();
  const signals = cleanList(viewModel.items, 3);
  const avoid = cleanList(viewModel.avoidItems, 3);
  const evidence = cleanList(
    (viewModel.evidenceItems ?? []).map((item) => {
      const label = String(item?.label ?? "").trim();
      if (!label) return "";
      const confidence = String(item?.confidence ?? "").trim();
      return confidence ? `${label} · confiança ${confidence}` : label;
    }),
    2,
  );

  if (!shortReason && !signals.length && !avoid.length && !evidence.length) return null;

  return {
    title: "Justificativa do planejamento",
    shortReason,
    signals,
    avoid,
    evidence,
  };
}
