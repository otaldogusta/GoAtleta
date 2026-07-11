import type {
  DocumentInterpretation,
  ExtractedLesson,
  ExtractedReport,
  PedagogicalDimension,
} from "./pedagogical-types";

const normalize = (value: string) => value.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
const unique = (values: string[]) => [...new Set(values.map(normalize).filter(Boolean))];

const toIsoDate = (value: string) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value.trim();
};

const extractDimensions = (value: string): PedagogicalDimension => {
  const read = (label: string, next: string) =>
    new RegExp(`${label}:\\s*(.*?)(?=${next}:|$)`, "i").exec(value)?.[1]?.trim();
  return {
    conceptual: read("Conceitual", "Atitudinal"),
    attitudinal: read("Atitudinal", "Procedimental"),
    procedural: /Procedimental:\s*(.*)$/i.exec(value)?.[1]?.trim(),
  };
};

export function parsePedagogicalGoogleDoc(params: {
  sourceDocumentId: string;
  title: string;
  text: string;
}): DocumentInterpretation {
  const text = normalize(params.text);
  const isPlan = /plano de aula|planejamento/i.test(`${params.title}\n${text}`);
  const isReport = /relat[oó]rio/i.test(`${params.title}\n${text}`);
  const classMatch = /Turma:\s*([^\n|]+)/i.exec(text);
  const monthMatch = /(?:MÊS:\s*)?(JANEIRO|FEVEREIRO|MARÇO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\/?(20\d{2})?/i.exec(text);

  const lessonsByDate = new Map<string, ExtractedLesson>();
  const lessonRegex = /Data:\s*(\d{2}\/\d{2}\/\d{4})[\s\S]*?Hor[aá]rio:\s*(\d{1,2})h\s*(?:às|a)\s*(\d{1,2})h[\s\S]*?Objetivo geral:\s*([^\n|]+)[\s\S]*?Objetivo espec[ií]fico:\s*([^\n|]+)[\s\S]*?Situa[cç][aã]o-problema:\s*([^\n|]+)/gi;
  let lessonMatch: RegExpExecArray | null;
  while ((lessonMatch = lessonRegex.exec(text))) {
    const date = toIsoDate(lessonMatch[1]);
    if (!lessonsByDate.has(date)) {
      lessonsByDate.set(date, {
        date,
        startTime: `${lessonMatch[2].padStart(2, "0")}:00`,
        endTime: `${lessonMatch[3].padStart(2, "0")}:00`,
        generalObjective: normalize(lessonMatch[4]),
        dimensions: extractDimensions(lessonMatch[5]),
        problemSituation: normalize(lessonMatch[6]),
        activities: [],
      });
    }
  }

  const reportsByDate = new Map<string, ExtractedReport>();
  const reportRegex = /Data:\s*(\d{2}\/\d{2}\/\d{4})[\s\S]*?Conclus[aã]o:\s*([\s\S]*?)(?=N[uú]mero de Participantes:)[\s\S]*?N[uú]mero de Participantes:[^\d]*(?:\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}[^:]*:\s*)?(\d+)/gi;
  let reportMatch: RegExpExecArray | null;
  while ((reportMatch = reportRegex.exec(text))) {
    const date = toIsoDate(reportMatch[1]);
    const conclusion = normalize(reportMatch[2]);
    if (!reportsByDate.has(date)) {
      reportsByDate.set(date, {
        date,
        participantCount: Number(reportMatch[3]),
        conclusion,
        difficulties: unique(
          conclusion.match(/[^.]*\b(?:dificuldade|complexidade|compromet)[^.]*\./gi) ?? []
        ),
        adaptations: unique(conclusion.match(/[^.]*\b(?:adapta|ajust)[^.]*\./gi) ?? []),
      });
    }
  }

  const repeatedDateCount = (text.match(/Data:\s*\d{2}\/\d{2}\/\d{4}/gi) ?? []).length;
  const uniqueDateCount = new Set(
    (text.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})/gi) ?? []).map((value) => value.replace(/Data:\s*/i, ""))
  ).size;
  const duplicateBlocksIgnored = Math.max(0, repeatedDateCount - uniqueDateCount);

  const documentType = isPlan ? "monthly_plan" : isReport ? "monthly_report" : "unknown";
  const warnings = duplicateBlocksIgnored ? [`${duplicateBlocksIgnored} bloco(s) repetido(s) ignorado(s).`] : [];
  if (!classMatch) warnings.push("Turma não identificada com confiança suficiente.");

  return {
    sourceDocumentId: params.sourceDocumentId,
    documentType,
    className: {
      value: classMatch?.[1]?.trim() ?? null,
      confidence: classMatch ? 0.98 : 0,
      sourceText: classMatch?.[0],
      warnings: classMatch ? [] : ["Confirmar turma antes de continuar."],
    },
    period: {
      value: monthMatch ? `${monthMatch[1].toUpperCase()}/${monthMatch[2] ?? ""}`.replace(/\/$/, "") : null,
      confidence: monthMatch ? 0.95 : 0,
      sourceText: monthMatch?.[0],
      warnings: monthMatch ? [] : ["Confirmar período antes de continuar."],
    },
    lessons: [...lessonsByDate.values()],
    reports: [...reportsByDate.values()],
    duplicateBlocksIgnored,
    warnings,
    extractionConfidence: classMatch && monthMatch && documentType !== "unknown" ? 0.94 : 0.55,
  };
}
