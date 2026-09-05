// perf-check: ignore-render -- pure redirect; the destination owns screen rendering.
// perf-check: ignore-measure -- no data operation before navigation.
import { Redirect, useLocalSearchParams } from "expo-router";

import { buildClassAttendanceWorkspaceHref } from "../../../src/screens/classes/class-workspace-route";

export default function EmbeddedAttendanceRedirect() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const classId = typeof id === "string" ? id : "";
  const selectedDate = typeof date === "string" ? date : undefined;

  return <Redirect href={buildClassAttendanceWorkspaceHref(classId, selectedDate)} />;
}
