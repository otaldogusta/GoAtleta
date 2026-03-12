import { memo, useCallback, useMemo } from "react";
import { FlatList, Text, View } from "react-native";

import type { ClassGroup } from "../../../src/core/models";
import { markRender } from "../../../src/observability/perf";
import { ClassCard } from "./ClassCard";

type GroupedClasses = [string, ClassGroup[]][];
type Conflict = { name: string; day: number };

type RowItem =
  | { key: string; kind: "header"; unit: string; count: number }
  | { key: string; kind: "class"; unit: string; item: ClassGroup };

type Props = {
  grouped: GroupedClasses;
  conflictsById: Record<string, Conflict[]>;
  dayNames: string[];
  colors: Record<string, string>;
  onOpenClass: (item: ClassGroup) => void;
};

export const ClassesListSection = memo(function ClassesListSection({
  grouped,
  conflictsById,
  dayNames,
  colors,
  onOpenClass,
}: Props) {
  markRender("screen.classes.render.listSection");

  const rows = useMemo<RowItem[]>(() => {
    const acc: RowItem[] = [];
    grouped.forEach(([unit, items]) => {
      acc.push({
        key: `header_${unit}`,
        kind: "header",
        unit,
        count: items.length,
      });
      items.forEach((item) => {
        acc.push({
          key: `class_${item.id}`,
          kind: "class",
          unit,
          item,
        });
      });
    });
    return acc;
  }, [grouped]);

  const keyExtractor = useCallback((item: RowItem) => item.key, []);

  const renderItem = useCallback(
    ({ item }: { item: RowItem }) => {
      if (item.kind === "header") {
        return (
          <View
            style={{
              paddingVertical: 6,
              paddingHorizontal: 8,
              borderRadius: 10,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: 10,
              marginTop: 2,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              {item.unit}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
              Turmas: {item.count}
            </Text>
          </View>
        );
      }

      return (
        <View style={{ marginBottom: 12 }}>
          <ClassCard
            item={item.item}
            conflicts={conflictsById[item.item.id]}
            dayNames={dayNames}
            colors={colors}
            onOpen={onOpenClass}
          />
        </View>
      );
    },
    [colors, conflictsById, dayNames, onOpenClass]
  );

  if (!rows.length) {
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          backgroundColor: colors.secondaryBg,
          padding: 12,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 13 }}>Nenhuma turma encontrada.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      scrollEnabled={false}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews={false}
    />
  );
});
