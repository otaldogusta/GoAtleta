import { getClasses, getStudents } from "../../../db/seed";
import { measureAsync } from "../../../observability/perf";
import { STUDENTS_EXPORT_HEADERS_PTBR } from "../../../utils/export-schemas";
import { exportWorkbookXlsx, slugify } from "../../../utils/export-xlsx";

type ExportStudentsXlsxInput = {
  organizationId: string;
  organizationName?: string | null;
};

type ExportStudentsXlsxResult = {
  fileName: string;
  uri: string;
  totalStudents: number;
};

const formatDatePtBr = (value: string) => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  return `${match[3]}/${match[2]}/${match[1]}`;
};

const buildFileName = (organizationId: string, organizationName?: string | null) => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const orgFallback = String(organizationId ?? "")
    .trim()
    .split("-")[0]
    .slice(0, 12);
  const orgSlug =
    slugify(organizationName?.trim() || "") || slugify(orgFallback) || "organizacao";
  return `alunos_${orgSlug}_${yyyy}-${mm}-${dd}.xlsx`;
};

export async function exportStudentsXlsx(
  input: ExportStudentsXlsxInput
): Promise<ExportStudentsXlsxResult> {
  return measureAsync("screen.students.export.xlsx", async () => {
    const { organizationId, organizationName } = input;
    const [students, classes] = await Promise.all([
      getStudents({ organizationId }),
      getClasses({ organizationId }),
    ]);

    const classMap = new Map(classes.map((item) => [item.id, item]));
    const sortedStudents = [...students].sort((left, right) => {
      const leftClass = classMap.get(left.classId)?.name ?? "";
      const rightClass = classMap.get(right.classId)?.name ?? "";
      const byClass = leftClass.localeCompare(rightClass, "pt-BR");
      if (byClass !== 0) return byClass;
      return left.name.localeCompare(right.name, "pt-BR");
    });
    const lines: unknown[][] = [
      [...STUDENTS_EXPORT_HEADERS_PTBR],
      ...sortedStudents.map((student) => {
        const cls = classMap.get(student.classId);
        return [
          student.name,
          formatDatePtBr(student.birthDate),
          student.phone,
          student.guardianName,
          student.guardianPhone,
          cls?.name ?? "",
          cls?.unit ?? "",
          student.externalId ?? "",
          student.rgNormalized ?? "",
          student.loginEmail ?? "",
        ];
      }),
    ];

    const fileName = buildFileName(organizationId, organizationName);
    const result = await exportWorkbookXlsx({
      fileName,
      sheets: [
        {
          name: "Alunos",
          rows: lines,
          options: {
            freezeHeaderRow: true,
            autoFilterHeaderRow: true,
            autoSizeColumns: true,
            columnWidths: [30, 14, 18, 24, 20, 22, 24, 16, 16, 28],
            minColumnWidth: 10,
            maxColumnWidth: 42,
          },
        },
      ],
      dialogTitle: "Exportar planilha de alunos",
    });

    return { fileName: result.fileName, uri: result.uri, totalStudents: students.length };
  });
}
