import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import type { ClassGroup } from "../src/core/models";
import { useAuth } from "../src/auth/auth";
import { useRole } from "../src/auth/role";
import { getClasses } from "../src/db/seed";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const { signOut } = useAuth();
  const { student } = useRole();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassGroup[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getClasses();
      if (alive) setClasses(data);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const currentClass = useMemo(() => {
    if (!student?.classId) return null;
    return classes.find((item) => item.id === student.classId) ?? null;
  }, [classes, student?.classId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>
            Perfil
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
          </Pressable>
        </View>

        <View
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 6,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12 }}>Nome</Text>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
            {student?.name || "Nao informado"}
          </Text>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>Turma</Text>
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            {currentClass?.name || "Nao vinculada"}
          </Text>
          <Text style={{ color: colors.muted }}>
            {currentClass?.unit || "Sem unidade"}
          </Text>
        </View>

        <View
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>Preferencias</Text>
          <Text style={{ color: colors.muted }}>
            Ajustes de notificacoes e tema ficam em Configuracoes.
          </Text>
          <Pressable
            onPress={() => router.push({ pathname: "/notifications" })}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Abrir configuracoes
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Pressable
            onPress={async () => {
              await signOut();
            }}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Sair</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
