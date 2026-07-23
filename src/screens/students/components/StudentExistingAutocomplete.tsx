import { useCallback, useMemo, useRef, useState, type RefObject } from "react";
import { Text, TextInput, View } from "react-native";

import type { ClassGroup, Student } from "../../../core/models";
import { normalizeStudentLookupName } from "../../../core/students/find-possible-existing-students";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../../ui/AnchoredDropdownOption";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";

const MAX_VISIBLE_STUDENTS = 6;
const MIN_QUERY_LENGTH = 2;

type Layout = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

export type ExistingStudentOption = {
  student: Student;
  className: string;
  unitName: string;
  isInCurrentClass: boolean;
};

type BuildExistingStudentOptionsParams = {
  students: Student[];
  classes: ClassGroup[];
  currentClassStudentIds: string[];
  query: string;
};

const getNameMatchRank = (name: string, query: string) => {
  if (name.startsWith(query)) return 0;
  if (name.split(" ").some((token) => token.startsWith(query))) return 1;
  return 2;
};

export function buildExistingStudentOptions({
  students,
  classes,
  currentClassStudentIds,
  query,
}: BuildExistingStudentOptionsParams): ExistingStudentOption[] {
  const normalizedQuery = normalizeStudentLookupName(query);
  if (normalizedQuery.length < MIN_QUERY_LENGTH) return [];

  const classesById = new Map(classes.map((item) => [item.id, item]));
  const currentIds = new Set(currentClassStudentIds);
  const seenIds = new Set<string>();

  return students
    .filter((student) => {
      if (seenIds.has(student.id)) return false;
      seenIds.add(student.id);
      return normalizeStudentLookupName(student.name).includes(normalizedQuery);
    })
    .sort((a, b) => {
      const rankDiff =
        getNameMatchRank(normalizeStudentLookupName(a.name), normalizedQuery) -
        getNameMatchRank(normalizeStudentLookupName(b.name), normalizedQuery);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    })
    .slice(0, MAX_VISIBLE_STUDENTS)
    .map((student) => {
      const studentClass = classesById.get(student.classId);
      return {
        student,
        className: studentClass?.name ?? "Outra turma",
        unitName: studentClass?.unit ?? "",
        isInCurrentClass: currentIds.has(student.id),
      };
    });
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""}`.toUpperCase();
}

type StudentExistingAutocompleteProps = {
  colors: ThemeColors;
  value: string;
  students: Student[];
  classes: ClassGroup[];
  currentClassStudentIds: string[];
  selectedStudentId?: string | null;
  inputRef?: RefObject<TextInput | null>;
  invalid?: boolean;
  onChangeText: (value: string) => void;
  onSelect: (option: ExistingStudentOption) => void;
};

export function StudentExistingAutocomplete({
  colors,
  value,
  students,
  classes,
  currentClassStudentIds,
  selectedStudentId,
  inputRef,
  invalid = false,
  onChangeText,
  onSelect,
}: StudentExistingAutocompleteProps) {
  const containerRef = useRef<View | null>(null);
  const triggerRef = useRef<View | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [triggerLayout, setTriggerLayout] = useState<Layout | null>(null);
  const [containerPoint, setContainerPoint] = useState<Point | null>(null);
  const options = useMemo(
    () =>
      buildExistingStudentOptions({
        students,
        classes,
        currentClassStudentIds,
        query: value,
      }),
    [classes, currentClassStudentIds, students, value]
  );
  const dropdownVisible = showSuggestions && options.length > 0;

  const measureDropdown = useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setTriggerLayout({ x, y, width, height });
    });
    containerRef.current?.measureInWindow((x, y) => {
      setContainerPoint({ x, y });
    });
  }, []);

  const openSuggestions = useCallback(() => {
    measureDropdown();
    setShowSuggestions(true);
  }, [measureDropdown]);

  const handleSelect = useCallback(
    (option: ExistingStudentOption) => {
      if (option.isInCurrentClass) return;
      onChangeText(option.student.name);
      onSelect(option);
      setShowSuggestions(false);
    },
    [onChangeText, onSelect]
  );

  return (
    <View ref={containerRef} collapsable={false} style={{ position: "relative", zIndex: dropdownVisible ? 5200 : 1 }}>
      <View ref={triggerRef} collapsable={false} style={{ position: "relative" }}>
        <TextInput
          ref={inputRef}
          accessibilityLabel="Nome do aluno"
          autoCapitalize="words"
          autoCorrect={false}
          value={value}
          onFocus={openSuggestions}
          onChangeText={(nextValue) => {
            onChangeText(nextValue);
            requestAnimationFrame(measureDropdown);
            setShowSuggestions(true);
          }}
          placeholder="Nome do aluno"
          placeholderTextColor={colors.placeholder}
          style={{
            borderWidth: invalid ? 2 : 1,
            borderColor: invalid
              ? colors.dangerSolidBg
              : dropdownVisible
                ? colors.primaryBg
                : colors.border,
            borderRadius: 12,
            backgroundColor: colors.inputBg,
            color: colors.inputText,
            paddingLeft: 12,
            paddingRight: 38,
            paddingVertical: 10,
            fontSize: 13,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: 12,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <GoAtletaIcon name="search" size={15} color={colors.muted} />
        </View>
      </View>

      <AnchoredDropdown
        visible={dropdownVisible}
        layout={triggerLayout}
        container={containerPoint}
        animationStyle={{ opacity: 1 }}
        zIndex={5201}
        maxHeight={252}
        nestedScrollEnabled
        onRequestClose={() => setShowSuggestions(false)}
        interactiveRefs={[triggerRef]}
      >
        {options.map((option) => {
          const selected = selectedStudentId === option.student.id;
          const context = option.isInCurrentClass
            ? "Já está nesta turma"
            : [option.className, option.unitName].filter(Boolean).join(" • ");

          return (
            <AnchoredDropdownOption
              key={option.student.id}
              active={selected}
              disabled={option.isInCurrentClass}
              onPress={() => handleSelect(option)}
              style={{ marginVertical: 0, paddingVertical: 9, paddingHorizontal: 10 }}
              rightAccessory={
                option.isInCurrentClass ? (
                  <GoAtletaIcon name="checkmark" size={16} color={colors.success} />
                ) : (
                  <GoAtletaIcon name="add" size={16} color={colors.muted} />
                )
              }
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: selected ? colors.primaryBg : colors.secondaryBg,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.primaryText : colors.text,
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    {getInitials(option.student.name)}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{ color: selected ? colors.primaryText : colors.text, fontSize: 13, fontWeight: "700" }}
                  >
                    {option.student.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ color: selected ? colors.primaryText : colors.muted, fontSize: 11, marginTop: 2 }}
                  >
                    {context}
                  </Text>
                </View>
              </View>
            </AnchoredDropdownOption>
          );
        })}
      </AnchoredDropdown>
    </View>
  );
}
