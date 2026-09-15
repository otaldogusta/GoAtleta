import { useEffect, useState } from "react";
import { getStudentClassIds } from "../../db/students";
import type { ClassGroup } from "../../core/models";

export function useInstitutionClasses(studentId: string | undefined, organizationId: string | undefined, classes: ClassGroup[]) {
  const key = `${organizationId}:${studentId}`;
  const [result, setResult] = useState<{ key: string; ids: string[]; error: boolean }>();
  useEffect(() => {
    if (!studentId || !organizationId) return;
    let active = true;
    getStudentClassIds(studentId, { organizationId }).then(
      ids => { if (active) setResult({ key, ids, error: false }); },
      () => { if (active) setResult({ key, ids: [], error: true }); },
    );
    return () => { active = false; };
  }, [studentId, organizationId, key]);
  const current = result?.key === key ? result : undefined;
  const groups = new Map<string, { name: string; classes: ClassGroup[] }>();
  for (const item of classes) {
    if (item.organizationId !== organizationId || !current?.ids.includes(item.id)) continue;
    const unitKey = item.unitId || item.unit || "unassigned";
    if (!groups.has(unitKey)) groups.set(unitKey, { name: item.unit || "Unidade não informada", classes: [] });
    groups.get(unitKey)!.classes.push(item);
  }
  return { groups: [...groups.values()], loading: Boolean(studentId && organizationId && !current), error: current?.error };
}
