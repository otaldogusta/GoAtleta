import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  Animated,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { ClassGroup } from "../../../core/models";
import { markRender } from "../../../observability/perf";
import { radius } from "../../../theme/tokens";
import type { ThemeColors } from "../../../ui/app-theme";
import { AppRefreshControl } from "../../../ui/AppRefreshControl";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../../ui/AnchoredDropdownOption";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";
import { useCollapsibleAnimation } from "../../../ui/use-collapsible";
import { useContainerResponsiveLayout } from "../../../ui/use-container-responsive-layout";
import type { ClassCardViewModel } from "../application/class-card-view-model";
import { ClassCard } from "./ClassCard";

type GroupedClasses = [string, ClassGroup[]][];
type Conflict = { name: string; day: number; modality?: string; kind: "conflict" | "integration" };
type Layout = { x: number; y: number; width: number; height: number };

const ALL_UNITS_KEY = "__all_units__";
const OPEN_MENU_Z_INDEX = 11000;
const TABLE_LAYOUT_MIN_WIDTH = 680;

type Props = {
  grouped: GroupedClasses;
  conflictsById: Record<string, Conflict[]>;
  dayNames: string[];
  colors: ThemeColors;
  onOpenClass: (item: ClassGroup) => void;
  onEditClass: (item: ClassGroup) => void;
  onDuplicateClass: (item: ClassGroup) => void;
  onDeleteClass: (item: ClassGroup) => void;
  classCardViewModelsById: Record<string, ClassCardViewModel>;
  refreshing?: boolean;
  onRefresh?: () => void | Promise<void>;
  onScrollBeginDrag?: () => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

const unitKey = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

export const ClassesListSection = memo(function ClassesListSection({
  grouped,
  conflictsById,
  dayNames,
  colors,
  onOpenClass,
  onEditClass,
  onDuplicateClass,
  onDeleteClass,
  classCardViewModelsById,
  refreshing,
  onRefresh,
  onScrollBeginDrag,
  contentContainerStyle,
  style,
}: Props) {
  markRender("screen.classes.render.listSection");
  const { containerRef, onLayout, width: availableWidth } =
    useContainerResponsiveLayout("dashboard");
  const showTable = availableWidth >= TABLE_LAYOUT_MIN_WIDTH;
  const compactControls = availableWidth < 520;
  const [selectedUnitKey, setSelectedUnitKey] = useState(ALL_UNITS_KEY);
  const [classSearch, setClassSearch] = useState("");
  const [tableAscending, setTableAscending] = useState(true);
  const [sortKey, setSortKey] = useState<"name" | "time" | "age" | "students" | "teacher" | null>(null);
  const sortIndicator = useRef(new Animated.Value(0)).current;
  const unitTriggerRef = useRef<View | null>(null);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [unitDropdownLayout, setUnitDropdownLayout] = useState<Layout | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const { animatedStyle: unitDropdownAnimationStyle, isVisible: unitDropdownVisible } =
    useCollapsibleAnimation(unitDropdownOpen, {
      durationIn: 140,
      durationOut: 100,
      translateY: -4,
    });

  const units = useMemo(
    () => grouped.map(([label, items]) => ({ key: unitKey(label), label, items })),
    [grouped]
  );
  const allClasses = useMemo(() => units.flatMap((unit) => unit.items), [units]);
  const totalClasses = allClasses.length;

  const sortedUnits = useMemo(
    () => [...units].sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" })),
    [units]
  );

  useEffect(() => {
    if (selectedUnitKey === ALL_UNITS_KEY) return;
    if (!units.some((unit) => unit.key === selectedUnitKey)) {
      setSelectedUnitKey(ALL_UNITS_KEY);
    }
  }, [selectedUnitKey, units]);

  const selectedUnit = units.find((unit) => unit.key === selectedUnitKey) ?? null;
  const selectedClasses = useMemo(() => {
    const items = selectedUnit?.items ?? allClasses;
    const normalizedSearch = classSearch.trim().toLocaleLowerCase("pt-BR");
    const filteredItems = normalizedSearch
      ? items.filter((item) =>
          [
            item.name,
            item.unit,
            item.ageBand,
            classCardViewModelsById[item.id]?.teacher.name,
          ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(normalizedSearch))
        )
      : items;
    if (!sortKey) return filteredItems;
    return [...filteredItems].sort((a, b) => {
      let left = "", right = "";
      if (sortKey === "name") { left = a.name; right = b.name; }
      if (sortKey === "time") { left = a.startTime; right = b.startTime; }
      if (sortKey === "age") { left = a.ageBand; right = b.ageBand; }
      if (sortKey === "teacher") { left = classCardViewModelsById[a.id]?.teacher.name ?? ""; right = classCardViewModelsById[b.id]?.teacher.name ?? ""; }
      if (sortKey === "students") { const result = (classCardViewModelsById[a.id]?.studentCount ?? 0) - (classCardViewModelsById[b.id]?.studentCount ?? 0); return tableAscending ? result : -result; }
      const result = left.localeCompare(right, "pt-BR", { numeric: true, sensitivity: "base" });
      return tableAscending ? result : -result;
    });
  }, [allClasses, classCardViewModelsById, classSearch, selectedUnit?.items, sortKey, tableAscending]);
  const selectSort = useCallback((key: Exclude<typeof sortKey, null>) => {
    if (sortKey === key) {
      setSortKey(null);
      setTableAscending(true);
    }
    else {
      sortIndicator.setValue(0);
      setSortKey(key);
      setTableAscending(true);
      Animated.spring(sortIndicator, {
        toValue: 1,
        friction: 6,
        tension: 180,
        useNativeDriver: Platform.OS === "ios" || Platform.OS === "android",
      }).start();
    }
  }, [sortIndicator, sortKey]);

  const selectedTitle = selectedUnit?.label ?? "Todas as unidades";
  const closeActionMenu = useCallback(() => setOpenActionMenuId(null), []);
  const toggleActionMenu = useCallback((classId: string) => {
    setOpenActionMenuId((current) => (current === classId ? null : classId));
  }, []);

  const chooseUnit = useCallback((key: string) => {
    setSelectedUnitKey(key);
    setUnitDropdownOpen(false);
    setOpenActionMenuId(null);
  }, []);

  const toggleUnitDropdown = useCallback(() => {
    if (unitDropdownOpen) {
      setUnitDropdownOpen(false);
      return;
    }
    unitTriggerRef.current?.measureInWindow((x, y, width, height) => {
      setUnitDropdownLayout({ x, y, width, height });
      setUnitDropdownOpen(true);
    });
  }, [unitDropdownOpen]);

  const renderClass = useCallback(
    ({ item }: { item: ClassGroup }) => (
      <View
        style={[
          styles.classRowWrapper,
          !showTable ? styles.classCardWrapper : null,
          openActionMenuId === item.id ? styles.classRowWrapperOpen : null,
        ]}
      >
        <ClassCard
          item={item}
          conflicts={conflictsById[item.id]}
          dayNames={dayNames}
          colors={colors}
          onOpen={onOpenClass}
          viewModel={classCardViewModelsById[item.id]}
          actionMenuOpen={openActionMenuId === item.id}
          onToggleActionMenu={toggleActionMenu}
          onCloseActionMenu={closeActionMenu}
          onEdit={onEditClass}
          onDuplicate={onDuplicateClass}
          onDelete={onDeleteClass}
          layout={showTable ? "table" : "card"}
          showUnit={selectedUnitKey === ALL_UNITS_KEY}
          narrowCard={availableWidth < 520}
        />
      </View>
    ),
    [
      classCardViewModelsById,
      closeActionMenu,
      colors,
      conflictsById,
      dayNames,
      onDeleteClass,
      onDuplicateClass,
      onEditClass,
      onOpenClass,
      openActionMenuId,
      selectedUnitKey,
      showTable,
      toggleActionMenu,
      availableWidth,
    ]
  );

  if (!grouped.length) {
    return (
      <View style={[styles.emptyState, { backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg }]}>
        <Text style={{ color: colors.textMuted ?? colors.muted, fontSize: 13 }}>Nenhuma turma encontrada.</Text>
      </View>
    );
  }

  return (
    <View
      ref={containerRef}
      onLayout={onLayout}
      style={[styles.root, { backgroundColor: colors.background }, style]}
    >
      <View style={[styles.classesPanel, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.classesHeader,
            { borderBottomColor: colors.borderSubtle ?? colors.border },
          ]}
        >
          <View
            ref={unitTriggerRef}
            collapsable={false}
            style={[
              styles.unitSelectAnchor,
              compactControls ? styles.unitSelectAnchorCompact : null,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Selecionar unidade. Atual: ${selectedTitle}`}
              onPress={toggleUnitDropdown}
              style={(state) => [
                styles.unitSelectTrigger,
                {
                  backgroundColor:
                    state.hovered || unitDropdownOpen
                      ? colors.secondaryBg
                      : colors.backgroundSubtle ?? colors.secondaryBg,
                  borderColor:
                    unitDropdownOpen ? colors.primaryBg : colors.borderSubtle ?? colors.border,
                },
              ]}
            >
              <GoAtletaIcon name="organization" size={16} color={colors.primaryBg} />
              <Text
                numberOfLines={1}
                style={[styles.unitSelectText, { color: colors.textPrimary ?? colors.text }]}
              >
                {selectedTitle}
              </Text>
              <Text style={[styles.unitSelectCount, { color: colors.textMuted ?? colors.muted }]}>
                {selectedUnit?.items.length ?? totalClasses}
              </Text>
              <GoAtletaIcon
                name={unitDropdownOpen ? "chevronUp" : "chevronDown"}
                size={14}
                color={colors.textMuted ?? colors.muted}
              />
            </Pressable>
          </View>

          <View
            style={[
              styles.classSearchField,
              {
                backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg,
                borderColor: colors.borderSubtle ?? colors.border,
              },
            ]}
          >
            <GoAtletaIcon name="search" size={16} color={colors.textMuted ?? colors.muted} />
            <TextInput
              value={classSearch}
              onChangeText={setClassSearch}
              placeholder="Buscar turma"
              placeholderTextColor={colors.placeholder}
              accessibilityLabel="Buscar turma"
              style={[styles.classSearchInput, { color: colors.textPrimary ?? colors.text }]}
            />
            {classSearch ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Limpar busca"
                onPress={() => setClassSearch("")}
                suppressWebHoverFeedback
                style={styles.clearSearchButton}
              >
                <GoAtletaIcon name="close" size={14} color={colors.textMuted ?? colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {showTable ? (
          <View style={[styles.tableHeader, { borderBottomColor: colors.borderSubtle ?? colors.border }]}>
            {([['TURMA', 'name', styles.tableIdentityHeading], ['HORÁRIO', 'time', styles.tableScheduleHeading], ['IDADE / NÍVEL', 'age', styles.tableFocusHeading], ['ALUNOS', 'students', styles.tableStudentsHeading], ['PROFESSOR', 'teacher', styles.tableTeacherHeading]] as const).map(([label, key, style]) => (
              <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Ordenar por ${label}`} suppressWebHoverFeedback disableWebPressScale onPress={() => selectSort(key)} style={[styles.tableHeadingButton, style]}>
                <Text style={[styles.tableHeading, { color: sortKey === key ? colors.text : (colors.textMuted ?? colors.muted) }]}>{label}</Text>
                {sortKey === key ? <Animated.View style={{ opacity: sortIndicator, transform: [{ scale: sortIndicator.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) }, { translateY: sortIndicator.interpolate({ inputRange: [0, 1], outputRange: [-3, 0] }) }] }}><GoAtletaIcon name="swapVertical" size={13} color={colors.text} /></Animated.View> : <GoAtletaIcon name="swapVertical" size={13} color={colors.textMuted ?? colors.muted} />}
              </Pressable>
            ))}
            <View style={styles.tableActionHeading} />
          </View>
        ) : null}

        <FlatList
          data={selectedClasses}
          keyExtractor={(item) => item.id}
          renderItem={renderClass}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews={false}
          style={styles.classList}
          contentContainerStyle={[
            !showTable ? styles.mobileClassListContent : null,
            contentContainerStyle,
          ]}
          ListEmptyComponent={
            <View style={styles.filteredEmptyState}>
              <Text style={{ color: colors.textMuted ?? colors.muted, fontSize: 13 }}>
                Nenhuma turma corresponde aos filtros.
              </Text>
            </View>
          }
          onScrollBeginDrag={() => {
            closeActionMenu();
            onScrollBeginDrag?.();
          }}
          onMomentumScrollBegin={closeActionMenu}
          refreshControl={
            onRefresh ? (
              <AppRefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={() => void onRefresh()}
                tintColor={colors.text}
                colors={[colors.text]}
              />
            ) : undefined
          }
        />
      </View>

      <AnchoredDropdown
        visible={unitDropdownVisible}
        layout={unitDropdownLayout}
        container={null}
        animationStyle={unitDropdownAnimationStyle}
        zIndex={12500}
        maxHeight={Math.min(220, (sortedUnits.length + 1) * 42 + 12)}
        nestedScrollEnabled
        onRequestClose={() => setUnitDropdownOpen(false)}
        interactiveRefs={[unitTriggerRef]}
        density="compact"
        showVerticalScrollIndicator={sortedUnits.length > 4}
      >
        <AnchoredDropdownOption
          active={selectedUnitKey === ALL_UNITS_KEY}
          density="compact"
          onPress={() => chooseUnit(ALL_UNITS_KEY)}
        >
          <View style={styles.dropdownOptionContent}>
            <Text
              numberOfLines={1}
              style={[
                styles.dropdownOptionText,
                {
                  color:
                    selectedUnitKey === ALL_UNITS_KEY ? colors.primaryText : colors.textPrimary ?? colors.text,
                },
              ]}
            >
              Todas as unidades
            </Text>
            <Text
              style={[
                styles.dropdownOptionCount,
                { color: selectedUnitKey === ALL_UNITS_KEY ? colors.primaryText : colors.textMuted ?? colors.muted },
              ]}
            >
              {totalClasses}
            </Text>
          </View>
        </AnchoredDropdownOption>
        {sortedUnits.map((unit) => {
          const active = unit.key === selectedUnitKey;
          return (
            <AnchoredDropdownOption
              key={unit.key}
              active={active}
              density="compact"
              onPress={() => chooseUnit(unit.key)}
            >
              <View style={styles.dropdownOptionContent}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.dropdownOptionText,
                    { color: active ? colors.primaryText : colors.textPrimary ?? colors.text },
                  ]}
                >
                  {unit.label}
                </Text>
                <Text
                  style={[
                    styles.dropdownOptionCount,
                    { color: active ? colors.primaryText : colors.textMuted ?? colors.muted },
                  ]}
                >
                  {unit.items.length}
                </Text>
              </View>
            </AnchoredDropdownOption>
          );
        })}
      </AnchoredDropdown>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
    overflow: "hidden",
  },
  classesPanel: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  classesHeader: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  unitSelectAnchor: {
    width: 264,
    minWidth: 0,
  },
  unitSelectAnchorCompact: {
    width: "46%",
    minWidth: 180,
    maxWidth: 240,
    flexShrink: 0,
  },
  unitSelectTrigger: {
    height: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.internal,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  unitSelectText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "800",
  },
  unitSelectCount: {
    fontSize: 11,
    fontWeight: "700",
  },
  classSearchField: {
    flex: 1,
    minWidth: 0,
    height: 42,
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.internal,
    paddingLeft: 12,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  classSearchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    paddingVertical: Platform.OS === "web" ? 0 : 8,
  },
  clearSearchButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
  },
  dropdownOptionContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dropdownOptionText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "700",
  },
  dropdownOptionCount: {
    fontSize: 11,
    fontWeight: "700",
  },
  filteredEmptyState: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  tableHeader: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableHeading: {
    paddingHorizontal: 10,
    fontSize: 10,
    fontWeight: "800",
  },
  tableHeadingButton: { justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 4, minHeight: 36 },
  tableIdentityHeading: { flex: 2.2, minWidth: 200 },
  tableScheduleHeading: { flex: 1.15, minWidth: 112 },
  tableFocusHeading: { flex: 1.15, minWidth: 115 },
  tableStudentsHeading: { flex: 1.15, minWidth: 115 },
  tableTeacherHeading: {
    flex: 1.85,
    minWidth: 180,
    justifyContent: "flex-start",
    paddingLeft: 41,
  },
  tableActionHeading: { width: 42 },
  classList: {
    flex: 1,
    minHeight: 0,
  },
  classRowWrapper: {
    position: "relative",
    zIndex: 1,
    elevation: 1,
  },
  classCardWrapper: {
    marginBottom: 10,
  },
  classRowWrapperOpen: {
    zIndex: OPEN_MENU_Z_INDEX,
    elevation: OPEN_MENU_Z_INDEX,
  },
  mobileClassListContent: {
    padding: 10,
    gap: 8,
  },
  emptyState: {
    padding: 16,
    borderRadius: radius.internal,
  },
});
