export function getAttendanceReceiptTarget(url: URL) {
  const path = /^\/class\/([^/]+)(?:\/attendance)?\/?$/.exec(url.pathname);
  const section = url.searchParams.get("section");
  const date = url.searchParams.get("date");
  if (!path || (section !== null && section !== "attendance") ||
    (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date))) return null;
  return { classId: path[1], date: date ?? undefined };
}

export const loadOfflineAttendanceEditor = () => import("./OfflineAttendanceEditor");
