import { Text, View } from "react-native";

import { ModalDialogFrame } from "../../ui/ModalDialogFrame";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import type { SelectedCatalogActivity } from "./activity-catalog-view-model";

type Props = {
  activity: SelectedCatalogActivity | null;
  onCancel: () => void;
  onConfirm: (activity: SelectedCatalogActivity) => void;
};

export function ActivityCatalogSuggestionConfirmModal({
  activity,
  onCancel,
  onConfirm,
}: Props) {
  const { colors } = useAppTheme();
  if (!activity) return null;

  return (
    <ModalDialogFrame
      visible
      onClose={onCancel}
      colors={colors}
      title="Levar atividade como sugestão?"
      subtitle={activity.variantName}
      cardStyle={{ width: "100%", maxWidth: 520, maxHeight: "82%" }}
      contentContainerStyle={{ gap: 12, paddingTop: 14, paddingBottom: 16 }}
      footer={
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            testID="activity-catalog-cancel-suggestion"
            onPress={onCancel}
            style={{
              flex: 1,
              minHeight: 42,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Text style={{ color: colors.secondaryText, fontWeight: "900" }}>
              Cancelar
            </Text>
          </Pressable>
          <Pressable
            testID="activity-catalog-confirm-suggestion"
            onPress={() => onConfirm(activity)}
            style={{
              flex: 1,
              minHeight: 42,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primaryBg,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "900" }}>
              Levar sugestão
            </Text>
          </Pressable>
        </View>
      }
    >
      <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
        Esta atividade será marcada apenas como sugestão local. O plano não será
        alterado automaticamente.
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
        A integração real com aula ou planejamento fica para uma etapa futura.
      </Text>
    </ModalDialogFrame>
  );
}
