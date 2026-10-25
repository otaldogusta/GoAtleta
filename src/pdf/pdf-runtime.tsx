import type { ReactElement } from "react";

export { AttendanceSummaryDocument } from "./attendance-summary-document";
export { ClassRosterDocument } from "./class-roster-document";
export { CoordinationAiDocument } from "./coordination-ai-document";
export { MonthlyLessonPlanDocument } from "./monthly-lesson-plan-document";
export { PeriodizationDocument } from "./periodization-document";
export { SessionPlanDocument } from "./session-plan-document";
export { SessionReportDocument } from "./session-report-document";

export function getWebPdfPrimitives(): typeof import("@react-pdf/renderer") {
  throw new Error("PDF preview is only available on web.");
}

export async function renderWebPdfBlob(_: ReactElement): Promise<Blob> {
  throw new Error("PDF preview is only available on web.");
}
