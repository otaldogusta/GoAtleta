import { supabaseRestGet, supabaseRestPost } from "./rest";
import type { CalendarPause } from "../core/holidays";

export type HolidayDecision = { organization_id: string; date: string; suspended_class_ids: string[] };
const scope = (organizationId: string) => {
  if (!organizationId.trim()) throw new Error("Missing organizationId for holiday calendar");
  return encodeURIComponent(organizationId);
};
export function listCalendarPauses(organizationId: string) {
  return supabaseRestGet<CalendarPause[]>(`/class_calendar_exceptions?organization_id=eq.${scope(organizationId)}&kind=eq.no_training&select=class_id,date`);
}
export function getHolidayDecision(organizationId: string, date: string) {
  return supabaseRestGet<HolidayDecision[]>(`/organization_holiday_decisions?organization_id=eq.${scope(organizationId)}&date=eq.${encodeURIComponent(date)}&select=organization_id,date,suspended_class_ids`);
}
export async function decideHoliday(organizationId: string, date: string, suspendedClassIds: string[]) {
  scope(organizationId);
  return supabaseRestPost<HolidayDecision>("/rpc/decide_organization_holiday", {
    p_organization_id: organizationId, p_date: date, p_suspended_class_ids: suspendedClassIds,
  });
}
