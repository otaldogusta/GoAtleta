import { Text, TextInput, View } from "react-native";

import type { LessonBlock } from "../../../core/models";
import { useAppTheme } from "../../../ui/app-theme";
import { CollapsibleSection } from "../../../ui/CollapsibleSection";
import { LessonActivityEditor } from "./LessonActivityEditor";

type Props = {
  block: LessonBlock;
  onChange: (block: LessonBlock) => void;
  showTitle?: boolean;
  activitiesMaxHeight?: number;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
};

export function LessonBlockCard({
  block,
  onChange,
  showTitle = true,
  activitiesMaxHeight = 280,
  isExpanded = true,
  onToggleExpanded,
}: Props) {
  const { colors } = useAppTheme();

  return (
    <CollapsibleSection
      expanded={isExpanded}
      onToggle={onToggleExpanded ?? (() => {})}
      containerStyle={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
      header={
        showTitle ? (
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800", flex: 1 }}>
            {block.label}
          </Text>
        ) : (
          <View />
        )
      }
      headerStyle={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 12,
        gap: 12,
      }}
      showChevron={showTitle}
      chevronColor={colors.muted}
      contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}
      contentDurationIn={220}
      contentDurationOut={180}
      contentTranslateY={-8}
    >
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
          Duração (min)
        </Text>
        <TextInput
          value={String(block.durationMinutes)}
          keyboardType="numeric"
          inputMode="numeric"
          onChangeText={(value) => {
            const numeric = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);
            onChange({
              ...block,
              durationMinutes:
                Number.isFinite(numeric) && numeric > 0
                  ? numeric
                  : block.durationMinutes,
            });
          }}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            backgroundColor: colors.inputBg,
            color: colors.inputText,
            fontSize: 15,
            fontWeight: "600",
          }}
        />
      </View>

      <LessonActivityEditor
        activities={block.activities}
        onChange={(activities) => onChange({ ...block, activities })}
        maxHeight={activitiesMaxHeight}
      />
    </CollapsibleSection>
  );
}
