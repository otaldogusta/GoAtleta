import { cloneElement } from "react";
import { Text, View } from "react-native";

import type { ClassGroup } from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";
import {
  ClassModalityFilterChips,
  type ClassModalityFilterValue,
} from "./ClassModalityFilterChips";
import { StudentClassOptionContent } from "./StudentDropdownOptions";

export type { ClassModalityFilterValue };

type StudentClassDropdownPanelProps = {
  colors: ThemeColors;
  classOptions: ClassGroup[];
  filteredClassOptions: ClassGroup[];
  classModalities: ClassGroup["modality"][];
  selectedClassId: string;
  modalityFilter: ClassModalityFilterValue;
  onModalityFilterChange: (value: ClassModalityFilterValue) => void;
  onSelectClass: (value: ClassGroup) => void;
};

export function StudentClassDropdownPanel(props: StudentClassDropdownPanelProps) {
  return <StudentClassDropdownPanelContent {...props} />;
}

export function StudentClassDropdownPanelContent({
  colors,
  classOptions,
  filteredClassOptions,
  classModalities,
  selectedClassId,
  modalityFilter,
  onModalityFilterChange,
  onSelectClass,
}: StudentClassDropdownPanelProps) {
  if (!classOptions.length) {
    return (
      <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>
        Nenhuma turma encontrada.
      </Text>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <ClassModalityFilterChips
        colors={colors}
        value={modalityFilter}
        modalities={classModalities}
        onChange={onModalityFilterChange}
      />
      {filteredClassOptions.length ? (
        filteredClassOptions.map((item, index) =>
          cloneElement(
            StudentClassOptionContent({
              colors,
              item,
              active: item.id === selectedClassId,
              onSelect: onSelectClass,
              isFirst: index === 0,
            }),
            { key: item.id }
          )
        )
      ) : (
        <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>
          Nenhuma turma dessa modalidade nesta unidade.
        </Text>
      )}
    </View>
  );
}
