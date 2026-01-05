import {
  Animated,
  Text,
  View
} from "react-native";
import { Pressable } from "../src/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { useAppTheme } from "../src/ui/app-theme";

export default function WelcomeScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [enterAnim]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            position: "absolute",
            top: -120,
            left: -80,
            width: 260,
            height: 260,
            borderRadius: 999,
            backgroundColor: colors.primaryBg,
            opacity: 0.08,
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: -140,
            right: -120,
            width: 320,
            height: 320,
            borderRadius: 999,
            backgroundColor: colors.successBg,
            opacity: 0.08,
          }}
        />

        <Animated.View
          style={{
            flex: 1,
            padding: 28,
            justifyContent: "space-between",
            opacity: enterAnim,
            transform: [
              {
                translateY: enterAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          }}
        >
          <View style={{ gap: 12, marginTop: 24 }}>
            <Text
              style={{
                fontSize: 36,
                fontWeight: "800",
                color: colors.text,
                lineHeight: 42,
              }}
            >
              Planeje aulas com mais clareza
            </Text>
            <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>
              Crie planos, organize turmas e acompanhe resultados sem perder tempo.
            </Text>
          </View>

          <View style={{ gap: 16 }}>
            <View
              style={{
                padding: 20,
                borderRadius: 24,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
                Seu app, seu ritmo
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>
                Controle presencia, aplique planos e acompanhe resultados com clareza.
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              <Pressable
                onPress={() => router.replace("/login")}
                style={{
                  paddingVertical: 14,
                  borderRadius: 16,
                  backgroundColor: colors.primaryBg,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                  Entrar agora
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.replace("/signup")}
                style={{
                  paddingVertical: 14,
                  borderRadius: 16,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Criar conta
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
