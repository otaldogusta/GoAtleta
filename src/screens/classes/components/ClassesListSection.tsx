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
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";
import { useContainerResponsiveLayout } from "../../../ui/use-container-responsive-layout";
import type { ClassCardViewModel } from "../application/class-card-view-model";
import { ClassCard } from "./ClassCard";

type GroupedClasses = [string, ClassGroup[]][];
type Conflict = { name: string; day: number; modality?: string; kind: "conflict" | "integration" };

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
  const [selectedUnitKey, setSelectedUnitKey] = useState(ALL_UNITS_KEY);
  const [unitSearch, setUnitSearch] = useState("");
  const [ascending, setAscending] = useState(true);
  const [tableAscending, setTableAscending] = useState(true);
  const [sortKey, setSortKey] = useState<"name" | "time" | "age" | "students" | "teacher" | null>(null);
  const sortIndicator = useRef(new Animated.Value(0)).current;
  const [unitDrawerOpen, setUnitDrawerOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const units = useMemo(
    () => grouped.map(([label, items]) => ({ key: unitKey(label), label, items })),
    [grouped]
  );
  const allClasses = useMemo(() => units.flatMap((unit) => unit.items), [units]);
  const totalClasses = allClasses.length;

  const visibleUnits = useMemo(() => {
    const normalizedSearch = unitSearch.trim().toLocaleLowerCase("pt-BR");
    const filtered = normalizedSearch
      ? units.filter((unit) => unit.label.toLocaleLowerCase("pt-BR").includes(normalizedSearch))
      : units;
    return [...filtered].sort((a, b) => {
      const comparison = a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" });
      return ascending ? comparison : -comparison;
    });
  }, [ascending, unitSearch, units]);

  useEffect(() => {
    if (selectedUnitKey === ALL_UNITS_KEY) return;
    if (!units.some((unit) => unit.key === selectedUnitKey)) {
      setSelectedUnitKey(ALL_UNITS_KEY);
    }
  }, [selectedUnitKey, units]);

  const selectedUnit = units.find((unit) => unit.key === selectedUnitKey) ?? null;
  const selectedClasses = useMemo(() => {
    const items = selectedUnit?.items ?? allClasses;
    if (!sortKey) return items;
    return [...items].sort((a, b) => {
      let left = "", right = "";
      if (sortKey === "name") { left = a.name; right = b.name; }
      if (sortKey === "time") { left = a.startTime; right = b.startTime; }
      if (sortKey === "age") { left = a.ageBand; right = b.ageBand; }
      if (sortKey === "teacher") { left = classCardViewModelsById[a.id]?.teacher.name ?? ""; right = classCardViewModelsById[b.id]?.teacher.name ?? ""; }
      if (sortKey === "students") { const result = (classCardViewModelsById[a.id]?.studentCount ?? 0) - (classCardViewModelsById[b.id]?.studentCount ?? 0); return tableAscending ? result : -result; }
      const result = left.localeCompare(right, "pt-BR", { numeric: true, sensitivity: "base" });
      return tableAscending ? result : -result;
    });
  }, [allClasses, classCardViewModelsById, selectedUnit?.items, sortKey, tableAscending]);
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
    setUnitDrawerOpen(false);
    setOpenActionMenuId(null);
  }, []);

  const renderUnitRow = useCallback(
    ({ item }: { item: { key: string; label: string; items: ClassGroup[] } }) => {
      const active = item.key === selectedUnitKey;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver turmas de ${item.label}`}
          onPress={() => chooseUnit(item.key)}
          style={(state) => [
            styles.unitRow,
            {
              backgroundColor:
                active || state.hovered ? colors.backgroundSubtle ?? colors.secondaryBg : "transparent",
              borderLeftColor: active ? colors.primaryBg : "transparent",
            },
          ]}
        >
          <GoAtletaIcon
            name="organization"
            size={15}
            color={active ? colors.textPrimary ?? colors.text : colors.textMuted ?? colors.muted}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.unitName,
              { color: active ? colors.textPrimary ?? colors.text : colors.textMuted ?? colors.muted },
            ]}
          >
            {item.label}
          </Text>
          <Text style={[styles.unitCount, { color: colors.textMuted ?? colors.muted }]}>{item.items.length}</Text>
        </Pressable>
      );
    },
    [chooseUnit, colors, selectedUnitKey]
  );

  const unitPicker = (
    <View style={styles.unitPickerContent}>
      <View style={styles.unitSearchRow}>
        <View
          style={[
            styles.unitSearchField,
            {
              backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg,
              borderColor: colors.borderSubtle ?? colors.border,
            },
          ]}
        >
          <GoAtletaIcon name="search" size={15} color={colors.textMuted ?? colors.muted} />
          <TextInput
            value={unitSearch}
            onChangeText={setUnitSearch}
            placeholder="Buscar unidade"
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="Buscar unidade"
            style={[styles.unitSearchInput, { color: colors.textPrimary ?? colors.text }]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ascending ? "Ordenar unidades de Z a A" : "Ordenar unidades de A a Z"}
          onPress={() => setAscending((current) => !current)}
          style={(state) => [
            styles.sortButton,
            {
              backgroundColor: state.hovered ? colors.secondaryBg : colors.backgroundSubtle ?? colors.secondaryBg,
              borderColor: colors.borderSubtle ?? colors.border,
            },
          ]}
        >
          <Text style={[styles.sortButtonText, { color: colors.textMuted ?? colors.muted }]}>
            {ascending ? "A–Z" : "Z–A"}
          </Text>
          <GoAtletaIcon name="swapVertical" size={13} color={colors.textMuted ?? colors.muted} />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver turmas de todas as unidades"
        onPress={() => chooseUnit(ALL_UNITS_KEY)}
        style={(state) => [
          styles.unitRow,
          {
            backgroundColor:
              selectedUnitKey === ALL_UNITS_KEY || state.hovered
                ? colors.backgroundSubtle ?? colors.secondaryBg
                : "transparent",
            borderLeftColor: selectedUnitKey === ALL_UNITS_KEY ? colors.primaryBg : "transparent",
          },
        ]}
      >
        <GoAtletaIcon name="classes" size={15} color={colors.textMuted ?? colors.muted} />
        <Text numberOfLines={1} style={[styles.unitName, { color: colors.textPrimary ?? colors.text }]}>
          Todas as unidades
        </Text>
        <Text style={[styles.unitCount, { color: colors.textMuted ?? colors.muted }]}>{totalClasses}</Text>
      </Pressable>

      <FlatList
        data={visibleUnits}
        keyExtractor={(item) => item.key}
        renderItem={renderUnitRow}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        style={styles.unitListDesktop}
        contentContainerStyle={styles.unitListContent}
      />
      <Text style={[styles.unitFooter, { color: colors.textMuted ?? colors.muted }]}>
        {units.length} unidade{units.length === 1 ? "" : "s"}
      </Text>
    </View>
  );

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
        <View style={[styles.classesHeader, { borderBottomColor: colors.borderSubtle ?? colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filtrar turmas por unidade"
            onPress={() => setUnitDrawerOpen((current) => !current)}
            style={(state) => [
              styles.unitFilterTrigger,
              {
                backgroundColor: state.hovered || unitDrawerOpen
                  ? colors.backgroundSubtle ?? colors.secondaryBg
                  : "transparent",
              },
            ]}
          >
            <View
              style={[
                styles.selectedUnitIcon,
                { backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg },
              ]}
            >
              <GoAtletaIcon name="organization" size={17} color={colors.primaryBg} />
            </View>
            <View style={styles.selectedUnitHeading}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}>
                <Text numberOfLines={1} style={[styles.selectedUnitTitle, { color: colors.textPrimary ?? colors.text }]}>
                  {selectedTitle}
                </Text>
                <View
                  style={[
                    styles.unitBadgePill,
                    {
                      backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg,
                      borderColor: colors.borderSubtle ?? colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.unitBadgeText, { color: colors.textMuted ?? colors.muted }]}>
                    {availableWidth < 420 ? "Filtrar" : "Filtrar unidades"}
                  </Text>
                  <GoAtletaIcon
                    name={unitDrawerOpen ? "chevronUp" : "chevronDown"}
                    size={12}
                    color={colors.textMuted ?? colors.muted}
                  />
                </View>
              </View>
              <Text style={[styles.selectedUnitCount, { color: colors.textMuted ?? colors.muted }]}>
                {selectedClasses.length} turma{selectedClasses.length === 1 ? "" : "s"}
              </Text>
            </View>
          </Pressable>
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

      {unitDrawerOpen ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar gaveta de unidades"
            onPress={() => setUnitDrawerOpen(false)}
            suppressWebHoverFeedback
            disableWebPressScale
            style={styles.unitDrawerBackdrop}
          />
          <View
            style={[
              styles.unitDrawer,
              {
                backgroundColor: colors.background,
                borderRightColor: colors.borderSubtle ?? colors.border,
              },
            ]}
          >
            <View style={[styles.unitDrawerHeader, { borderBottomColor: colors.borderSubtle ?? colors.border }]}>
              <Text style={[styles.unitPaneTitle, { color: colors.textPrimary ?? colors.text, marginBottom: 0 }]}>
                Unidades
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar seleção de unidades"
                onPress={() => setUnitDrawerOpen(false)}
                style={(state) => [
                  styles.unitDrawerCloseButton,
                  {
                    backgroundColor: state.hovered ? colors.secondaryBg : "transparent",
                  },
                ]}
              >
                <GoAtletaIcon name="close" size={18} color={colors.textMuted ?? colors.muted} />
              </Pressable>
            </View>
            {unitPicker}
          </View>
        </>
      ) : null}
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
  unitPane: {
    width: 256,
    minWidth: 256,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
  },
  unitPaneTitle: {
    fontSize: 15,
    fontWeight: "900",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  unitPickerContent: {
    flex: 1,
    minHeight: 0,
  },
  unitSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  unitSearchField: {
    height: 38,
    flex: 1,
    minWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.internal,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
  },
  unitSearchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    paddingVertical: Platform.OS === "web" ? 0 : 7,
  },
  sortButton: {
    height: 38,
    minWidth: 62,
    paddingHorizontal: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.internal,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  sortButtonText: {
    fontSize: 11,
    fontWeight: "800",
  },
  unitListDesktop: {
    flex: 1,
    minHeight: 0,
  },
  unitListMobile: {
    maxHeight: 260,
  },
  unitListContent: {
    paddingBottom: 6,
  },
  unitRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingLeft: 13,
    paddingRight: 14,
    borderLeftWidth: 3,
  },
  unitName: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "700",
  },
  unitCount: {
    fontSize: 11,
    fontWeight: "700",
  },
  unitFooter: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  unitFilterTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.internal,
  },
  unitBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unitBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  unitDrawerBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.52)",
    zIndex: 12000,
  },
  unitDrawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 290,
    zIndex: 12001,
    borderRightWidth: 1,
    paddingTop: 14,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 16px 36px rgba(0, 0, 0, 0.45)" }
      : {
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 18,
          shadowOffset: { width: 4, height: 0 },
          elevation: 16,
        }),
  },
  unitDrawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  unitDrawerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  classesPanel: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  classesHeader: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectedUnitIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedUnitHeading: {
    flex: 1,
    minWidth: 0,
  },
  selectedUnitTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  selectedUnitCount: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: "600",
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
