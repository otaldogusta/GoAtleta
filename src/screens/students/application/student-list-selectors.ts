import { compareClassesBySchedule } from "../../../core/class-schedule-sort";
import type { ClassGender, ClassGroup, Student } from "../../../core/models";
import { ALL_STUDENTS_UNITS_LABEL } from "./student-search";

export type StudentListPalette = { bg: string; text: string };

export type StudentListClassGroup = {
  classId: string;
  className: string;
  gender: ClassGender;
  scheduleLabel: string;
  palette: StudentListPalette | null;
  students: Student[];
};

export type StudentListUnitGroup = {
  unitName: string;
  classes: StudentListClassGroup[];
};

export const groupStudentsByClassId = (students: Student[]) => {
  const byClass = new Map<string, Student[]>();
  students.forEach((student) => {
    const key = student.classId || "";
    const bucket = byClass.get(key) ?? [];
    bucket.push(student);
    byClass.set(key, bucket);
  });
  return byClass;
};

export const buildStudentListGroups = (params: {
  classes: ClassGroup[];
  classById: ReadonlyMap<string, ClassGroup>;
  studentsByClassId: ReadonlyMap<string, Student[]>;
  unitFilter: string;
  unitLabel: (value: string) => string;
  hasActiveSearch: boolean;
  fallbackPalette: StudentListPalette;
  resolveClassPalette: (cls: ClassGroup, unitName: string) => StudentListPalette | null;
  resolveUnitPalette: (unitName: string) => StudentListPalette | null;
  formatClassScheduleLabel: (cls: ClassGroup | null) => string;
}): StudentListUnitGroup[] => {
  const filteredUnits =
    params.unitFilter === ALL_STUDENTS_UNITS_LABEL ? null : new Set([params.unitFilter]);
  const unitMap = new Map<
    string,
    {
      classes: Map<
        string,
        {
          cls: ClassGroup | null;
          className: string;
          students: Student[];
        }
      >;
    }
  >();

  params.classes.forEach((cls) => {
    const unitName = params.unitLabel(cls.unit);
    if (filteredUnits && !filteredUnits.has(unitName)) return;
    const classStudents = [...(params.studentsByClassId.get(cls.id) ?? [])];
    if (params.hasActiveSearch && !classStudents.length) return;
    if (!unitMap.has(unitName)) {
      unitMap.set(unitName, { classes: new Map() });
    }
    unitMap.get(unitName)?.classes.set(cls.id, {
      cls,
      className: cls.name?.trim() || "Sem turma",
      students: classStudents,
    });
  });

  params.studentsByClassId.forEach((items, classIdValue) => {
    if (!classIdValue || params.classById.has(classIdValue)) return;
    const fallbackUnitName = params.unitLabel("");
    if (filteredUnits && !filteredUnits.has(fallbackUnitName)) return;
    if (!unitMap.has(fallbackUnitName)) {
      unitMap.set(fallbackUnitName, { classes: new Map() });
    }
    unitMap.get(fallbackUnitName)?.classes.set(`missing:${classIdValue}`, {
      cls: null,
      className: "Sem turma",
      students: [...items],
    });
  });

  return Array.from(unitMap.entries())
    .map(([unitName, data]) => {
      const classesInUnit = Array.from(data.classes.entries())
        .map(([classKey, value]) => {
          const cls = value.cls;
          const palette = cls
            ? params.resolveClassPalette(cls, unitName)
            : params.resolveUnitPalette(unitName) ?? params.fallbackPalette;
          const scheduleLabel = params.formatClassScheduleLabel(cls);
          const sortedStudents = [...value.students].sort((a, b) =>
            a.name.localeCompare(b.name, "pt-BR")
          );
          return {
            classId: classKey,
            className: value.className,
            gender: cls?.gender ?? "misto",
            scheduleLabel,
            palette,
            students: sortedStudents,
          };
        })
        .sort((a, b) => {
          const aClass = params.classById.get(a.classId) ?? {
            name: a.className,
            daysOfWeek: null,
            startTime: null,
          };
          const bClass = params.classById.get(b.classId) ?? {
            name: b.className,
            daysOfWeek: null,
            startTime: null,
          };
          return compareClassesBySchedule(aClass, bClass);
        });
      return { unitName, classes: classesInUnit };
    })
    .sort((a, b) => a.unitName.localeCompare(b.unitName, "pt-BR"));
};
