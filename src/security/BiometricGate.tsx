import { ActivityIndicator, Text, View } from "react-native";

import { useAppTheme } from "../ui/app-theme";
import { Pressable } from "../ui/Pressable";

export function BiometricGate({
  onUnlock,
  onForceLogin,
  isPrompting,
}: {
  onUnlock: () => void;
  onForceLogin: () => void;
  isPrompting: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        gap: 14,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}>
        App bloqueado
      </Text>
      <Text style={{ color: colors.muted, textAlign: "center", maxWidth: 320 }}>
        Confirme sua biometria para continuar usando o GoAtleta.
      </Text>
      <Pressable
        onPress={onUnlock}
        style={{
          minWidth: 220,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 12,
          backgroundColor: colors.primaryBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isPrompting ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={{ color: colors.primaryText, fontWeight: "700" }}>Desbloquear</Text>
        )}
      </Pressable>
      <Pressable
        onPress={onForceLogin}
        style={{
          minWidth: 220,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 12,
          backgroundColor: colors.secondaryBg,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "700" }}>Entrar novamente</Text>
      </Pressable>
    </View>
  );
}
