import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StyleProp, ViewStyle, ViewToken } from "react-native";
import { Animated, FlatList, Platform, StyleSheet, TextInput, View } from "react-native";
import { OperationalText as Text } from "../../../ui/OperationalText";

import type { ClassGroup } from "../../../core/models";
import { markRender } from "../../../observability/perf";
import { compactUiMetrics, radius } from "../../../theme/tokens";
import type { ThemeColors } from "../../../ui/app-theme";
import { AppRefreshControl } from "../../../ui/AppRefreshControl";
import { Button } from "../../../ui/Button";
import { CompactSelect } from "../../../ui/CompactSelect";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";
import { useContainerResponsiveLayout } from "../../../ui/use-container-responsive-layout";
import type { ClassCardViewModel } from "../application/class-card-view-model";
import { ClassCard, compactClassTableColumns } from "./ClassCard";

type GroupedClasses = [string, ClassGroup[]][];
type Conflict = { name: string; day: number; modality?: string; kind: "conflict" | "integration" };

const ALL_UNITS_KEY = "__all_units__";
// The five columns and their action target need 764 px before any extra room.
const TABLE_LAYOUT_MIN_WIDTH = 820;
const COMPACT_WEB_TABLE_MIN_WIDTH = 660;

type Props = {
  grouped: GroupedClasses;
  conflictsById: Record<string, Conflict[]>;
  dayNames: string[];
  colors: ThemeColors;
  onOpenClass: (item: ClassGroup) => void;
  onEditClass: (item: ClassGroup) => void;
  onDuplicateClass?: (item: ClassGroup) => void;
  onDeleteClass: (item: ClassGroup) => void;
  classCardViewModelsById: Record<string, ClassCardViewModel>;
  onVisiblePhotoClassesChange?: (classIds: string[]) => void;
  refreshing?: boolean;
  loadFailed?: boolean;
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
  onVisiblePhotoClassesChange,
  refreshing,
  loadFailed,
  onRefresh,
  onScrollBeginDrag,
  contentContainerStyle,
  style,
}: Props) {
  markRender("screen.classes.render.listSection");
  const { containerRef, onLayout, width: availableWidth } =
    useContainerResponsiveLayout("dashboard");
  const compactTable = Platform.OS === "web" && availableWidth >= COMPACT_WEB_TABLE_MIN_WIDTH && availableWidth < TABLE_LAYOUT_MIN_WIDTH;
  const showTable = availableWidth >= TABLE_LAYOUT_MIN_WIDTH || compactTable;
  const stackedFilters = availableWidth < 430;
  const [selectedUnitKey, setSelectedUnitKey] = useState(ALL_UNITS_KEY);
  const [classSearch, setClassSearch] = useState("");
  const [viewableClassIds, setViewableClassIds] = useState<string[]>([]);
  const photoViewabilityConfig = useRef({ itemVisiblePercentThreshold: 1 }).current;
  const onPhotoViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<ClassGroup>[] }) => {
    const ids = viewableItems.filter((item) => item.isViewable).map((item) => item.item.id);
    setViewableClassIds((current) => current.length === ids.length && current.every((id, index) => id === ids[index]) ? current : ids);
  }, []);
  const [tableAscending, setTableAscending] = useState(true);
  const [sortKey, setSortKey] = useState<"name" | "time" | "age" | "students" | "teacher" | null>(null);
  const [sortIndicator] = useState(() => new Animated.Value(0));
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

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
  const visiblePhotoClassKey = selectedClasses.filter((item) => viewableClassIds.includes(item.id)).map((item) => item.id).join("\0");
  useEffect(() => {
    onVisiblePhotoClassesChange?.(visiblePhotoClassKey ? visiblePhotoClassKey.split("\0") : []);
  }, [visiblePhotoClassKey, onVisiblePhotoClassesChange]);
  useEffect(() => () => onVisiblePhotoClassesChange?.([]), [onVisiblePhotoClassesChange]);
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
  const hasFilters = Boolean(classSearch.trim()) || Boolean(selectedUnit);
  const resetFilters = () => {
    setClassSearch("");
    chooseUnit(ALL_UNITS_KEY);
  };
  const closeActionMenu = useCallback(() => setOpenActionMenuId(null), []);
  const toggleActionMenu = useCallback((classId: string) => {
    setOpenActionMenuId((current) => (current === classId ? null : classId));
  }, []);

  const chooseUnit = useCallback((key: string) => {
    setSelectedUnitKey(key);
    setOpenActionMenuId(null);
  }, []);

  const renderClass = useCallback(
    ({ item }: { item: ClassGroup }) => (
      <View
        style={[
          styles.classRowWrapper,
          !showTable ? styles.classCardWrapper : null,
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
          compactTable={compactTable}
          showUnit={selectedUnitKey === ALL_UNITS_KEY}
          narrowCard={availableWidth < 520}
        />
      </View>
    ),
    [
      classCardViewModelsById,
      closeActionMenu,
      colors,
      compactTable,
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

  const showFilters = totalClasses > 0;
  const showLoadError = loadFailed && onRefresh;

  return (
    <View
      ref={containerRef}
      onLayout={onLayout}
      style={[styles.root, { backgroundColor: colors.background }, style]}
    >
      <View style={[styles.classesPanel, { backgroundColor: colors.background }]}>
        {showLoadError ? (
          <View style={[styles.loadNotice, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <GoAtletaIcon name="warningCircle" size={18} color={colors.dangerText} />
            <View style={styles.noticeCopy} accessibilityLiveRegion="polite">
              <Text style={[styles.stateTitle, { color: colors.text }]}>Não foi possível carregar as turmas</Text>
              {showFilters ? <Text style={{ color: colors.muted }}>A lista mostra a última consulta disponível.</Text> : null}
            </View>
            <View style={styles.noticeAction}>
              <Button label="Tentar novamente" variant="outline" onPress={() => void onRefresh()} loading={refreshing} />
            </View>
          </View>
        ) : null}
        {showFilters ? <View
          style={[
            styles.classesHeader,
            stackedFilters && styles.stackedFilters,
            { borderBottomColor: colors.borderSubtle ?? colors.border },
          ]}
        >
          <View style={[styles.unitSelectAnchor, stackedFilters && styles.stackedFilter]}>
            <CompactSelect
              label="Unidade"
              value={selectedUnitKey}
              onChange={chooseUnit}
              options={[
                { value: ALL_UNITS_KEY, label: "Todas as unidades" },
                ...sortedUnits.map((unit) => ({ value: unit.key, label: unit.label })),
              ]}
            />
          </View>

          <View
            testID="classes-search-field"
            style={[
              styles.classSearchField,
              stackedFilters && styles.stackedSearchField,
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
                hitSlop={7}
                onPress={() => setClassSearch("")}
                suppressWebHoverFeedback
                style={styles.clearSearchButton}
              >
                <GoAtletaIcon name="close" size={14} color={colors.textMuted ?? colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View> : null}

        {showTable && selectedClasses.length > 0 ? (
          <View style={[styles.tableHeader, { borderBottomColor: colors.borderSubtle ?? colors.border }]}>
            {([['TURMA', 'name', styles.tableIdentityHeading], ['HORÁRIO', 'time', styles.tableScheduleHeading], ['IDADE / NÍVEL', 'age', styles.tableFocusHeading], ['ALUNOS', 'students', styles.tableStudentsHeading], ['PROFESSOR', 'teacher', styles.tableTeacherHeading]] as const).map(([label, key, style]) => (
              <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Ordenar por ${label}`} suppressWebHoverFeedback disableWebPressScale onPress={() => selectSort(key)} style={[styles.tableHeadingButton, style, compactTable && compactClassTableColumns[key]]}>
                <Text numberOfLines={1} style={[styles.tableHeading, compactTable && styles.tableHeadingCompact, { color: sortKey === key ? colors.text : (colors.textMuted ?? colors.muted) }]}>{label}</Text>
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
          onViewableItemsChanged={onPhotoViewableItemsChanged}
          viewabilityConfig={photoViewabilityConfig}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews={false}
          style={styles.classList}
          contentContainerStyle={[
            !showTable ? styles.mobileClassListContent : null,
            contentContainerStyle,
          ]}
          ListEmptyComponent={showLoadError && !showFilters ? null : (
            <View style={styles.filteredEmptyState}>
              <Text style={[styles.stateTitle, { color: colors.text }]} accessibilityLiveRegion="polite">
                {hasFilters ? "Nenhuma turma corresponde aos filtros" : "Nenhuma turma disponível"}
              </Text>
              {hasFilters ? <>
                <Text style={[styles.emptyDescription, { color: colors.muted }]}>
                  {classSearch.trim() ? `Busca: ${classSearch.trim()} · ${selectedTitle}` : selectedTitle}
                </Text>
                <Button label="Limpar filtros" variant="ghost" onPress={resetFilters} />
              </> : null}
            </View>
          )}
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
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stackedFilters: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: compactUiMetrics.gap,
    paddingVertical: 8,
  },
  unitSelectAnchor: {
    width: 264,
    minWidth: 0,
    flexShrink: 1,
  },
  stackedFilter: {
    width: "100%",
  },
  unitSelectTrigger: {
    minHeight: compactUiMetrics.touchTarget,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.internal,
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  unitSelectText: {
    flex: 1,
    minWidth: 0,
    fontSize: compactUiMetrics.bodyFontSize,
    fontWeight: "800",
  },
  unitSelectCount: {
    fontSize: 11,
    fontWeight: "700",
  },
  classSearchField: {
    flex: 1,
    minWidth: 0,
    minHeight: compactUiMetrics.touchTarget,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.internal,
    paddingLeft: 12,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stackedSearchField: {
    flex: 0,
  },
  classSearchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: compactUiMetrics.bodyFontSize,
    borderRadius: 0,
    paddingVertical: Platform.OS === "web" ? 0 : 8,
  },
  clearSearchButton: {
    width: 44,
    height: 44,
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
    fontSize: compactUiMetrics.bodyFontSize,
    fontWeight: "700",
  },
  dropdownOptionCount: {
    fontSize: 11,
    fontWeight: "700",
  },
  filteredEmptyState: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  stateTitle: {
    fontSize: compactUiMetrics.bodyFontSize,
    fontWeight: "700",
  },
  emptyDescription: {
    fontSize: compactUiMetrics.metadataFontSize,
    textAlign: "center",
  },
  loadNotice: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: compactUiMetrics.gap,
    padding: 12,
    marginBottom: 4,
    borderRadius: radius.internal,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noticeCopy: {
    flex: 1,
    minWidth: 148,
    gap: 2,
  },
  noticeAction: {
    flexShrink: 0,
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
  tableHeadingCompact: { paddingHorizontal: 4 },
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
    marginBottom: 0,
  },
  mobileClassListContent: {
    paddingHorizontal: 8,
    paddingTop: 4,
  },
});
