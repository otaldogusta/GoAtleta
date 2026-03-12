import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  markOnboardingSeen,
  saveOnboardingProfile,
  type OnboardingProfile,
} from "../src/auth/onboarding";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

type FocusValue = OnboardingProfile["focus"];
type FrequencyValue = OnboardingProfile["frequency"];
type RoleValue = OnboardingProfile["role"];

const totalSteps = 4;

export default function OnboardingScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<RoleValue>("trainer");
  const [focus, setFocus] = useState<FocusValue>("planning");
  const [frequency, setFrequency] = useState<FrequencyValue>("3-4");

  const roleLabel = useMemo(() => (role === "trainer" ? "Treinador" : "Aluno"), [role]);

  const completeOnboarding = async (nextPath: "/signup" | "/login", pendingHint = false) => {
    await saveOnboardingProfile({ role, focus, frequency });
    await markOnboardingSeen();
    if (pendingHint) {
      router.replace({ pathname: "/login", params: { pendingHint: "1" } });
      return;
    }
    router.replace(nextPath);
  };

  const skipOnboarding = async () => {
    await markOnboardingSeen();
    router.replace("/login");
  };

  const nextStep = () => {
    if (step >= totalSteps - 1) return;
    setStep((current) => current + 1);
  };

  const prevStep = () => {
    if (step <= 0) {
      router.replace("/welcome");
      return;
    }
    setStep((current) => current - 1);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <Pressable onPress={prevStep} style={{ paddingVertical: 6, paddingHorizontal: 2 }}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {Array.from({ length: totalSteps }).map((_, index) => (
              <View
                key={String(index)}
                style={{
                  height: 7,
                  width: index === step ? 24 : 7,
                  borderRadius: 999,
                  backgroundColor: index === step ? colors.primaryBg : colors.border,
                }}
              />
            ))}
          </View>
          <Pressable onPress={skipOnboarding} style={{ paddingVertical: 6, paddingHorizontal: 2 }}>
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 12 }}>Pular</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between", gap: 16 }}>
          <View style={{ gap: 14, marginTop: 6 }}>
            {step === 0 ? (
              <>
                <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800", lineHeight: 36 }}>
                  Seu plano começa com clareza
                </Text>
                <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>
                  Configure seu perfil em menos de 1 minuto para receber uma experiência alinhada ao seu momento.
                </Text>
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 18,
                    padding: 16,
                    gap: 10,
                  }}
                >
                  {[
                    "Planejamento guiado por rotina",
                    "Acompanhamento de turmas e presença",
                    "Atalhos para quem já tem conta",
                  ].map((item) => (
                    <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.primaryBg} />
                      <Text style={{ color: colors.text }}>{item}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800", lineHeight: 34 }}>
                  Qual perfil representa você?
                </Text>
                <Text style={{ color: colors.muted, fontSize: 14 }}>
                  Isso ajuda a organizar a navegação inicial.
                </Text>
                <View style={{ gap: 10 }}>
                  {[
                    {
                      value: "trainer" as const,
                      title: "Treinador",
                      desc: "Planeja sessões, acompanha turmas e indicadores.",
                      icon: "barbell-outline" as const,
                    },
                    {
                      value: "student" as const,
                      title: "Aluno",
                      desc: "Acessa plano, presença e comunicados da turma.",
                      icon: "school-outline" as const,
                    },
                  ].map((item) => {
                    const selected = role === item.value;
                    return (
                      <Pressable
                        key={item.value}
                        onPress={() => setRole(item.value)}
                        style={{
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: selected ? colors.primaryBg : colors.border,
                          backgroundColor: selected ? colors.secondaryBg : colors.card,
                          padding: 14,
                          gap: 6,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Ionicons name={item.icon} size={18} color={selected ? colors.primaryBg : colors.text} />
                          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
                            {item.title}
                          </Text>
                        </View>
                        <Text style={{ color: colors.muted }}>{item.desc}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800", lineHeight: 34 }}>
                  Vamos alinhar sua rotina
                </Text>
                <Text style={{ color: colors.muted, fontSize: 14 }}>
                  Perfil atual: {roleLabel}
                </Text>

                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Principal foco</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {[
                      { value: "planning" as const, label: "Planejamento" },
                      { value: "attendance" as const, label: "Presença" },
                      { value: "performance" as const, label: "Performance" },
                    ].map((item) => {
                      const selected = focus === item.value;
                      return (
                        <Pressable
                          key={item.value}
                          onPress={() => setFocus(item.value)}
                          style={{
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: selected ? colors.primaryBg : colors.border,
                            backgroundColor: selected ? colors.primaryBg : colors.card,
                            paddingHorizontal: 12,
                            paddingVertical: 9,
                          }}
                        >
                          <Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: "700" }}>
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Frequência semanal</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {[
                      { value: "1-2" as const, label: "1-2x" },
                      { value: "3-4" as const, label: "3-4x" },
                      { value: "5+" as const, label: "5x+" },
                    ].map((item) => {
                      const selected = frequency === item.value;
                      return (
                        <Pressable
                          key={item.value}
                          onPress={() => setFrequency(item.value)}
                          style={{
                            flex: 1,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: selected ? colors.primaryBg : colors.border,
                            backgroundColor: selected ? colors.primaryBg : colors.card,
                            paddingVertical: 10,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: "700" }}>
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800", lineHeight: 34 }}>
                  Tudo pronto para começar
                </Text>
                <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>
                  Você pode criar uma conta nova ou entrar com uma conta existente. Se sua conta já existe e ainda está sem acesso, o app vai direcionar para a tela de vínculo automaticamente.
                </Text>
                <View
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    padding: 14,
                    gap: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    Conta existente sem acesso?
                  </Text>
                  <Text style={{ color: colors.muted, lineHeight: 20 }}>
                    Entre normalmente e, se necessário, valide o convite do treinador na tela de pendência.
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          <View style={{ gap: 10, paddingTop: 8 }}>
            {step < totalSteps - 1 ? (
              <Pressable
                onPress={nextStep}
                style={{
                  paddingVertical: 14,
                  borderRadius: 16,
                  backgroundColor: colors.primaryBg,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "800" }}>Continuar</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={() => completeOnboarding("/signup")}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 16,
                    backgroundColor: colors.primaryBg,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.primaryText, fontWeight: "800" }}>Criar conta</Text>
                </Pressable>
                <Pressable
                  onPress={() => completeOnboarding("/login")}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800" }}>Entrar</Text>
                </Pressable>
                <Pressable
                  onPress={() => completeOnboarding("/login", true)}
                  style={{ alignItems: "center", paddingVertical: 8 }}
                >
                  <Text style={{ color: colors.muted, fontWeight: "700" }}>
                    Já tenho conta e estou sem acesso
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
