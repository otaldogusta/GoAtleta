import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import {
  AppNotification,
  clearNotifications,
  getNotifications,
  markAllRead,
} from "../src/notificationsInbox";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function CommunicationsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getNotifications();
      if (alive) setItems(data);
      await markAllRead();
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleClear = async () => {
    await clearNotifications();
    setItems([]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>
            Comunicados
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

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => {
              Alert.alert(
                "Limpar comunicados?",
                "Isso remove todas as mensagens salvas.",
                [
                  { text: "Cancelar", style: "cancel" },
                  { text: "Limpar", style: "destructive", onPress: handleClear },
                ]
              );
            }}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Limpar
            </Text>
          </Pressable>
        </View>

        { items.length === 0 ? (
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Sem comunicados
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6 }}>
              Quando a turma enviar novidades, elas aparecem aqui.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <View
              key={item.id}
              style={{
                padding: 12,
                borderRadius: 14,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 6,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {item.title}
              </Text>
              <Text style={{ color: colors.text }}>{item.body}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {formatTime(item.createdAt)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
