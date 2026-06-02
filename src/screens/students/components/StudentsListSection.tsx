import { Ionicons } from "@expo/vector-icons";
import { memo, type ReactElement } from "react";
import { Text, View } from "react-native";

import type { Student } from "../../../core/models";
import type {
  StudentListClassGroup,
  StudentListUnitGroup,
} from "../application/student-list-selectors";
import { radius } from "../../../theme/tokens";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme, type ThemeColors } from "../../../ui/app-theme";
import { StudentsEmptyState } from "./StudentsEmptyState";
import { StudentsListHeaderContent } from "./StudentsListHeader";

export type StudentsRenderStudentItemArgs = {
  item: Student;
  paletteOverride: { bg: string; text: string };
  classNameOverride: string;
  unitNameOverride: string;
};

type StudentsListSectionProps = {
  studentsFilteredCount: number;
  studentsGrouped: StudentListUnitGroup[];
  studentsUnitFilter: string;
  hasSearch: boolean;
  expandedUnits: Record<string, boolean>;
  expandedClasses: Record<string, boolean>;
  toggleUnitExpanded: (unitName: string) => void;
  toggleClassExpanded: (classId: string) => void;
  renderStudentItem: (args: StudentsRenderStudentItemArgs) => ReactElement | null;
};

export const StudentsListSection = memo(function StudentsListSection(
  props: StudentsListSectionProps
) {
  const { colors } = useAppTheme();

  return <StudentsListSectionContent colors={colors} {...props} />;
});

export function StudentsListSectionContent({
  colors,
  studentsFilteredCount,
  studentsGrouped,
  studentsUnitFilter,
  hasSearch,
  expandedUnits,
  expandedClasses,
  toggleUnitExpanded,
  toggleClassExpanded,
  renderStudentItem,
}: StudentsListSectionProps & { colors: ThemeColors }) {
  return (
    <View style={{ gap: 8 }}>
      <StudentsListHeaderContent colors={colors} resultCount={studentsFilteredCount} />

      {studentsGrouped.length > 0 ? (
        <View style={{ gap: 12 }}>
          {studentsGrouped.map(({ unitName, classes: unitClasses }) => (
            <StudentsUnitGroupBlockContent
              key={unitName}
              colors={colors}
              unitName={unitName}
              unitClasses={unitClasses}
              hasSearch={hasSearch}
              expandedUnits={expandedUnits}
              expandedClasses={expandedClasses}
              toggleUnitExpanded={toggleUnitExpanded}
              toggleClassExpanded={toggleClassExpanded}
              renderStudentItem={renderStudentItem}
            />
          ))}
        </View>
      ) : (
        <StudentsEmptyState
          unitFilter={studentsUnitFilter}
          hasSearch={hasSearch}
        />
      )}
    </View>
  );
}

type StudentsUnitGroupBlockProps = {
  colors: ThemeColors;
  unitName: string;
  unitClasses: StudentListClassGroup[];
  hasSearch: boolean;
  expandedUnits: Record<string, boolean>;
  expandedClasses: Record<string, boolean>;
  toggleUnitExpanded: (unitName: string) => void;
  toggleClassExpanded: (classId: string) => void;
  renderStudentItem: (args: StudentsRenderStudentItemArgs) => ReactElement | null;
};

export function StudentsUnitGroupBlockContent({
  colors,
  unitName,
  unitClasses,
  hasSearch,
  expandedUnits,
  expandedClasses,
  toggleUnitExpanded,
  toggleClassExpanded,
  renderStudentItem,
}: StudentsUnitGroupBlockProps) {
  const unitExpanded = hasSearch || !!expandedUnits[unitName];

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={() => toggleUnitExpanded(unitName)}
        style={{
          paddingVertical: 7,
          paddingHorizontal: 10,
          borderRadius: radius.internal,
          backgroundColor: colors.backgroundSubtle,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "900", color: colors.textPrimary }}>
          {unitName}
        </Text>
        <Ionicons
          name={unitExpanded ? "chevron-down" : "chevron-forward"}
          size={16}
          color={colors.textMuted}
        />
      </Pressable>
      {unitExpanded ? (
        <View
          style={{
            gap: 10,
            marginLeft: 4,
            paddingLeft: 10,
            paddingTop: 6,
            borderLeftWidth: 2,
            borderLeftColor: colors.borderSubtle,
          }}
        >
          {unitClasses.map((group) => (
            <StudentsClassGroupBlockContent
              key={group.classId}
              colors={colors}
              group={group}
              unitName={unitName}
              classExpanded={
                (hasSearch && group.students.length > 0) ||
                !!expandedClasses[group.classId]
              }
              toggleClassExpanded={toggleClassExpanded}
              renderStudentItem={renderStudentItem}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

type StudentsClassGroupBlockProps = {
  colors: ThemeColors;
  group: StudentListClassGroup;
  unitName: string;
  classExpanded: boolean;
  toggleClassExpanded: (classId: string) => void;
  renderStudentItem: (args: StudentsRenderStudentItemArgs) => ReactElement | null;
};

export function StudentsClassGroupBlockContent({
  colors,
  group,
  unitName,
  classExpanded,
  toggleClassExpanded,
  renderStudentItem,
}: StudentsClassGroupBlockProps) {
  const groupPalette =
    group.palette ?? {
      bg: colors.primaryBg,
      text: colors.primaryText,
    };

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={() => toggleClassExpanded(group.classId)}
        style={{
          paddingVertical: 6,
          paddingHorizontal: 8,
          borderRadius: radius.internal,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        {StudentsClassHeaderContent({ colors, group, groupPalette })}
        <Ionicons
          name={classExpanded ? "chevron-down" : "chevron-forward"}
          size={16}
          color={colors.textMuted}
        />
      </Pressable>
      {classExpanded ? (
        <View
          style={{
            gap: 8,
            marginLeft: 4,
            paddingLeft: 10,
            borderLeftWidth: 2,
            borderLeftColor: groupPalette.bg,
          }}
        >
          {group.students.length > 0 ? (
            group.students.map((student) => (
              <View key={student.id}>
                {renderStudentItem({
                  item: student,
                  paletteOverride: groupPalette,
                  classNameOverride: group.className,
                  unitNameOverride: unitName,
                })}
              </View>
            ))
          ) : (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                backgroundColor: colors.backgroundSubtle,
                borderRadius: radius.internal,
                paddingVertical: 10,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                Nenhum aluno nesta turma.
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

type StudentsClassHeaderContentProps = {
  colors: ThemeColors;
  group: StudentListClassGroup;
  groupPalette: { bg: string; text: string };
};

function StudentsClassHeaderContent({
  colors,
  group,
  groupPalette,
}: StudentsClassHeaderContentProps) {
  const items: { key: string; node: ReactElement }[] = [
    {
      key: "name",
      node: (
        <Text
          style={{
            fontSize: 13,
            fontWeight: "800",
            color: colors.textPrimary,
          }}
          numberOfLines={1}
        >
          {group.className}
        </Text>
      ),
    },
  ];
  if (group.gender) {
    items.push({
      key: "gender",
      node: <ClassGenderBadge gender={group.gender} size="sm" />,
    });
  }
  if (group.scheduleLabel) {
    items.push({
      key: "schedule",
      node: (
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: colors.textMuted,
          }}
        >
          {group.scheduleLabel}
        </Text>
      ),
    });
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
        minWidth: 0,
        flex: 1,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: radius.full,
          backgroundColor: groupPalette.bg,
          marginRight: 2,
        }}
      />
      {items.map((entry, index) => (
        <View
          key={entry.key}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
          }}
        >
          {index > 0 ? (
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: radius.full,
                backgroundColor: colors.textMuted,
                opacity: 0.9,
                marginHorizontal: 2,
              }}
            />
          ) : null}
          {entry.node}
        </View>
      ))}
    </View>
  );
}
