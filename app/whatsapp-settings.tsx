import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";
import { useWhatsAppSettings } from "../src/ui/whatsapp-settings-context";

export default function WhatsAppSettingsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { defaultMessageEnabled, setDefaultMessageEnabled, loading } = useWhatsAppSettings();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Text style={{ color: colors.text, padding: 16 }}>Carregando...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <Pressable onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </Pressable>
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>
            Configurações WhatsApp
          </Text>
        </View>

        {/* Toggle Card */}
        <View
          style={{
            borderRadius: 16,
            padding: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                Mensagem padrão
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Inclui mensagem automática ao abrir WhatsApp
              </Text>
            </View>
            <Pressable
              onPress={() => setDefaultMessageEnabled(!defaultMessageEnabled)}
              style={{
                width: 56,
                height: 32,
                borderRadius: 16,
                backgroundColor: defaultMessageEnabled ? "#25D366" : colors.secondaryBg,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: "white",
                  marginLeft: defaultMessageEnabled ? 12 : 0,
                  position: "absolute",
                }}
              />
            </Pressable>
          </View>

          {/* Preview */}
          <View style={{ marginTop: 8, gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>
              Exemplos de mensagem:
            </Text>
            <View style={{ gap: 6 }}>
              <View
                style={{
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 11, color: colors.text }}>
                  {`Global: "Olá! Sou o professor Gustavo da turma [turma] ([unidade])."`}
                </Text>
              </View>
              <View
                style={{
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 11, color: colors.text }}>
                  {`Individual: "Olá, [Responsável/Aluno]! Sou o treinador da turma [turma]. ([data])."`}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Status Info */}
        <View
          style={{
            borderRadius: 12,
            padding: 12,
            backgroundColor: defaultMessageEnabled ? "#E8F5E9" : "#FFF3E0",
            gap: 8,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: defaultMessageEnabled ? "#2E7D32" : "#E65100",
            }}
          >
            {defaultMessageEnabled ? "✓ Ativado" : "✗ Desativado"}
          </Text>
          <Text style={{ fontSize: 12, color: defaultMessageEnabled ? "#2E7D32" : "#E65100" }}>
            {defaultMessageEnabled
              ? "Mensagens padrão serão enviadas ao abrir WhatsApp"
              : "Nenhuma mensagem será pré-preenchida"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}