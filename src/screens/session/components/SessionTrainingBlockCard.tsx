import { Text, View } from "react-native";

import { ptBR } from "../../../constants/copy/pt-br";
import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import type { SessionTrainingBlockPreview } from "./session-training-ui-types";

type Props = {
  colors: ThemeColors;
  block: SessionTrainingBlockPreview;
  onPress: () => void;
};

export function SessionTrainingBlockCard({ colors, block, onPress }: Props) {
  const phaseMeta =
    block.key === "warmup"
      ? { tint: colors.card, border: colors.warningText }
      : block.key === "main"
        ? { tint: colors.card, border: colors.primaryBg }
        : { tint: colors.card, border: colors.successText };

  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: 14,
        borderRadius: 18,
        backgroundColor: phaseMeta.tint,
        borderWidth: 1,
        borderColor: phaseMeta.border,
        shadowColor: colors.background,
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            {block.label}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {block.updated ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: colors.successBg,
              }}
            >
              <Text style={{ color: colors.successText, fontSize: 10, fontWeight: "700" }}>
                {ptBR.common.status.updated}
              </Text>
            </View>
          ) : null}
          <GoAtletaIcon name="chevronForward" size={16} color={colors.muted} />
        </View>
      </View>
      {block.previewItems.length ? (
        <View style={{ gap: 4 }}>
          {block.previewItems.map((item, index) => (
            <Text key={`${block.key}-preview-${index}`} style={{ color: colors.text, fontSize: 12 }}>
              • {item}
            </Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}
