import type { ReactElement } from "react";
import * as primitives from "@react-pdf/renderer";
import { pdf as browserPdf } from "@react-pdf/renderer/lib/react-pdf.browser";

// One async boundary keeps the shared PDF engine out of initial common chunks.
export { AttendanceSummaryDocument } from "./attendance-summary-document";
export { ClassRosterDocument } from "./class-roster-document";
export { CoordinationAiDocument } from "./coordination-ai-document";
export { MonthlyLessonPlanDocument } from "./monthly-lesson-plan-document";
export { PeriodizationDocument } from "./periodization-document";
export { SessionPlanDocument } from "./session-plan-document";
export { SessionReportDocument } from "./session-report-document";

export const getWebPdfPrimitives = () => primitives;

export const renderWebPdfBlob = (document: ReactElement): Promise<Blob> =>
  browserPdf(document as Parameters<typeof browserPdf>[0]).toBlob();
