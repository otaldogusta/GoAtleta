import { memo, useCallback, useMemo, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { FlatList, RefreshControl, Text, useWindowDimensions, View } from "react-native";

import type { ClassGroup } from "../../../core/models";
import { markRender } from "../../../observability/perf";
import { radius } from "../../../theme/tokens";
import type { ThemeColors } from "../../../ui/app-theme";
import { getUnitPalette } from "../../../ui/unit-colors";
import type { ClassCardViewModel } from "../application/class-card-view-model";
import { ClassCard } from "./ClassCard";

type GroupedClasses = [string, ClassGroup[]][];
type Conflict = { name: string; day: number; modality?: string; kind: "conflict" | "integration" };

type RowItem =
  | { key: string; kind: "section"; unit: string; count: number; items: ClassGroup[] };

const OPEN_MENU_Z_INDEX = 11000;

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
  const { width } = useWindowDimensions();
  const columnCount = width >= 1180 ? 3 : width >= 760 ? 2 : 1;
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const rows = useMemo<RowItem[]>(() => {
    return grouped.map(([unit, items]) => ({
      key: `section_${unit}`,
      kind: "section",
      unit,
      count: items.length,
      items,
    }));
  }, [grouped]);

  const keyExtractor = useCallback((item: RowItem) => item.key, []);
  const closeActionMenu = useCallback(() => {
    setOpenActionMenuId(null);
  }, []);
  const closeActionMenuIfOpen = useCallback(() => {
    if (openActionMenuId) setOpenActionMenuId(null);
  }, [openActionMenuId]);
  const toggleActionMenu = useCallback((classId: string) => {
    setOpenActionMenuId((current) => (current === classId ? null : classId));
  }, []);

  const renderCell = useCallback(
    (props: any) => {
      const { children, item, style: cellStyle, ...rest } = props;
      const hasOpenMenu = item?.items?.some((classItem: ClassGroup) => classItem.id === openActionMenuId);

      return (
        <View
          {...rest}
          style={[
            cellStyle,
            {
              position: "relative",
              zIndex: hasOpenMenu ? OPEN_MENU_Z_INDEX : 1,
              elevation: hasOpenMenu ? OPEN_MENU_Z_INDEX : 1,
            },
          ]}
        >
          {children}
        </View>
      );
    },
    [openActionMenuId]
  );

  const renderItem = useCallback(
    ({ item }: { item: RowItem }) => {
      const hasOpenMenu = item.items.some((classItem) => classItem.id === openActionMenuId);

      return (
        <View
          style={{
            position: "relative",
            gap: 12,
            marginBottom: 14,
            padding: 12,
            borderRadius: radius.container,
            borderWidth: 1,
            borderLeftWidth: 3,
            borderColor: colors.borderSubtle ?? colors.border,
            borderLeftColor: getUnitPalette(item.unit, colors).bg,
            backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg,
            zIndex: hasOpenMenu ? OPEN_MENU_Z_INDEX : 1,
            elevation: hasOpenMenu ? OPEN_MENU_Z_INDEX : 1,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <View style={{ minWidth: 0, flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "900", color: colors.textPrimary ?? colors.text }}>
                {item.unit}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: radius.full,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.borderSubtle ?? colors.border,
              }}
            >
              <Text style={{ color: colors.textMuted ?? colors.muted, fontSize: 11, fontWeight: "800" }}>
                {item.count} turma{item.count === 1 ? "" : "s"}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {item.items.map((classItem) => (
              <View
                key={classItem.id}
                style={{
                  position: "relative",
                  width:
                    columnCount === 1
                      ? "100%"
                      : columnCount === 2
                        ? "49%"
                        : "32.55%",
                  minWidth: columnCount === 1 ? undefined : 260,
                  zIndex: openActionMenuId === classItem.id ? OPEN_MENU_Z_INDEX + 1 : 1,
                  elevation: openActionMenuId === classItem.id ? OPEN_MENU_Z_INDEX + 1 : 1,
                }}
              >
                <ClassCard
                  item={classItem}
                  conflicts={conflictsById[classItem.id]}
                  dayNames={dayNames}
                  colors={colors}
                  onOpen={onOpenClass}
                  viewModel={classCardViewModelsById[classItem.id]}
                  actionMenuOpen={openActionMenuId === classItem.id}
                  onToggleActionMenu={toggleActionMenu}
                  onCloseActionMenu={closeActionMenu}
                  onEdit={onEditClass}
                  onDuplicate={onDuplicateClass}
                  onDelete={onDeleteClass}
                />
              </View>
            ))}
          </View>
        </View>
      );
    },
    [
      closeActionMenu,
      classCardViewModelsById,
      colors,
      columnCount,
      conflictsById,
      dayNames,
      onDeleteClass,
      onDuplicateClass,
      onEditClass,
      onOpenClass,
      openActionMenuId,
      toggleActionMenu,
    ]
  );

  if (!rows.length) {
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.borderSubtle ?? colors.border,
          borderRadius: radius.card,
          backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg,
          padding: 12,
        }}
      >
        <Text style={{ color: colors.textMuted ?? colors.muted, fontSize: 13 }}>Nenhuma turma encontrada.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={[{ flex: 1, minHeight: 0 }, style]}
      data={rows}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews={false}
      contentContainerStyle={contentContainerStyle}
      onScrollBeginDrag={() => {
        closeActionMenuIfOpen();
        onScrollBeginDrag?.();
      }}
      onMomentumScrollBegin={closeActionMenuIfOpen}
      onScroll={closeActionMenuIfOpen}
      scrollEventThrottle={16}
      CellRendererComponent={renderCell}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={() => {
              void onRefresh();
            }}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        ) : undefined
      }
    />
  );
});
