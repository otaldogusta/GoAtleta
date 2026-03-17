import { Ionicons } from "@expo/vector-icons";
import type { ReactElement } from "react";
import { Text, TextInput, View } from "react-native";
import type { ClassGender } from "../../core/models";
import type { Student } from "../../core/models";
import { useAppTheme } from "../../ui/app-theme";
import { ClassGenderBadge } from "../../ui/ClassGenderBadge";
import { Pressable } from "../../ui/Pressable";
import { UnitFilterBar } from "../../ui/UnitFilterBar";

type ClassGroup = {
  classId: string;
  className: string;
  gender: ClassGender;
  scheduleLabel: string;
  palette: { bg: string; text: string } | null;
  students: Student[];
};

type UnitGroup = {
  unitName: string;
  classes: ClassGroup[];
};

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
  studentsGrouped: UnitGroup[];
  expandedUnits: Record<string, boolean>;
  expandedClasses: Record<string, boolean>;
  toggleUnitExpanded: (unitName: string) => void;
  toggleClassExpanded: (classId: string) => void;
  renderStudentItem: (args: RenderStudentItemArgs) => ReactElement | null;
};

export function StudentsListTab({
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
  const { colors } = useAppTheme();

  return (
    <View style={{ gap: 12 }}>
      <UnitFilterBar
        units={studentsUnitOptions}
        selectedUnit={studentsUnitFilter}
        onSelectUnit={setStudentsUnitFilter}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 14,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          placeholder="Buscar aluno, responsável, turma ou unidade"
          value={studentsSearch}
          onChangeText={setStudentsSearch}
          placeholderTextColor={colors.placeholder}
          style={{ flex: 1, color: colors.inputText, fontSize: 13 }}
        />
        {studentsSearch ? (
          <Pressable
            onPress={() => setStudentsSearch("")}
            onContextMenu={(event: any) => event.preventDefault()}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: colors.secondaryBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={14} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Alunos
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {studentsFiltered.length} resultado(s)
          </Text>
        </View>

        { studentsGrouped.length > 0 ? (
          <View style={{ gap: 12 }}>
            {studentsGrouped.map(({ unitName, classes: unitClasses }) => (
              <View key={unitName} style={{ gap: 8 }}>
                {(() => {
                  const unitExpanded = !!expandedUnits[unitName];
                  return (
                    <>
                      <Pressable
                        onPress={() => toggleUnitExpanded(unitName)}
                        style={{
                          paddingVertical: 7,
                          paddingHorizontal: 10,
                          borderRadius: 12,
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text
                          style={{ fontSize: 14, fontWeight: "800", color: colors.text }}
                        >
                          {unitName}
                        </Text>
                        <Ionicons
                          name={unitExpanded ? "chevron-down" : "chevron-forward"}
                          size={16}
                          color={colors.muted}
                        />
                      </Pressable>
                      { unitExpanded ? (
                        <View
                          style={{
                            gap: 10,
                            marginLeft: 4,
                            paddingLeft: 10,
                            paddingTop: 6,
                            borderLeftWidth: 2,
                            borderLeftColor: colors.border,
                          }}
                        >
                          {unitClasses.map((group) => {
                            const classExpanded = !!expandedClasses[group.classId];
                            const groupPalette =
                              group.palette ?? {
                                bg: colors.primaryBg,
                                text: colors.primaryText,
                              };
                            return (
                              <View key={group.classId} style={{ gap: 6 }}>
                                <Pressable
                                  onPress={() => toggleClassExpanded(group.classId)}
                                  style={{
                                    paddingVertical: 6,
                                    paddingHorizontal: 8,
                                    borderRadius: 10,
                                    backgroundColor: colors.background,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                  }}
                                >
                                  {(() => {
                                    const items: { key: string; node: ReactElement }[] = [
                                      {
                                        key: "name",
                                        node: (
                                          <Text
                                            style={{
                                              fontSize: 13,
                                              fontWeight: "800",
                                              color: colors.text,
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
                                              color: colors.muted,
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
                                            borderRadius: 999,
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
                                                  borderRadius: 999,
                                                  backgroundColor: colors.muted,
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
                                  })()}
                                  <Ionicons
                                    name={classExpanded ? "chevron-down" : "chevron-forward"}
                                    size={16}
                                    color={colors.muted}
                                  />
                                </Pressable>
                                { classExpanded ? (
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
                                          borderColor: colors.border,
                                          backgroundColor: colors.secondaryBg,
                                          borderRadius: 10,
                                          paddingVertical: 10,
                                          paddingHorizontal: 12,
                                        }}
                                      >
                                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                                          Nenhum aluno nesta turma.
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      ) : null}
                    </>
                  );
                })()}
              </View>
            ))}
          </View>
        ) : (
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Nenhum aluno encontrado
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {studentsUnitFilter === "Todas"
                 ? "Comece adicionando alunos"
                : "Nenhum aluno nesta unidade"}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
