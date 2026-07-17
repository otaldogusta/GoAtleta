import React from "react";

import { MonthlyLessonPlanDocument } from "./monthly-lesson-plan-document.web";
import {
  buildSessionMonthlyPlanData,
  type SessionPlanPdfData,
} from "./templates/session-plan";

export function SessionPlanDocument({ data }: { data: SessionPlanPdfData }) {
  return <MonthlyLessonPlanDocument data={buildSessionMonthlyPlanData(data)} />;
}
