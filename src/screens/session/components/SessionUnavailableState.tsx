import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenBackdrop } from "../../../components/ui/ScreenBackdrop";
import { ptBR } from "../../../constants/copy/pt-br";
import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import type { SessionDataStatus } from "../hooks/useSessionData";

type SessionUnavailableStateProps = {
  colors: ThemeColors;
  status: SessionDataStatus;
  errorMessage: string | null;
  onBack: () => void;
  onRetry: () => void;
};

export function SessionUnavailableState({
  colors,
  status,
  errorMessage,
  onBack,
  onRetry,
}: SessionUnavailableStateProps) {
  const isNotFound = status === "not_found";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenBackdrop />
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          gap: 14,
          paddingHorizontal: 20,
          paddingVertical: 32,
        }}
      >
        <Pressable
          onPress={onBack}
          style={{
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
          }}
        >
          <GoAtletaIcon name="chevronBack" size={16} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "700" }}>{ptBR.common.actions.back}</Text>
        </Pressable>

        <View
          style={{
            gap: 8,
            padding: 18,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>
            {isNotFound ? ptBR.session.unavailable.classNotFoundTitle : ptBR.session.unavailable.loadFailedTitle}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            {isNotFound
              ? ptBR.session.unavailable.classNotFoundDescription
              : errorMessage ?? ptBR.session.unavailable.loadFailedDescription}
          </Text>
          <Pressable
            onPress={onRetry}
            style={{
              alignSelf: "flex-start",
              marginTop: 6,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: colors.primaryBg,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
              {ptBR.common.actions.retry}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
