import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { ClassGroup, Student } from "../../core/models";
import { radius } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { useCollapsibleAnimation } from "../../ui/use-collapsible";
import { useContainerResponsiveLayout } from "../../ui/use-container-responsive-layout";
import type { StudentListUnitGroup } from "./application/student-list-selectors";
import { BirthdayAvatar } from "./components/BirthdayAvatar";
import { StudentsEmptyState } from "./components/StudentsEmptyState";

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

type FilterSelectProps<T extends string> = {
  label: string;
  value: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
  minWidth?: number;
};

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  minWidth = 132,
}: FilterSelectProps<T>) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const triggerRef = useRef<View>(null);
  const { animatedStyle, isVisible } = useCollapsibleAnimation(open, {
    translateY: -4,
  });
  const selected = options.find((option) => option.value === value);

  const toggle = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setLayout({ x, y, width, height });
      setOpen((current) => !current);
    });
  };

  return (
    <>
      <View ref={triggerRef}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Filtrar por ${label}`}
          onPress={toggle}
          style={{
            minWidth,
            minHeight: 38,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: open ? colors.primaryBg : colors.border,
            borderRadius: radius.internal,
            backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg,
            paddingHorizontal: 11,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text
            numberOfLines={1}
            style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}
          >
            {label}: {selected?.label ?? "Todos"}
          </Text>
          <GoAtletaIcon
            name={open ? "chevronUp" : "chevronDown"}
            size={13}
            color={colors.muted}
          />
        </Pressable>
      </View>
      <AnchoredDropdown
        visible={isVisible}
        layout={layout}
        container={null}
        animationStyle={animatedStyle}
        zIndex={6400}
        maxHeight={220}
        nestedScrollEnabled
        density="compact"
        onRequestClose={() => setOpen(false)}
        interactiveRefs={[triggerRef]}
      >
        {options.map((option) => (
          <AnchoredDropdownOption
            key={option.value}
            active={option.value === value}
            density="compact"
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
          >
            <Text
              style={{
                color:
                  option.value === value ? colors.primaryText : colors.text,
                fontSize: 11,
                fontWeight: "700",
              }}
            >
              {option.label}
            </Text>
          </AnchoredDropdownOption>
        ))}
      </AnchoredDropdown>
    </>
  );
}

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
  onStudentWhatsApp?: (student: Student) => void;
  birthdayStudentIds?: ReadonlySet<string>;
  loading?: boolean;
};

const PAGE_SIZE = 8;

type StudentStatusFilter = "all" | "regular" | "experimental";
type StudentGenderFilter = "all" | ClassGroup["gender"];
type StudentClassFilter = "all" | string;
type StudentContactFilter = "all" | "with" | "without";

export const StudentsListTab = memo(function StudentsListTab({
  studentsUnitOptions,
  studentsUnitFilter,
  setStudentsUnitFilter,
  studentsSearch,
  setStudentsSearch,
  students,
  studentsFiltered,
  classById,
  unitLabel,
  onStudentPress,
  onPhotoPress,
  onStudentWhatsApp,
  birthdayStudentIds,
  loading = false,
}: StudentsListTabProps) {
  const { colors } = useAppTheme();
  const { containerRef, onLayout, width } =
    useContainerResponsiveLayout("dashboard");
  const desktop = width >= 1040;
  const [unitSearch, setUnitSearch] = useState("");
  const [unitAscending, setUnitAscending] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StudentStatusFilter>("all");
  const [genderFilter, setGenderFilter] = useState<StudentGenderFilter>("all");
  const [classFilter, setClassFilter] = useState<StudentClassFilter>("all");
  const [contactFilter, setContactFilter] =
    useState<StudentContactFilter>("all");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [page, setPage] = useState(1);
  const hasSearch = studentsSearch.trim().length > 0;

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

  const visibleUnits = useMemo(() => {
    const query = unitSearch.trim().toLocaleLowerCase("pt-BR");
    const filtered = studentsUnitOptions.filter((unit) =>
      (unit === "Todas" ? "Todas as unidades" : unit)
        .toLocaleLowerCase("pt-BR")
        .includes(query),
    );
    const namedUnits = filtered
      .filter((unit) => unit !== "Todas")
      .sort((a, b) =>
        unitAscending
          ? a.localeCompare(b, "pt-BR")
          : b.localeCompare(a, "pt-BR"),
      );
    return filtered.includes("Todas") ? ["Todas", ...namedUnits] : namedUnits;
  }, [studentsUnitOptions, unitAscending, unitSearch]);

  const classOptions = useMemo<FilterOption<StudentClassFilter>[]>(() => {
    const ids = new Set(studentsFiltered.map((student) => student.classId));
    return [
      { value: "all", label: "Todas" },
      ...Array.from(ids)
        .map((id) => classById.get(id))
        .filter((value): value is ClassGroup => Boolean(value))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .map((cls) => ({ value: cls.id, label: cls.name })),
    ];
  }, [classById, studentsFiltered]);

  const filteredRows = useMemo(
    () =>
      studentsFiltered.filter((student) => {
        const cls = classById.get(student.classId);
        if (statusFilter === "regular" && Boolean(student.isExperimental)) {
          return false;
        }
        if (statusFilter === "experimental" && !student.isExperimental) {
          return false;
        }
        if (genderFilter !== "all" && cls?.gender !== genderFilter) {
          return false;
        }
        if (classFilter !== "all" && student.classId !== classFilter) {
          return false;
        }
        const hasContact = Boolean(student.guardianPhone || student.phone);
        if (contactFilter === "with" && !hasContact) return false;
        if (contactFilter === "without" && hasContact) return false;
        return true;
      }),
    [
      classById,
      classFilter,
      contactFilter,
      genderFilter,
      statusFilter,
      studentsFiltered,
    ],
  );

  useEffect(() => {
    setPage(1);
  }, [
    classFilter,
    contactFilter,
    genderFilter,
    statusFilter,
    studentsSearch,
    studentsUnitFilter,
  ]);

  useEffect(() => {
    if (
      classFilter !== "all" &&
      !classOptions.some((option) => option.value === classFilter)
    ) {
      setClassFilter("all");
    }
  }, [classFilter, classOptions]);

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

  return (
    <View
      ref={containerRef}
      onLayout={onLayout}
      style={{
        flex: desktop ? 1 : undefined,
        flexDirection: desktop ? "row" : "column",
        minHeight: desktop ? 0 : 540,
        overflow: desktop ? "hidden" : "visible",
        backgroundColor: colors.background,
      }}
    >
      <View
        style={{
          width: desktop ? 256 : "100%",
          minWidth: desktop ? 256 : undefined,
          borderRightWidth: desktop ? StyleSheet.hairlineWidth : 0,
          borderRightColor: colors.borderSubtle ?? colors.border,
          paddingTop: 14,
          minHeight: 0,
          backgroundColor: colors.background,
        }}
      >
        <Text
          style={{
            color: colors.textPrimary ?? colors.text,
            fontSize: 15,
            fontWeight: "900",
            paddingHorizontal: 16,
            marginBottom: 10,
          }}
        >
          Unidades
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            marginBottom: 8,
          }}
        >
          <View
            style={{
              flex: 1,
              minWidth: 0,
              height: 38,
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
            <GoAtletaIcon name="search" size={15} color={colors.muted} />
            <TextInput
              value={unitSearch}
              onChangeText={setUnitSearch}
              placeholder="Buscar unidade"
              placeholderTextColor={colors.placeholder}
              style={{
                flex: 1,
                minWidth: 0,
                color: colors.textPrimary ?? colors.text,
                fontSize: 12,
              }}
            />
          </View>
          <Pressable
            onPress={() => setUnitAscending((current) => !current)}
            style={{
              minWidth: 62,
              height: 38,
              paddingHorizontal: 9,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.borderSubtle ?? colors.border,
              borderRadius: radius.internal,
              backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 5,
            }}
          >
            <Text
              style={{
                color: colors.textMuted ?? colors.muted,
                fontSize: 11,
                fontWeight: "800",
              }}
            >
              {unitAscending ? "A–Z" : "Z–A"}
            </Text>
            <GoAtletaIcon name="swapVertical" size={13} color={colors.muted} />
          </Pressable>
        </View>
        <View style={{ flex: desktop ? 1 : undefined, minHeight: 0 }}>
          {visibleUnits.map((unit) => {
            const active = studentsUnitFilter === unit;
            return (
              <Pressable
                key={unit}
                onPress={() => setStudentsUnitFilter(unit)}
                style={(state) => ({
                  minHeight: 42,
                  paddingLeft: 13,
                  paddingRight: 14,
                  borderLeftWidth: 3,
                  borderLeftColor: active ? colors.primaryBg : "transparent",
                  backgroundColor:
                    active || state.hovered
                      ? (colors.backgroundSubtle ?? colors.secondaryBg)
                      : "transparent",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                })}
              >
                <GoAtletaIcon
                  name={unit === "Todas" ? "classes" : "organization"}
                  size={15}
                  color={
                    active
                      ? (colors.textPrimary ?? colors.text)
                      : (colors.textMuted ?? colors.muted)
                  }
                />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: active
                      ? (colors.textPrimary ?? colors.text)
                      : (colors.textMuted ?? colors.muted),
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {unit === "Todas" ? "Todas as unidades" : unit}
                </Text>
                <Text
                  style={{
                    color: colors.textMuted ?? colors.muted,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {unitCounts[unit] ?? 0}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {desktop ? (
          <Text
            style={{
              color: colors.textMuted ?? colors.muted,
              fontSize: 11,
              fontWeight: "700",
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            {studentsUnitOptions.filter((unit) => unit !== "Todas").length}{" "}
            unidade
            {studentsUnitOptions.filter((unit) => unit !== "Todas").length === 1
              ? ""
              : "s"}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: desktop ? "hidden" : "visible",
          backgroundColor: colors.background,
        }}
      >
        <View
          style={{
            minHeight: 86,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 18,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.borderSubtle ?? colors.border,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg,
            }}
          >
            <GoAtletaIcon
              name="organization"
              size={20}
              color={colors.textMuted ?? colors.muted}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.textPrimary ?? colors.text,
                fontSize: 17,
                fontWeight: "900",
              }}
            >
              {studentsUnitFilter === "Todas"
                ? "Todas as unidades"
                : studentsUnitFilter}
            </Text>
            <Text
              style={{
                color: colors.textMuted ?? colors.muted,
                marginTop: 3,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {filteredRows.length} aluno
              {filteredRows.length === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        <View
          style={{
            gap: 8,
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.borderSubtle ?? colors.border,
          }}
        >
          <View
            style={{
              height: 38,
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
              placeholder="Buscar aluno, responsável, turma ou unidade"
              placeholderTextColor={colors.placeholder}
              style={{
                flex: 1,
                minWidth: 0,
                color: colors.textPrimary ?? colors.text,
                fontSize: 12,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
            }}
          >
            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Todos" },
                { value: "regular", label: "Regulares" },
                { value: "experimental", label: "Experimentais" },
              ]}
            />
            <FilterSelect
              label="Gênero"
              value={genderFilter}
              onChange={setGenderFilter}
              options={[
                { value: "all", label: "Todos" },
                { value: "feminino", label: "Feminino" },
                { value: "masculino", label: "Masculino" },
                { value: "misto", label: "Misto" },
              ]}
            />
            <FilterSelect
              label="Turma"
              value={classFilter}
              onChange={setClassFilter}
              options={classOptions}
              minWidth={150}
            />
            <Pressable
              onPress={() => setShowMoreFilters((current) => !current)}
              style={{
                minHeight: 38,
                paddingHorizontal: 12,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: showMoreFilters
                  ? colors.primaryBg
                  : (colors.borderSubtle ?? colors.border),
                borderRadius: radius.internal,
                backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg,
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
              }}
            >
              <GoAtletaIcon
                name="options"
                size={14}
                color={colors.textMuted ?? colors.muted}
              />
              <Text
                style={{
                  color: colors.textPrimary ?? colors.text,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                Mais filtros
              </Text>
            </Pressable>
            {showMoreFilters ? (
              <FilterSelect
                label="Contato"
                value={contactFilter}
                onChange={setContactFilter}
                options={[
                  { value: "all", label: "Todos" },
                  { value: "with", label: "Com contato" },
                  { value: "without", label: "Sem contato" },
                ]}
                minWidth={150}
              />
            ) : null}
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
                flex: desktop ? 1 : undefined,
                minHeight: desktop ? 0 : undefined,
                overflow: "hidden",
                backgroundColor: colors.background,
              }}
            >
              {desktop ? (
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
                style={desktop ? { flex: 1, minHeight: 0 } : undefined}
                contentContainerStyle={
                  desktop ? { flexGrow: 1 } : { flexGrow: 0 }
                }
                scrollEnabled={desktop}
                nestedScrollEnabled
                showsVerticalScrollIndicator={desktop}
                keyboardShouldPersistTaps="handled"
              >
                {pageRows.map((student) => {
                  const cls = classById.get(student.classId);
                  return (
                    <Pressable
                      key={student.id}
                      onPress={() => onStudentPress?.(student)}
                      style={(state) => ({
                        minHeight: desktop ? 88 : 64,
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
                          flex: desktop ? 2.2 : 1,
                          minWidth: desktop ? 210 : 0,
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
                            photoUrl={student.photoUrl}
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
                          {!desktop ? (
                            <Text
                              numberOfLines={1}
                              style={{ color: colors.muted, fontSize: 10 }}
                            >
                              {cls?.name ?? "Turma"} · {student.age || "—"} anos
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {desktop ? (
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
                          <Text
                            numberOfLines={1}
                            style={{
                              flex: 1,
                              minWidth: 100,
                              paddingHorizontal: 10,
                              color: colors.textMuted ?? colors.muted,
                              fontSize: 11,
                            }}
                          >
                            {cls?.name ?? "Turma"}
                          </Text>
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
                                borderColor: student.isExperimental
                                  ? colors.warningBg
                                  : colors.successBg,
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                              }}
                            >
                              <Text
                                style={{
                                  color: student.isExperimental
                                    ? colors.warningText
                                    : colors.successText,
                                  fontSize: 10,
                                  fontWeight: "800",
                                }}
                              >
                                {student.isExperimental
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
    </View>
  );
});
