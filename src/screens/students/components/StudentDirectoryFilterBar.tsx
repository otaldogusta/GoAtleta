import { useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { radius } from "../../../theme/tokens";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../../ui/AnchoredDropdownOption";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { useCollapsibleAnimation } from "../../../ui/use-collapsible";
import type { StudentMembershipScope } from "../application/student-list-filters";

export type StudentFamilyAccessFilter =
  | "all"
  | "active"
  | "invited"
  | "none";

type FilterKey = "class" | "status" | "access";
type FilterOption = { value: string; label: string };
type DropdownLayout = { x: number; y: number; width: number; height: number };

const STATUS_OPTIONS: FilterOption[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
];

const ACCESS_OPTIONS: FilterOption[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Acesso ativo" },
  { value: "invited", label: "Convite enviado" },
  { value: "none", label: "Sem acesso" },
];

function FilterSelect({
  label,
  value,
  expanded,
  triggerRef,
  onPress,
}: {
  label: string;
  value: string;
  expanded: boolean;
  triggerRef: RefObject<View | null>;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View ref={triggerRef} collapsable={false} style={styles.selectSlot}>
      <Text
        pointerEvents="none"
        style={[
          styles.selectLegend,
          {
            color: colors.muted,
            backgroundColor: colors.backgroundSubtle,
          },
        ]}
      >
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={(state) => [
          styles.select,
          {
            borderColor:
              expanded || state.hovered ? colors.primaryBg : colors.border,
            backgroundColor: colors.backgroundSubtle,
          },
        ]}
      >
        <Text numberOfLines={1} style={[styles.selectValue, { color: colors.text }]}>
          {value}
        </Text>
        <GoAtletaIcon
          name={expanded ? "chevronUp" : "chevronDown"}
          size={15}
          color={colors.muted}
        />
      </Pressable>
    </View>
  );
}

export function StudentDirectoryFilterBar({
  compact,
  search,
  onSearchChange,
  classOptions,
  classFilter,
  onClassFilterChange,
  statusFilter,
  onStatusFilterChange,
  accessFilter,
  onAccessFilterChange,
  activeFilterCount,
  onOpenMoreFilters,
  onClear,
}: {
  compact: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  classOptions: FilterOption[];
  classFilter: string;
  onClassFilterChange: (value: string) => void;
  statusFilter: StudentMembershipScope;
  onStatusFilterChange: (value: StudentMembershipScope) => void;
  accessFilter: StudentFamilyAccessFilter;
  onAccessFilterChange: (value: StudentFamilyAccessFilter) => void;
  activeFilterCount: number;
  onOpenMoreFilters: () => void;
  onClear: () => void;
}) {
  const { colors } = useAppTheme();
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [dropdownLayout, setDropdownLayout] = useState<DropdownLayout | null>(null);
  const classTriggerRef = useRef<View | null>(null);
  const statusTriggerRef = useRef<View | null>(null);
  const accessTriggerRef = useRef<View | null>(null);
  const { animatedStyle, isVisible } = useCollapsibleAnimation(Boolean(openFilter), {
    durationIn: 170,
    durationOut: 130,
    translateY: -4,
  });

  const classLabel =
    classFilter === "all"
      ? "Todas"
      : classOptions.find((option) => option.value === classFilter)?.label ?? "Todas";
  const statusLabel =
    STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? "Todos";
  const accessLabel =
    ACCESS_OPTIONS.find((option) => option.value === accessFilter)?.label ?? "Todos";

  const options = useMemo(() => {
    if (openFilter === "class") {
      return [{ value: "all", label: "Todas" }, ...classOptions];
    }
    if (openFilter === "status") return STATUS_OPTIONS;
    if (openFilter === "access") return ACCESS_OPTIONS;
    return [];
  }, [classOptions, openFilter]);

  const selectedValue =
    openFilter === "class"
      ? classFilter
      : openFilter === "status"
        ? statusFilter
        : accessFilter;

  const open = (key: FilterKey, trigger: RefObject<View | null>) => {
    if (openFilter === key) {
      setOpenFilter(null);
      return;
    }
    trigger.current?.measureInWindow((x, y, width, height) => {
      setDropdownLayout({ x, y, width, height });
      setOpenFilter(key);
    });
  };

  const select = (value: string) => {
    if (openFilter === "class") onClassFilterChange(value);
    if (openFilter === "status") {
      onStatusFilterChange(value as StudentMembershipScope);
    }
    if (openFilter === "access") {
      onAccessFilterChange(value as StudentFamilyAccessFilter);
    }
    setOpenFilter(null);
  };

  const searchField = (
    <View
      style={[
        styles.search,
        {
          borderColor: colors.border,
          backgroundColor: colors.backgroundSubtle,
        },
      ]}
    >
      <GoAtletaIcon name="search" size={17} color={colors.muted} />
      <TextInput
        accessibilityLabel="Buscar atleta"
        value={search}
        onChangeText={onSearchChange}
        placeholder="Buscar atleta"
        placeholderTextColor={colors.placeholder}
        style={[
          styles.searchInput,
          { color: colors.text },
          Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : null,
        ]}
      />
    </View>
  );

  if (compact) {
    return (
      <View style={styles.mobileBar}>
        <View style={styles.mobileSearch}>{searchField}</View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir filtros de atletas"
          onPress={onOpenMoreFilters}
          style={(state) => [
            styles.mobileFilterButton,
            {
              borderColor: activeFilterCount > 0 ? colors.primaryBg : colors.border,
              backgroundColor: state.hovered
                ? colors.secondaryBg
                : colors.backgroundSubtle,
            },
          ]}
        >
          <GoAtletaIcon name="options" size={16} color={colors.muted} />
          <Text style={[styles.mobileFilterText, { color: colors.text }]}>Filtros</Text>
          {activeFilterCount > 0 ? (
            <View style={[styles.countBadge, { backgroundColor: colors.primaryBg }]}>
              <Text style={[styles.countText, { color: colors.primaryText }]}>
                {activeFilterCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <View
        style={[
          styles.desktopBar,
          { borderColor: colors.border, backgroundColor: colors.backgroundSubtle },
        ]}
      >
        <View style={styles.desktopSearch}>{searchField}</View>
        <FilterSelect
          label="Turma"
          value={classLabel}
          expanded={openFilter === "class"}
          triggerRef={classTriggerRef}
          onPress={() => open("class", classTriggerRef)}
        />
        <FilterSelect
          label="Status"
          value={statusLabel}
          expanded={openFilter === "status"}
          triggerRef={statusTriggerRef}
          onPress={() => open("status", statusTriggerRef)}
        />
        <FilterSelect
          label="Responsável / acesso"
          value={accessLabel}
          expanded={openFilter === "access"}
          triggerRef={accessTriggerRef}
          onPress={() => open("access", accessTriggerRef)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Limpar filtros de atletas"
          onPress={onClear}
          style={(state) => [
            styles.clearButton,
            {
              borderColor: colors.border,
              backgroundColor: state.hovered ? colors.secondaryBg : "transparent",
            },
          ]}
        >
          <GoAtletaIcon name="options" size={16} color={colors.muted} />
          <Text style={[styles.clearText, { color: colors.text }]}>Limpar filtros</Text>
        </Pressable>
      </View>

      <AnchoredDropdown
        visible={isVisible}
        layout={dropdownLayout}
        container={null}
        animationStyle={animatedStyle}
        zIndex={16000}
        maxHeight={248}
        nestedScrollEnabled
        density="menu"
        fitContent
        preferredWidth={220}
        portalToBodyOnWeb
        onRequestClose={() => setOpenFilter(null)}
      >
        {options.map((option) => (
          <AnchoredDropdownOption
            key={option.value}
            active={selectedValue === option.value}
            density="compact"
            onPress={() => select(option.value)}
          >
            <Text
              style={{
                color:
                  selectedValue === option.value
                    ? colors.primaryText
                    : colors.text,
                fontSize: 12,
                fontWeight: "800",
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

const styles = StyleSheet.create({
  desktopBar: {
    minHeight: 72,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  desktopSearch: { flex: 1.15, minWidth: 150 },
  mobileBar: { flexDirection: "row", alignItems: "center", gap: 10 },
  mobileSearch: { flex: 1, minWidth: 0 },
  search: {
    minHeight: 48,
    height: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.internal,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    paddingVertical: 0,
    borderWidth: 0,
    borderRadius: 0,
    fontSize: 13,
  },
  selectSlot: {
    flex: 1,
    minWidth: 0,
    position: "relative",
    paddingTop: 7,
  },
  selectLegend: {
    position: "absolute",
    top: 0,
    left: 12,
    zIndex: 2,
    paddingHorizontal: 5,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 14,
  },
  select: {
    flex: 1,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.internal,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 5,
  },
  selectValue: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: "800" },
  clearButton: {
    minWidth: 132,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.internal,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  clearText: { fontSize: 12, fontWeight: "800" },
  mobileFilterButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.internal,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  mobileFilterText: { fontSize: 12, fontWeight: "800" },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 9, fontWeight: "900" },
});
