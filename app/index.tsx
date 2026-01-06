import {
  useEffect,
  useMemo,
  useRef,
  useState } from "react";
import {
  Animated,
  Alert,
  Dimensions,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  View
} from "react-native";
import { Pressable } from "../src/ui/Pressable";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Updates from "expo-updates";

import { seedIfEmpty } from "../src/db/seed";
import { Card } from "../src/ui/Card";
import { useAppTheme } from "../src/ui/app-theme";
import {
  AppNotification,
  clearNotifications,
  getNotifications,
  markAllRead,
  subscribeNotifications,
} from "../src/notificationsInbox";
import { requestNotificationPermission } from "../src/notifications";

export default function Home() {
  const router = useRouter();
  const { colors, mode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [inbox, setInbox] = useState<AppNotification[]>([]);
  const [showInbox, setShowInbox] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "success" | "error";
  } | null>(null);
  const screenWidth = Dimensions.get("window").width;
  const panelWidth = Math.min(screenWidth * 0.85, 360);
  const inboxX = useRef(new Animated.Value(panelWidth)).current;

  const todayLabel = useMemo(() => {
    const date = new Date();
    const label = date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await seedIfEmpty();
      const items = await getNotifications();
      if (alive) setInbox(items);
    })();
    const unsubscribe = subscribeNotifications((items) => {
      if (!alive) return;
      setInbox(items);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const unreadCount = inbox.filter((item) => !item.read).length;

  const openInbox = async () => {
    await requestNotificationPermission();
    setShowInbox(true);
    Animated.timing(inboxX, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
    await markAllRead();
  };

  const closeInbox = () => {
    Animated.timing(inboxX, {
      toValue: panelWidth,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowInbox(false);
    });
  };

  const openSwipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dx < -12,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -30) {
          void openInbox();
        }
      },
    })
  ).current;

  const closeSwipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dx > 12,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 30) {
          closeInbox();
        }
      },
    })
  ).current;

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

  const truncateBody = (value: string, max = 140) => {
    if (value.length <= max) return value;
    return value.slice(0, max).trimEnd() + "...";
  };

  const showToast = (message: string, type: "info" | "success" | "error") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        showToast("Atualizacao encontrada. Reiniciando...", "success");
        await Updates.reloadAsync();
        return;
      }
      showToast("Sem atualizacoes novas.", "info");
    } catch (error) {
      showToast("Nao foi possivel buscar atualizacoes agora.", "error");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <View>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
            Hoje
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4 }}>
            {todayLabel}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={() => router.push({ pathname: "/notifications" })}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
              {"\u2699"}
            </Text>
          </Pressable>
          <Pressable
            onPress={openInbox}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: colors.primaryBg,
              position: "relative",
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 16 }}>
              {"\uD83D\uDD14"}
            </Text>
            {unreadCount > 0 ? (
              <View
                style={{
                  position: "absolute",
                  right: -4,
                  top: -4,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: colors.dangerSolidBg,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: colors.dangerSolidText, fontSize: 11, fontWeight: "700" }}>
                  {unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

        <View style={{ gap: 14 }}>
        <View
          style={{
            padding: 16,
            borderRadius: 20,
            backgroundColor: colors.primaryBg,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 8 },
            elevation: 5,
          }}
        >
          <Text style={{ color: colors.primaryText, fontSize: 18, fontWeight: "700" }}>
            Agenda do dia
          </Text>
          <Text style={{ color: colors.primaryText, marginTop: 6, opacity: 0.85 }}>
            Turmas, treino e chamada em um lugar
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 12,
            }}
          >
            <Pressable
              onPress={() => router.push({ pathname: "/classes" })}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: colors.successBg,
              }}
            >
              <Text style={{ color: colors.successText, fontWeight: "700" }}>
                Ver turmas
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/calendar" })}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ color: colors.secondaryText, fontWeight: "700" }}>
                Ver aula do dia
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Atalhos
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Pressable
              onPress={() => router.push({ pathname: "/training" })}
              style={{
                flexBasis: "48%",
                padding: 14,
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                Planejamento
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Modelos e treinos
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/students" })}
              style={{
                flexBasis: "48%",
                padding: 14,
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                Alunos
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Lista e chamada
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/reports" })}
              style={{
                flexBasis: "48%",
                padding: 14,
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                Relatorios
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Presenca e dados
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/exercises" })}
              style={{
                flexBasis: "48%",
                padding: 14,
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                Exercicios
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Biblioteca com videos
              </Text>
            </Pressable>
          </View>
        </View>

        <Card
          title="Periodizacao"
          subtitle="Ciclos e cargas"
          onPress={() => router.push({ pathname: "/periodization" })}
        />
        </View>
      </ScrollView>

      <View
        {...openSwipe.panHandlers}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 24,
          height: "100%",
        }}
      />

      <Pressable
        onPress={() => router.push({ pathname: "/assistant" })}
        style={{
          position: "absolute",
          right: 16,
          bottom: 24,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: colors.primaryBg,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }}
      >
        <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 16 }}>
          AI
        </Text>
      </Pressable>

      {showInbox ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={closeInbox} />
          <Animated.View
            {...closeSwipe.panHandlers}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: panelWidth,
              transform: [{ translateX: inboxX }],
              backgroundColor: colors.card,
              padding: 14,
              borderTopLeftRadius: 22,
              borderBottomLeftRadius: 22,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: -6, height: 0 },
              elevation: 6,
              gap: 12,
              paddingTop: insets.top + 12,
            }}
            >
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                  Notificacoes
                </Text>
              </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      const handleClear = async () => {
                        await clearNotifications();
                        const items = await getNotifications();
                        setInbox(items);
                        setExpandedId(null);
                      };
                      if (Platform.OS === "web") {
                        void handleClear();
                        return;
                      }
                      Alert.alert(
                        "Limpar notificacoes?",
                        "Isso remove todas as notificacoes do inbox.",
                        [
                          { text: "Cancelar", style: "cancel" },
                          {
                            text: "Limpar",
                            style: "destructive",
                            onPress: async () => {
                              await handleClear();
                            },
                          },
                        ]
                      );
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.secondaryBg,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 14,
                        height: 12,
                        borderWidth: 2,
                        borderColor: colors.secondaryText,
                        borderRadius: 2,
                        position: "relative",
                      }}
                    >
                      <View
                        style={{
                          position: "absolute",
                          top: -6,
                          left: -2,
                          right: -2,
                          height: 3,
                          borderRadius: 2,
                          backgroundColor: colors.secondaryText,
                        }}
                      />
                      <View
                        style={{
                          position: "absolute",
                          top: -8,
                          left: 4,
                          width: 6,
                          height: 2,
                          borderRadius: 2,
                          backgroundColor: colors.secondaryText,
                        }}
                      />
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={closeInbox}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.primaryBg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        position: "relative",
                      }}
                    >
                      <View
                        style={{
                          position: "absolute",
                          top: 5,
                          left: -1,
                          right: -1,
                          height: 2,
                          borderRadius: 2,
                          backgroundColor: colors.primaryText,
                          transform: [{ rotate: "45deg" }],
                        }}
                      />
                      <View
                        style={{
                          position: "absolute",
                          top: 5,
                          left: -1,
                          right: -1,
                          height: 2,
                          borderRadius: 2,
                          backgroundColor: colors.primaryText,
                          transform: [{ rotate: "-45deg" }],
                        }}
                      />
                    </View>
                  </Pressable>
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: colors.border }} />
            {inbox.length === 0 ? (
              <Text style={{ color: colors.muted }}>Sem notificacoes.</Text>
            ) : (
              <View style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
                  {inbox.map((item) => {
                    const isExpanded = expandedId === item.id;
                    const preview = truncateBody(item.body, 160);
                    const showMore = !isExpanded && preview !== item.body;
                    return (
                      <View key={item.id}>
                        <Pressable
                          onPress={() =>
                            setExpandedId((prev) => (prev === item.id ? null : item.id))
                          }
                          onLongPress={async () => {
                            await Clipboard.setStringAsync(item.body);
                          }}
                          style={{
                            padding: 10,
                            borderRadius: 12,
                            backgroundColor: item.read
                              ? colors.inputBg
                              : mode === "dark"
                              ? "#1e293b"
                              : (colors.background === "#0b1220" ? "#1e293b" : "#eef2ff"),
                            borderWidth: 1,
                            borderColor: item.read
                              ? colors.border
                              : mode === "dark"
                              ? "#334155"
                              : (colors.background === "#0b1220" ? "#334155" : "#c7d2fe"),
                            gap: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: "700",
                              color: colors.text,
                              fontSize: 14,
                            }}
                          >
                            {item.title}
                          </Text>
                          <Text style={{ color: colors.text, fontSize: 13 }}>
                            {isExpanded ? item.body : preview}
                          </Text>
                          {showMore ? (
                            <Text style={{ color: colors.muted, fontSize: 12 }}>
                              Ler mais
                            </Text>
                          ) : null}
                          <Text style={{ color: colors.muted, fontSize: 11 }}>
                            {formatTime(item.createdAt)}
                          </Text>
                        </Pressable>
                        <View
                          style={{
                            height: 1,
                            backgroundColor: colors.border,
                            marginTop: 10,
                          }}
                        />
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </Animated.View>
        </View>
      ) : null}

      {toast ? (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 96,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 14,
            backgroundColor:
              toast.type === "success"
                ? colors.successBg
                : toast.type === "error"
                ? colors.dangerBg
                : colors.card,
            borderWidth: 1,
            borderColor:
              toast.type === "success"
                ? colors.successBg
                : toast.type === "error"
                ? colors.dangerBorder
                : colors.border,
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          }}
        >
          <Text
            style={{
              color:
                toast.type === "success"
                  ? colors.successText
                  : toast.type === "error"
                  ? colors.dangerText
                  : colors.text,
              fontWeight: "600",
            }}
          >
            {toast.message}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}


