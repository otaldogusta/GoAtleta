const sanitizeDocumentFilePart = (value: string) =>
  value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();

export function buildClassDocumentPdfFileName(params: {
  documentLabel: string;
  className: string;
  periodLabel: string;
  startTime?: string | null;
  daysLabel?: string | null;
}) {
  const className = sanitizeDocumentFilePart(params.className) || "Turma";
  const periodLabel = sanitizeDocumentFilePart(params.periodLabel) || "Período";
  const timeMatch = params.startTime?.trim().match(/^(\d{1,2}):?(\d{2})?/);
  const startTime = timeMatch
    ? `${Number(timeMatch[1])}h${timeMatch[2] && timeMatch[2] !== "00" ? timeMatch[2] : ""}`
    : "";
  const daysLabel = sanitizeDocumentFilePart(params.daysLabel ?? "");
  return [sanitizeDocumentFilePart(params.documentLabel), className, daysLabel, startTime, periodLabel]
    .filter(Boolean).join(" - ") + ".pdf";
}
