import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import type { ClassGroup, Student } from "../../core/models";
import {
  countStudentFilterExclusions,
  createEmptyStudentFilterExclusions,
  matchesStudentFilterExclusions,
  matchesStudentMembershipScope,
  toggleStudentFilterExclusion,
  type StudentContactFilter,
  type StudentFilterExclusions,
  type StudentProfileFilter,
  type StudentMembershipScope,
} from "./application/student-list-filters";
import { STUDENT_FINANCIAL_STATUS_OPTIONS } from "./application/student-operational-status";
import { resolveStudentListPrimaryStatus } from "./application/student-list-status";
import { radius } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import { useCollapsibleAnimation } from "../../ui/use-collapsible";
import { useContainerResponsiveLayout } from "../../ui/use-container-responsive-layout";
import type { StudentListUnitGroup } from "./application/student-list-selectors";
import {
  resolveStudentsFilterModalHeight,
  resolveStudentsListLayout,
} from "./application/students-list-layout";
import { BirthdayAvatar } from "./components/BirthdayAvatar";
import { StudentsEmptyState } from "./components/StudentsEmptyState";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";

type RenderStudentItemArgs = {
  item: Student;
  paletteOverride: { bg: string; text: string };
  classNameOverride: string;
  unitNameOverride: string;
};

type FilterOption<T extends string> = {
  value: T;
  label: string;
};

type DropdownLayout = { x: number; y: number; width: number; height: number };

export type StudentsListTabProps = {
  studentsUnitOptions: string[];
  studentsUnitFilter: string;
  setStudentsUnitFilter: (unit: string) => void;
  studentsSearch: string;
  setStudentsSearch: (search: string) => void;
  students: Student[];
  studentsFiltered: Student[];
  studentsGrouped: StudentListUnitGroup[];
  classById: Map<string, ClassGroup>;
  unitLabel: (value: string) => string;
  expandedUnits: Record<string, boolean>;
  expandedClasses: Record<string, boolean>;
  toggleUnitExpanded: (unitName: string) => void;
  toggleClassExpanded: (classId: string) => void;
  renderStudentItem: (args: RenderStudentItemArgs) => ReactElement | null;
  onStudentPress?: (student: Student) => void;
  onPhotoPress?: (student: Student) => void;
  resolveStudentPhotoUrl?: (student: Student) => string | null;
  onStudentWhatsApp?: (student: Student) => void;
  birthdayStudentIds?: ReadonlySet<string>;
  loading?: boolean;
  canViewFinancialStatus?: boolean;
};

const PAGE_SIZE = 8;

function StudentFilterToggle({
  label,
  selected,
  onPress,
  compact = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={(state) => ({
        width: compact ? "48%" : undefined,
        minWidth: 0,
        minHeight: compact ? 34 : 40,
        paddingHorizontal: compact ? 2 : 12,
        borderWidth: compact ? 0 : StyleSheet.hairlineWidth,
        borderColor: selected ? colors.primaryBg : colors.borderSubtle ?? colors.border,
        borderRadius: compact ? 8 : radius.internal,
        backgroundColor: compact
          ? state.hovered
            ? colors.backgroundSubtle ?? colors.secondaryBg
            : "transparent"
          : selected || state.hovered
            ? colors.backgroundSubtle ?? colors.secondaryBg
            : colors.background,
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 6 : 8,
      })}
    >
      <GoAtletaIcon
        name={selected ? "checkbox" : "square"}
        size={17}
        color={selected ? colors.primaryBg : colors.textMuted ?? colors.muted}
      />
      <Text
        numberOfLines={1}
        style={{
          color: selected ? colors.textPrimary ?? colors.text : colors.textMuted ?? colors.muted,
          fontSize: 12,
          fontWeight: "700",
          minWidth: 0,
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StudentFilterGroup({
  title,
  options,
  excludedValues,
  onToggle,
  compact = false,
}: {
  title: string;
  options: FilterOption<string>[];
  excludedValues: string[];
  onToggle: (value: string) => void;
  compact?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          color: colors.textPrimary ?? colors.text,
          fontSize: 13,
          fontWeight: "900",
        }}
      >
        {title}
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {options.map((option) => (
          <StudentFilterToggle
            key={option.value}
            label={option.label}
            selected={!excludedValues.includes(option.value)}
            onPress={() => onToggle(option.value)}
            compact={compact}
          />
        ))}
      </View>
    </View>
  );
}

const profileFilterOptions: FilterOption<StudentProfileFilter>[] = [
  { value: "regular", label: "Regular" },
  { value: "experimental", label: "Experimental" },
];

const financialFilterOptions: FilterOption<Student["financialStatus"]>[] = [
  ...STUDENT_FINANCIAL_STATUS_OPTIONS,
];

const genderFilterOptions: FilterOption<ClassGroup["gender"]>[] = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "misto", label: "Misto" },
];

const contactFilterOptions: FilterOption<StudentContactFilter>[] = [
  { value: "with", label: "Com contato" },
  { value: "without", label: "Sem contato" },
];

export const StudentsListTab = memo(function StudentsListTab({
  studentsUnitOptions,
  studentsUnitFilter,
  setStudentsUnitFilter,
  studentsSearch,
  setStudentsSearch,
  students,
  studentsFiltered,
  studentsGrouped,
  classById,
  unitLabel,
  onStudentPress,
  onPhotoPress,
  resolveStudentPhotoUrl,
  onStudentWhatsApp,
  birthdayStudentIds,
  loading = false,
  canViewFinancialStatus = false,
}: StudentsListTabProps) {
  const { colors } = useAppTheme();
  const { height: viewportHeight } = useWindowDimensions();
  const { containerRef, onLayout, width } =
    useContainerResponsiveLayout("dashboard");
  const { showTable } = resolveStudentsListLayout(width);
  const compactFilters = !showTable;
  const filtersModalHeight = resolveStudentsFilterModalHeight(
    viewportHeight,
    compactFilters,
  );
  const unitTriggerRef = useRef<View | null>(null);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [unitDropdownLayout, setUnitDropdownLayout] =
    useState<DropdownLayout | null>(null);
  const { animatedStyle: unitDropdownAnimationStyle, isVisible: unitDropdownVisible } =
    useCollapsibleAnimation(unitDropdownOpen, {
      durationIn: 180,
      durationOut: 140,
      translateY: -4,
    });
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [appliedFilterExclusions, setAppliedFilterExclusions] =
    useState<StudentFilterExclusions>(createEmptyStudentFilterExclusions);
  const [draftFilterExclusions, setDraftFilterExclusions] =
    useState<StudentFilterExclusions>(createEmptyStudentFilterExclusions);
  const [page, setPage] = useState(1);
  const [membershipScope, setMembershipScope] =
    useState<StudentMembershipScope>("active");
  const hasSearch = studentsSearch.trim().length > 0;

  const classScheduleById = useMemo(() => {
    const schedules = new Map<string, string>();
    studentsGrouped.forEach((unitGroup) => {
      unitGroup.classes.forEach((classGroup) => {
        schedules.set(classGroup.classId, classGroup.scheduleLabel);
      });
    });
    return schedules;
  }, [studentsGrouped]);

  const unitCounts = useMemo(() => {
    const counts: Record<string, number> = { Todas: students.length };
    studentsUnitOptions.forEach((unit) => {
      if (unit !== "Todas") counts[unit] = 0;
    });
    students.forEach((student) => {
      const cls = classById.get(student.classId);
      const unit = unitLabel(cls?.unit ?? "");
      counts[unit] = (counts[unit] ?? 0) + 1;
    });
    return counts;
  }, [classById, students, studentsUnitOptions, unitLabel]);

  const sortedUnits = useMemo(() => {
    const namedUnits = studentsUnitOptions
      .filter((unit) => unit !== "Todas")
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    return studentsUnitOptions.includes("Todas")
      ? ["Todas", ...namedUnits]
      : namedUnits;
  }, [studentsUnitOptions]);

  const classOptions = useMemo<FilterOption<string>[]>(() => {
    const ids = new Set(studentsFiltered.map((student) => student.classId));
    return Array.from(ids)
      .map((id) => classById.get(id))
      .filter((value): value is ClassGroup => Boolean(value))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((cls) => ({ value: cls.id, label: cls.name }));
  }, [classById, studentsFiltered]);

  const membershipCounts = useMemo(
    () => ({
      active: studentsFiltered.filter(
        (student) => student.membershipStatus === "active",
      ).length,
      inactive: studentsFiltered.filter(
        (student) => student.membershipStatus === "inactive",
      ).length,
      all: studentsFiltered.length,
    }),
    [studentsFiltered],
  );

  const effectiveFilterExclusions = useMemo(
    () =>
      canViewFinancialStatus
        ? appliedFilterExclusions
        : { ...appliedFilterExclusions, financials: [] },
    [appliedFilterExclusions, canViewFinancialStatus],
  );
  const activeFilterCount = useMemo(
    () => countStudentFilterExclusions(effectiveFilterExclusions),
    [effectiveFilterExclusions],
  );

  const openFiltersModal = () => {
    setDraftFilterExclusions({
      profiles: [...appliedFilterExclusions.profiles],
      memberships: [...appliedFilterExclusions.memberships],
      financials: canViewFinancialStatus
        ? [...appliedFilterExclusions.financials]
        : [],
      genders: [...appliedFilterExclusions.genders],
      classes: [...appliedFilterExclusions.classes],
      contacts: [...appliedFilterExclusions.contacts],
    });
    setFiltersModalOpen(true);
  };

  const toggleDraftFilter = (
    key: keyof StudentFilterExclusions,
    value: string,
  ) => {
    setDraftFilterExclusions((current) => ({
      ...current,
      [key]: toggleStudentFilterExclusion(current[key] as string[], value),
    }));
  };

  const filteredRows = useMemo(
    () =>
      studentsFiltered.filter(
        (student) =>
          matchesStudentMembershipScope(student, membershipScope) &&
          matchesStudentFilterExclusions({
            student,
            classGroup: classById.get(student.classId),
            exclusions: effectiveFilterExclusions,
          }),
      ),
    [
      classById,
      effectiveFilterExclusions,
      membershipScope,
      studentsFiltered,
    ],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setPage(1);
    });
    return () => {
      active = false;
    };
  }, [
    appliedFilterExclusions,
    membershipScope,
    studentsSearch,
    studentsUnitFilter,
  ]);

  useEffect(() => {
    const availableClassIds = new Set(classOptions.map((option) => option.value));
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setAppliedFilterExclusions((current) => ({
        ...current,
        classes: current.classes.filter((classId) => availableClassIds.has(classId)),
      }));
    });
    return () => {
      active = false;
    };
  }, [classOptions]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const firstResult =
    filteredRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastResult = Math.min(currentPage * PAGE_SIZE, filteredRows.length);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    const candidates = new Set([
      1,
      totalPages,
      currentPage - 1,
      currentPage,
      currentPage + 1,
    ]);
    return Array.from(candidates)
      .filter((value) => value >= 1 && value <= totalPages)
      .sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  const selectUnit = (unit: string) => {
    setStudentsUnitFilter(unit);
    setUnitDropdownOpen(false);
  };

  const toggleUnitDropdown = () => {
    if (unitDropdownOpen) {
      setUnitDropdownOpen(false);
      return;
    }
    unitTriggerRef.current?.measureInWindow((x, y, measuredWidth, height) => {
      setUnitDropdownLayout({ x, y, width: measuredWidth, height });
      setUnitDropdownOpen(true);
    });
  };

  return (
    <View
      ref={containerRef}
      onLayout={onLayout}
      style={{
        flex: showTable ? 1 : undefined,
        flexDirection: "row",
        minHeight: showTable ? 0 : 540,
        overflow: showTable ? "hidden" : "visible",
        backgroundColor: colors.background,
        position: "relative",
      }}
    >
      <View
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: showTable ? "hidden" : "visible",
          backgroundColor: colors.background,
        }}
      >
        <View
          style={{
            gap: 8,
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.borderSubtle ?? colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              ref={unitTriggerRef}
              collapsable={false}
              style={{
                width: width < 520 ? "46%" : 264,
                minWidth: width < 520 ? 180 : 220,
                maxWidth: width < 520 ? 240 : 264,
                flexShrink: 0,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Selecionar unidade. Atual: ${
                  studentsUnitFilter === "Todas" ? "Todas as unidades" : studentsUnitFilter
                }`}
                accessibilityState={{ expanded: unitDropdownOpen }}
                onPress={toggleUnitDropdown}
                style={(state) => ({
                  width: "100%",
                  height: 42,
                  paddingHorizontal: 12,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: unitDropdownOpen
                    ? colors.primaryBg
                    : (colors.borderSubtle ?? colors.border),
                  borderRadius: radius.internal,
                  backgroundColor:
                    state.hovered || unitDropdownOpen
                      ? colors.secondaryBg
                      : (colors.backgroundSubtle ?? colors.secondaryBg),
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                })}
              >
                <GoAtletaIcon name="organization" size={16} color={colors.primaryBg} />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    color: colors.textPrimary ?? colors.text,
                    fontSize: 13,
                    fontWeight: "800",
                  }}
                >
                  {studentsUnitFilter === "Todas"
                    ? "Todas as unidades"
                    : studentsUnitFilter}
                </Text>
                <Text
                  style={{
                    color: colors.textMuted ?? colors.muted,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {unitCounts[studentsUnitFilter] ?? 0}
                </Text>
                <GoAtletaIcon
                  name={unitDropdownOpen ? "chevronUp" : "chevronDown"}
                  size={14}
                  color={colors.textMuted ?? colors.muted}
                />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mais filtros"
              accessibilityState={{ expanded: filtersModalOpen }}
              onPress={openFiltersModal}
              style={{
                minWidth: 42,
                width: compactFilters ? 42 : undefined,
                height: 42,
                paddingHorizontal: compactFilters ? 0 : 12,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: filtersModalOpen || activeFilterCount > 0
                  ? colors.primaryBg
                  : (colors.borderSubtle ?? colors.border),
                borderRadius: radius.internal,
                backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
              }}
            >
              <GoAtletaIcon
                name="options"
                size={14}
                color={colors.textMuted ?? colors.muted}
              />
              {showTable ? (
                <Text
                  style={{
                    color: colors.textPrimary ?? colors.text,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  Mais filtros
                </Text>
              ) : null}
              {activeFilterCount > 0 ? (
                <View
                  style={{
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 5,
                    borderRadius: 9,
                    backgroundColor: colors.primaryBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: colors.primaryText,
                      fontSize: 9,
                      fontWeight: "900",
                    }}
                  >
                    {activeFilterCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <View
              style={{
                flex: 1,
                minWidth: 0,
                height: 42,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.borderSubtle ?? colors.border,
                borderRadius: radius.internal,
                backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg,
                paddingHorizontal: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
              }}
            >
              <GoAtletaIcon
                name="search"
                size={15}
                color={colors.textMuted ?? colors.muted}
              />
              <TextInput
                value={studentsSearch}
                onChangeText={setStudentsSearch}
                placeholder={
                  width < 520
                    ? "Buscar aluno"
                    : "Buscar aluno, responsável, turma ou unidade"
                }
                placeholderTextColor={colors.placeholder}
                accessibilityLabel="Buscar aluno, responsável, turma ou unidade"
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: colors.textPrimary ?? colors.text,
                  fontSize: 12,
                }}
              />
            </View>
          </View>

          <View
            accessibilityRole="tablist"
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
            }}
          >
            {(
              [
                { value: "active", label: "Ativos" },
                { value: "inactive", label: "Inativos" },
                { value: "all", label: "Todos" },
              ] as const
            ).map((option) => {
              const active = membershipScope === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setMembershipScope(option.value)}
                  style={(state) => ({
                    minHeight: 44,
                    paddingHorizontal: 12,
                    borderRadius: radius.internal,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: active
                      ? colors.primaryBg
                      : (colors.borderSubtle ?? colors.border),
                    backgroundColor:
                      active || state.hovered
                        ? colors.secondaryBg
                        : colors.background,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  })}
                >
                  <Text
                    style={{
                      color: active
                        ? colors.primaryBg
                        : (colors.textMuted ?? colors.muted),
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={{
                      color: colors.textMuted ?? colors.muted,
                      fontSize: 10,
                      fontWeight: "700",
                    }}
                  >
                    {membershipCounts[option.value]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

        </View>

        {loading && students.length === 0 ? (
          <View style={{ paddingVertical: 28, alignItems: "center", gap: 6 }}>
            <Text
              style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}
            >
              Carregando alunos…
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              A tela continua disponível enquanto os dados chegam.
            </Text>
          </View>
        ) : filteredRows.length > 0 ? (
          <>
            <View
              style={{
                flex: showTable ? 1 : undefined,
                minHeight: showTable ? 0 : undefined,
                overflow: "hidden",
                backgroundColor: colors.background,
              }}
            >
              {showTable ? (
                <View
                  style={{
                    height: 42,
                    backgroundColor: colors.background,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.borderSubtle ?? colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      flex: 2.2,
                      minWidth: 210,
                      paddingHorizontal: 10,
                      color: colors.textMuted ?? colors.muted,
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    ALUNO
                  </Text>
                  <Text
                    style={{
                      flex: 0.7,
                      minWidth: 76,
                      paddingHorizontal: 10,
                      color: colors.textMuted ?? colors.muted,
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    IDADE
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      minWidth: 100,
                      paddingHorizontal: 10,
                      color: colors.textMuted ?? colors.muted,
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    TURMA
                  </Text>
                  <Text
                    style={{
                      flex: 0.8,
                      minWidth: 86,
                      paddingHorizontal: 10,
                      color: colors.textMuted ?? colors.muted,
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    STATUS
                  </Text>
                  <Text
                    style={{
                      flex: 1.5,
                      minWidth: 170,
                      paddingHorizontal: 10,
                      color: colors.textMuted ?? colors.muted,
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    RESPONSÁVEL / CONTATO
                  </Text>
                  <View style={{ width: 42 }} />
                </View>
              ) : null}
              <ScrollView
                style={showTable ? { flex: 1, minHeight: 0 } : undefined}
                contentContainerStyle={
                  showTable ? { flexGrow: 1 } : { flexGrow: 0 }
                }
                scrollEnabled={showTable}
                nestedScrollEnabled
                showsVerticalScrollIndicator={showTable}
                keyboardShouldPersistTaps="handled"
              >
                {pageRows.map((student) => {
                  const cls = classById.get(student.classId);
                  const scheduleLabel = classScheduleById.get(student.classId) ?? "";
                  const primaryStatus = resolveStudentListPrimaryStatus(student);
                  return (
                    <Pressable
                      key={student.id}
                      onPress={() => onStudentPress?.(student)}
                      style={(state) => ({
                        minHeight: showTable ? 88 : 64,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.borderSubtle ?? colors.border,
                        backgroundColor: state.hovered
                          ? (colors.backgroundSubtle ?? colors.secondaryBg)
                          : "transparent",
                        flexDirection: "row",
                        alignItems: "center",
                      })}
                    >
                      <View
                        style={{
                          flex: showTable ? 2.2 : 1,
                          minWidth: showTable ? 210 : 0,
                          paddingHorizontal: 10,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Ver foto de ${student.name}`}
                          onPress={(event) => {
                            event.stopPropagation();
                            onPhotoPress?.(student);
                          }}
                          style={(state) => ({
                            borderRadius: 19,
                            opacity: state.pressed ? 0.72 : 1,
                          })}
                        >
                          <BirthdayAvatar
                            colors={colors}
                            photoUrl={resolveStudentPhotoUrl?.(student) ?? undefined}
                            isBirthdayToday={birthdayStudentIds?.has(student.id)}
                            size={38}
                          />
                        </Pressable>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: colors.text,
                              fontSize: 13,
                              fontWeight: "900",
                            }}
                          >
                            {student.name}
                          </Text>
                          {!showTable ? (
                            <Text
                              numberOfLines={1}
                              style={{ color: colors.muted, fontSize: 10 }}
                            >
                              {cls?.name ?? "Turma"} · {student.age || "—"} anos
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {showTable ? (
                        <>
                          <Text
                            style={{
                              flex: 0.7,
                              minWidth: 76,
                              paddingHorizontal: 10,
                              color: colors.textMuted ?? colors.muted,
                              fontSize: 11,
                            }}
                          >
                            {student.age || "—"} anos
                          </Text>
                          <View
                            style={{
                              flex: 1,
                              minWidth: 100,
                              paddingHorizontal: 10,
                            }}
                          >
                            <Text
                              numberOfLines={1}
                              style={{
                                color: colors.textPrimary ?? colors.text,
                                fontSize: 11,
                                fontWeight: "700",
                              }}
                            >
                              {cls?.name ?? "Turma"}
                            </Text>
                            {scheduleLabel ? (
                              <Text
                                numberOfLines={1}
                                style={{
                                  color: colors.textMuted ?? colors.muted,
                                  marginTop: 2,
                                  fontSize: 10,
                                }}
                              >
                                {scheduleLabel}
                              </Text>
                            ) : null}
                          </View>
                          <View
                            style={{
                              flex: 0.8,
                              minWidth: 86,
                              paddingHorizontal: 10,
                            }}
                          >
                            <View
                              style={{
                                alignSelf: "flex-start",
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor:
                                  primaryStatus === "inactive"
                                    ? colors.border
                                    : primaryStatus === "experimental"
                                      ? colors.warningBg
                                      : colors.successBg,
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                              }}
                            >
                              <Text
                                style={{
                                  color:
                                    primaryStatus === "inactive"
                                      ? (colors.textMuted ?? colors.muted)
                                      : primaryStatus === "experimental"
                                        ? colors.warningText
                                        : colors.successText,
                                  fontSize: 10,
                                  fontWeight: "800",
                                }}
                              >
                                {primaryStatus === "inactive"
                                  ? "Inativo"
                                  : primaryStatus === "experimental"
                                    ? "Experimental"
                                    : "Ativo"}
                              </Text>
                            </View>
                          </View>
                          <View
                            style={{
                              flex: 1.5,
                              minWidth: 170,
                              paddingHorizontal: 10,
                            }}
                          >
                            <Text
                              numberOfLines={1}
                              style={{
                                color: colors.textPrimary ?? colors.text,
                                fontSize: 11,
                              }}
                            >
                              {student.guardianName ||
                                "Responsável não informado"}
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={{
                                color: colors.textMuted ?? colors.muted,
                                fontSize: 10,
                              }}
                            >
                              {student.guardianPhone ||
                                student.phone ||
                                "Sem contato"}
                            </Text>
                          </View>
                        </>
                      ) : null}
                      <Pressable
                        onPress={() => onStudentWhatsApp?.(student)}
                        style={{
                          width: 42,
                          height: 42,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <GoAtletaIcon
                          name="whatsapp"
                          size={16}
                          color={colors.primaryBg}
                        />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View
              style={{
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {firstResult}–{lastResult} de {filteredRows.length}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Pressable
                  disabled={currentPage === 1}
                  onPress={() => setPage((current) => Math.max(1, current - 1))}
                  style={{
                    width: 32,
                    height: 32,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: currentPage === 1 ? 0.35 : 1,
                  }}
                >
                  <GoAtletaIcon
                    name="chevronBack"
                    size={14}
                    color={colors.muted}
                  />
                </Pressable>
                {pageNumbers.map((pageNumber, index) => {
                  const previous = pageNumbers[index - 1];
                  const showEllipsis =
                    previous !== undefined && pageNumber - previous > 1;
                  return (
                    <View
                      key={pageNumber}
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      {showEllipsis ? (
                        <Text
                          style={{
                            color: colors.muted,
                            fontSize: 11,
                            paddingHorizontal: 4,
                          }}
                        >
                          …
                        </Text>
                      ) : null}
                      <Pressable
                        onPress={() => setPage(pageNumber)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 9,
                          borderWidth: currentPage === pageNumber ? 1 : 0,
                          borderColor: colors.border,
                          backgroundColor:
                            currentPage === pageNumber
                              ? colors.backgroundSubtle
                              : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color:
                              currentPage === pageNumber
                                ? colors.text
                                : colors.muted,
                            fontSize: 11,
                            fontWeight:
                              currentPage === pageNumber ? "800" : "600",
                          }}
                        >
                          {pageNumber}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
                <Pressable
                  disabled={currentPage === totalPages}
                  onPress={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  style={{
                    width: 32,
                    height: 32,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: currentPage === totalPages ? 0.35 : 1,
                  }}
                >
                  <GoAtletaIcon
                    name="chevronForward"
                    size={14}
                    color={colors.muted}
                  />
                </Pressable>
              </View>
            </View>
          </>
        ) : (
          <StudentsEmptyState
            unitFilter={studentsUnitFilter}
            hasSearch={hasSearch}
          />
        )}
      </View>

      <ModalSheet
        visible={filtersModalOpen}
        onClose={() => setFiltersModalOpen(false)}
        position={compactFilters ? "bottom" : "center"}
        backdropOpacity={0.62}
        overlayZIndex={13000}
        cardStyle={{
          width: "100%",
          maxWidth: 660,
          height: filtersModalHeight,
          maxHeight: filtersModalHeight,
          padding: 0,
          paddingBottom: 0,
          gap: 0,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderSubtle ?? colors.border,
          borderRadius: 22,
          backgroundColor: colors.background,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            minHeight: compactFilters ? 54 : 60,
            paddingLeft: compactFilters ? 14 : 18,
            paddingRight: 10,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.borderSubtle ?? colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Text
            style={{
              color: colors.textPrimary ?? colors.text,
              fontSize: compactFilters ? 16 : 17,
              fontWeight: "900",
            }}
          >
            Filtrar alunos
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar filtros"
            onPress={() => setFiltersModalOpen(false)}
            style={(state) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: state.hovered
                ? colors.backgroundSubtle ?? colors.secondaryBg
                : "transparent",
            })}
          >
            <GoAtletaIcon name="close" size={18} color={colors.textMuted ?? colors.muted} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{
            padding: compactFilters ? 14 : 18,
            gap: compactFilters ? 16 : 20,
          }}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {canViewFinancialStatus ? (
            <StudentFilterGroup
              title="Financeiro"
              options={financialFilterOptions}
              excludedValues={draftFilterExclusions.financials}
              onToggle={(value) => toggleDraftFilter("financials", value)}
              compact={compactFilters}
            />
          ) : null}
          <StudentFilterGroup
            title="Perfil"
            options={profileFilterOptions}
            excludedValues={draftFilterExclusions.profiles}
            onToggle={(value) => toggleDraftFilter("profiles", value)}
            compact={compactFilters}
          />
          <StudentFilterGroup
            title="Gênero da turma"
            options={genderFilterOptions}
            excludedValues={draftFilterExclusions.genders}
            onToggle={(value) => toggleDraftFilter("genders", value)}
            compact={compactFilters}
          />
          <StudentFilterGroup
            title="Contato"
            options={contactFilterOptions}
            excludedValues={draftFilterExclusions.contacts}
            onToggle={(value) => toggleDraftFilter("contacts", value)}
            compact={compactFilters}
          />
          {classOptions.length > 0 ? (
            <StudentFilterGroup
              title="Turmas"
              options={classOptions}
              excludedValues={draftFilterExclusions.classes}
              onToggle={(value) => toggleDraftFilter("classes", value)}
              compact={compactFilters}
            />
          ) : null}
        </ScrollView>

        <View
          style={{
            minHeight: compactFilters ? 64 : 68,
            paddingHorizontal: compactFilters ? 14 : 18,
            paddingVertical: compactFilters ? 10 : 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.borderSubtle ?? colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restaurar todos os filtros"
            onPress={() =>
              setDraftFilterExclusions(createEmptyStudentFilterExclusions())
            }
            suppressWebHoverFeedback
            style={{ minHeight: 42, justifyContent: "center", paddingHorizontal: 4 }}
          >
            <Text
              style={{
                color: colors.textMuted ?? colors.muted,
                fontSize: 12,
                fontWeight: "800",
              }}
            >
              Restaurar tudo
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Aplicar filtros"
            onPress={() => {
              setAppliedFilterExclusions({
                profiles: [...draftFilterExclusions.profiles],
                memberships: [...draftFilterExclusions.memberships],
                financials: canViewFinancialStatus
                  ? [...draftFilterExclusions.financials]
                  : [],
                genders: [...draftFilterExclusions.genders],
                classes: [...draftFilterExclusions.classes],
                contacts: [...draftFilterExclusions.contacts],
              });
              setFiltersModalOpen(false);
            }}
            style={(state) => ({
              minWidth: compactFilters ? 138 : 150,
              minHeight: 44,
              paddingHorizontal: compactFilters ? 14 : 18,
              borderRadius: radius.internal,
              backgroundColor: colors.primaryBg,
              alignItems: "center",
              justifyContent: "center",
              opacity: state.pressed ? 0.82 : 1,
            })}
          >
            <Text
              style={{
                color: colors.primaryText,
                fontSize: 13,
                fontWeight: "900",
              }}
            >
              Aplicar filtros
            </Text>
          </Pressable>
        </View>
      </ModalSheet>

      <AnchoredDropdown
        visible={unitDropdownVisible}
        layout={unitDropdownLayout}
        container={null}
        animationStyle={unitDropdownAnimationStyle}
        zIndex={12500}
        maxHeight={Math.min(220, sortedUnits.length * 42 + 12)}
        nestedScrollEnabled
        onRequestClose={() => setUnitDropdownOpen(false)}
        interactiveRefs={[unitTriggerRef]}
        density="compact"
        showVerticalScrollIndicator={sortedUnits.length > 4}
      >
        {sortedUnits.map((unit) => {
          const active = studentsUnitFilter === unit;
          return (
            <AnchoredDropdownOption
              key={unit}
              active={active}
              density="compact"
              onPress={() => selectUnit(unit)}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <GoAtletaIcon
                  name={unit === "Todas" ? "classes" : "organization"}
                  size={15}
                  color={
                    active
                      ? colors.primaryText
                      : (colors.textMuted ?? colors.muted)
                  }
                />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    color: active
                      ? colors.primaryText
                      : (colors.textPrimary ?? colors.text),
                    fontSize: 12,
                    fontWeight: "800",
                  }}
                >
                  {unit === "Todas" ? "Todas as unidades" : unit}
                </Text>
                <Text
                  style={{
                    color: active
                      ? colors.primaryText
                      : (colors.textMuted ?? colors.muted),
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {unitCounts[unit] ?? 0}
                </Text>
              </View>
            </AnchoredDropdownOption>
          );
        })}
      </AnchoredDropdown>
    </View>
  );
});
