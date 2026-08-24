import type { ClassWorkspaceSection } from "./components/ClassOperationsWorkspace";

type RouteParam = string | string[] | undefined;

function firstRouteParam(value: RouteParam) {
  return Array.isArray(value) ? value[0] : value;
}

export function buildClassAttendanceWorkspaceHref(classId: string, date?: string) {
  return {
    pathname: "/class/[id]",
    params: {
      id: classId,
      ...(date ? { date } : {}),
      section: "attendance",
    },
  } as const;
}

export function resolveClassWorkspaceRouteSection(section: RouteParam): ClassWorkspaceSection {
  return firstRouteParam(section) === "attendance" ? "attendance" : "overview";
}

export function parseClassWorkspaceRouteDate(value: RouteParam) {
  const date = firstRouteParam(value);
  const match = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}
