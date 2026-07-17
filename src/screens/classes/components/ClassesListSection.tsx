import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import type { ClassGroup } from "../../../core/models";
import { markRender } from "../../../observability/perf";
import { radius } from "../../../theme/tokens";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";
import type { ClassCardViewModel } from "../application/class-card-view-model";
import { ClassCard } from "./ClassCard";

type GroupedClasses = [string, ClassGroup[]][];
type Conflict = { name: string; day: number; modality?: string; kind: "conflict" | "integration" };

const ALL_UNITS_KEY = "__all_units__";
const OPEN_MENU_Z_INDEX = 11000;
const DESKTOP_SPLIT_BREAKPOINT = 1040;
const TABLE_BREAKPOINT = 1040;

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
  const { width: windowWidth } = useWindowDimensions();
  const sectionRef = useRef<View>(null);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const availableWidth = layoutWidth || windowWidth;
  const isDesktopSplit = availableWidth >= DESKTOP_SPLIT_BREAKPOINT;
  const showTable = availableWidth >= TABLE_BREAKPOINT;
  const [selectedUnitKey, setSelectedUnitKey] = useState(ALL_UNITS_KEY);
  const [unitSearch, setUnitSearch] = useState("");
  const [ascending, setAscending] = useState(true);
  const [mobileUnitsOpen, setMobileUnitsOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return undefined;
    const element = sectionRef.current as unknown as HTMLElement | null;
    if (!element?.getBoundingClientRect) return undefined;

    const updateLayoutWidth = () => {
      const nextWidth = Math.round(element.getBoundingClientRect().width);
      setLayoutWidth((current) => (current === nextWidth ? current : nextWidth));
    };

    updateLayoutWidth();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(updateLayoutWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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
  const selectedClasses = selectedUnit?.items ?? allClasses;
  const selectedTitle = selectedUnit?.label ?? "Todas as unidades";
  const closeActionMenu = useCallback(() => setOpenActionMenuId(null), []);
  const toggleActionMenu = useCallback((classId: string) => {
    setOpenActionMenuId((current) => (current === classId ? null : classId));
  }, []);

  const chooseUnit = useCallback((key: string) => {
    setSelectedUnitKey(key);
    setMobileUnitsOpen(false);
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
        showsVerticalScrollIndicator={isDesktopSplit}
        style={isDesktopSplit ? styles.unitListDesktop : styles.unitListMobile}
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

  const classesPanel = (
    <View style={[styles.classesPanel, { backgroundColor: colors.background }]}>
      <View style={[styles.classesHeader, { borderBottomColor: colors.borderSubtle ?? colors.border }]}>
        <View
          style={[
            styles.selectedUnitIcon,
            { backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg },
          ]}
        >
          <GoAtletaIcon name="organization" size={20} color={colors.textMuted ?? colors.muted} />
        </View>
        <View style={styles.selectedUnitHeading}>
          <Text numberOfLines={1} style={[styles.selectedUnitTitle, { color: colors.textPrimary ?? colors.text }]}>
            {selectedTitle}
          </Text>
          <Text style={[styles.selectedUnitCount, { color: colors.textMuted ?? colors.muted }]}>
            {selectedClasses.length} turma{selectedClasses.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      {showTable ? (
        <View style={[styles.tableHeader, { borderBottomColor: colors.borderSubtle ?? colors.border }]}>
          <Text style={[styles.tableHeading, styles.tableIdentityHeading, { color: colors.textMuted ?? colors.muted }]}>TURMA</Text>
          <Text style={[styles.tableHeading, styles.tableScheduleHeading, { color: colors.textMuted ?? colors.muted }]}>HORÁRIO</Text>
          <Text style={[styles.tableHeading, styles.tableFocusHeading, { color: colors.textMuted ?? colors.muted }]}>IDADE / FOCO</Text>
          <Text style={[styles.tableHeading, styles.tableStudentsHeading, { color: colors.textMuted ?? colors.muted }]}>ALUNOS</Text>
          <Text style={[styles.tableHeading, styles.tableTeacherHeading, { color: colors.textMuted ?? colors.muted }]}>PROFESSOR</Text>
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
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={() => void onRefresh()}
              tintColor={colors.text}
              colors={[colors.text]}
            />
          ) : undefined
        }
      />
    </View>
  );

  return (
    <View
      ref={sectionRef}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        setLayoutWidth((current) => (current === nextWidth ? current : nextWidth));
      }}
      style={[styles.root, { backgroundColor: colors.background }, style]}
    >
      {isDesktopSplit ? (
        <>
          <View
            style={[
              styles.unitPane,
              {
                backgroundColor: colors.background,
                borderRightColor: colors.borderSubtle ?? colors.border,
              },
            ]}
          >
            <Text style={[styles.unitPaneTitle, { color: colors.textPrimary ?? colors.text }]}>Unidades</Text>
            {unitPicker}
          </View>
          {classesPanel}
        </>
      ) : (
        <View style={styles.stackedLayout}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Selecionar unidade"
            onPress={() => setMobileUnitsOpen((current) => !current)}
            style={[
              styles.mobileUnitToggle,
              {
                backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg,
                borderColor: colors.borderSubtle ?? colors.border,
              },
            ]}
          >
            <View style={styles.mobileUnitToggleLabel}>
              <GoAtletaIcon name="organization" size={17} color={colors.textMuted ?? colors.muted} />
              <Text numberOfLines={1} style={[styles.mobileUnitToggleText, { color: colors.textPrimary ?? colors.text }]}>
                {selectedTitle}
              </Text>
            </View>
            <GoAtletaIcon name={mobileUnitsOpen ? "chevronUp" : "chevronDown"} size={16} color={colors.textMuted ?? colors.muted} />
          </Pressable>
          {mobileUnitsOpen ? (
            <View
              style={[
                styles.mobileUnitPicker,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.borderSubtle ?? colors.border,
                },
              ]}
            >
              {unitPicker}
            </View>
          ) : null}
          {classesPanel}
        </View>
      )}
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
  classesPanel: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  classesHeader: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectedUnitIcon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedUnitHeading: {
    flex: 1,
    minWidth: 0,
  },
  selectedUnitTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  selectedUnitCount: {
    marginTop: 3,
    fontSize: 12,
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
  tableIdentityHeading: { flex: 2.2, minWidth: 210 },
  tableScheduleHeading: { flex: 1.12, minWidth: 112 },
  tableFocusHeading: { flex: 1.24, minWidth: 120 },
  tableStudentsHeading: { flex: 1.05, minWidth: 108 },
  tableTeacherHeading: { flex: 1.58, minWidth: 170 },
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
  stackedLayout: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  mobileUnitToggle: {
    minHeight: 44,
    marginHorizontal: 10,
    marginTop: 4,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.internal,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  mobileUnitToggleLabel: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mobileUnitToggleText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "800",
  },
  mobileUnitPicker: {
    marginHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.internal,
    overflow: "hidden",
    maxHeight: 360,
  },
  emptyState: {
    padding: 16,
    borderRadius: radius.internal,
  },
});
