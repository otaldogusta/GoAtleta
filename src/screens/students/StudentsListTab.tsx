import { memo, type ReactElement } from "react";
import { View } from "react-native";

import type { Student } from "../../core/models";
import type { StudentListUnitGroup } from "./application/student-list-selectors";
import { StudentsListSection } from "./components/StudentsListSection";
import { StudentsSearchFiltersPanel } from "./components/StudentsSearchFiltersPanel";

type RenderStudentItemArgs = {
  item: Student;
  paletteOverride: { bg: string; text: string };
  classNameOverride: string;
  unitNameOverride: string;
};

export type StudentsListTabProps = {
  studentsUnitOptions: string[];
  studentsUnitFilter: string;
  setStudentsUnitFilter: (unit: string) => void;
  studentsSearch: string;
  setStudentsSearch: (search: string) => void;
  studentsFiltered: Student[];
  studentsGrouped: StudentListUnitGroup[];
  expandedUnits: Record<string, boolean>;
  expandedClasses: Record<string, boolean>;
  toggleUnitExpanded: (unitName: string) => void;
  toggleClassExpanded: (classId: string) => void;
  renderStudentItem: (args: RenderStudentItemArgs) => ReactElement | null;
};

export const StudentsListTab = memo(function StudentsListTab({
  studentsUnitOptions,
  studentsUnitFilter,
  setStudentsUnitFilter,
  studentsSearch,
  setStudentsSearch,
  studentsFiltered,
  studentsGrouped,
  expandedUnits,
  expandedClasses,
  toggleUnitExpanded,
  toggleClassExpanded,
  renderStudentItem,
}: StudentsListTabProps) {
  const hasSearch = studentsSearch.trim().length > 0;

  return (
    <View style={{ gap: 12 }}>
      <StudentsSearchFiltersPanel
        studentsUnitOptions={studentsUnitOptions}
        studentsUnitFilter={studentsUnitFilter}
        onStudentsUnitFilterChange={setStudentsUnitFilter}
        studentsSearch={studentsSearch}
        onStudentsSearchChange={setStudentsSearch}
      />

      <StudentsListSection
        studentsFilteredCount={studentsFiltered.length}
        studentsGrouped={studentsGrouped}
        studentsUnitFilter={studentsUnitFilter}
        hasSearch={hasSearch}
        expandedUnits={expandedUnits}
        expandedClasses={expandedClasses}
        toggleUnitExpanded={toggleUnitExpanded}
        toggleClassExpanded={toggleClassExpanded}
        renderStudentItem={renderStudentItem}
      />
    </View>
  );
});
