import { Text } from "react-native";

import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";
import type { SessionBlockKey, SessionTrainingBlockPreview } from "./session-training-ui-types";
import { SessionTrainingBlockCard } from "./SessionTrainingBlockCard";

type SessionAppliedPlanSectionProps = {
  colors: ThemeColors;
  blocks: SessionTrainingBlockPreview[];
  isRemovingAppliedPlan: boolean;
  onSelectBlock: (key: SessionBlockKey) => void;
  onRemoveAppliedPlan: () => void;
};

export function SessionAppliedPlanSection({
  colors,
  blocks,
  isRemovingAppliedPlan,
  onSelectBlock,
  onRemoveAppliedPlan,
}: SessionAppliedPlanSectionProps) {
  return (
    <>
      {blocks.map((section) => (
        <SessionTrainingBlockCard
          key={section.key}
          colors={colors}
          block={section}
          onPress={() => onSelectBlock(section.key)}
        />
      ))}
      <Pressable
        onPress={onRemoveAppliedPlan}
        disabled={isRemovingAppliedPlan}
        style={{
          alignSelf: "flex-start",
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: isRemovingAppliedPlan
            ? colors.secondaryBg
            : colors.dangerSolidBg,
          opacity: isRemovingAppliedPlan ? 0.75 : 1,
        }}
      >
        <Text
          style={{
            color: isRemovingAppliedPlan
              ? colors.muted
              : colors.dangerSolidText,
            fontSize: 12,
            fontWeight: "800",
          }}
        >
          {isRemovingAppliedPlan ? "Removendo..." : "Remover plano do dia"}
        </Text>
      </Pressable>
    </>
  );
}
