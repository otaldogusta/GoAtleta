import { assertSessionIdentity, getSessionIdentity } from "../auth/session";
import { getActiveOrganizationId, getReadCacheGeneration } from "../db/client";
import { supabaseRestGet, supabaseRestRequest } from "./rest";

export type HolidayMakeup = {
  classId: string;
  originalDate: string;
  date: string;
  startTime: string;
};

async function calendarGuard(organizationId: string) {
  const identity = getSessionIdentity();
  const generation = getReadCacheGeneration();
  const assertCurrent = () => {
    assertSessionIdentity(identity);
    if (getReadCacheGeneration() !== generation) throw new Error("Reabra a agenda na organização atual.");
  };
  if (!organizationId || await getActiveOrganizationId() !== organizationId) {
    throw new Error("Reabra a agenda na organização atual.");
  }
  assertCurrent();
  return assertCurrent;
}

export async function listHolidayMakeups(organizationId: string, classId?: string): Promise<HolidayMakeup[]> {
  const assertCurrent = await calendarGuard(organizationId);
  const scope = `organization_id=eq.${encodeURIComponent(organizationId)}`;
  const classFilter = classId === undefined ? "" : `&class_id=eq.${encodeURIComponent(classId)}`;
  const select = "classId:class_id,originalDate:original_date,date,startTime:start_time";
  const pageSize = 250;
  const result: HolidayMakeup[] = [];
  for (;;) {
    const page = await supabaseRestGet<HolidayMakeup[]>(
      `/class_holiday_makeups?${scope}${classFilter}&select=${select}&order=date.asc,class_id.asc&limit=${pageSize}&offset=${result.length}`,
      assertCurrent,
    );
    result.push(...page);
    if (page.length < pageSize) return result;
  }
}

export async function scheduleHolidayMakeup(
  organizationId: string, classId: string, originalDate: string, date: string, startTime: string,
): Promise<void> {
  const assertContextCurrent = await calendarGuard(organizationId);
  await supabaseRestRequest("/rpc/schedule_holiday_makeup", {
    method: "POST",
    body: { p_organization_id: organizationId, p_class_id: classId, p_original_date: originalDate, p_date: date, p_start_time: startTime },
    assertContextCurrent,
  });
}
