import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {
    Animated,
    Alert,
    Keyboard,
    Platform,
    ScrollView,
    Text,
    TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "../../src/ui/Pressable";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../src/api/config";
import { useAuth } from "../../src/auth/auth";
import { getValidAccessToken } from "../../src/auth/session";
import type { ClassGroup, TrainingPlan } from "../../src/core/models";
import { getClasses, saveTrainingPlan } from "../../src/db/seed";
import { notifyTrainingCreated, notifyTrainingSaved } from "../../src/notifications";
import { useAppTheme } from "../../src/ui/app-theme";
import { Button } from "../../src/ui/Button";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AssistantSource = {
  title: string;
  author: string;
  url: string;
};

type DraftTraining = {
  title: string;
  tags: string[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmupTime: string;
  mainTime: string;
  cooldownTime: string;
};

type AssistantResponse = {
  reply: string;
  sources: AssistantSource[];
  draftTraining: DraftTraining | null;
};

const sanitizeList = (value: unknown) =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : [];

const looksLikeJsonPayload = (value: string) => {
  const text = value.trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return false;
  return (
    text.includes('"title"') ||
    text.includes('"warmup"') ||
    text.includes('"main"') ||
    text.includes('"cooldown"')
  );
};

const renderList = (items: string[]) =>
  items.length ? items.join(" - ") : "Sem itens";

const buildTraining = (draft: DraftTraining, classId: string): TrainingPlan => {
  const nowIso = new Date().toISOString();
  return {
    id: "t_ai_" + Date.now(),
    classId,
    title: String(draft.title || "Planejamento sugerido"),
    tags: sanitizeList(draft.tags),
    warmup: sanitizeList(draft.warmup),
    main: sanitizeList(draft.main),
    cooldown: sanitizeList(draft.cooldown),
    warmupTime: String(draft.warmupTime || ""),
    mainTime: String(draft.mainTime || ""),
    cooldownTime: String(draft.cooldownTime || ""),
    createdAt: nowIso,
  };
};

export default function AssistantScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [classId, setClassId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<DraftTraining | null>(null);
  const [sources, setSources] = useState<AssistantSource[]>([]);
  const [showSavedLink, setShowSavedLink] = useState(false);
  const [composerHeight, setComposerHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const thinkingPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getClasses();
      if (!alive) return;
      setClasses(data);
      if (!classId && data.length > 0) {
        setClassId(data[0].id);
      }
    })();
    return () => {
      alive = false;
    };
  }, [classId]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (event: any) => {
      const height = event.endCoordinates.height ?? 0;
      setKeyboardHeight(height);
    };
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      thinkingPulse.stopAnimation();
      thinkingPulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(thinkingPulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(thinkingPulse, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => {
      loop.stop();
      thinkingPulse.stopAnimation();
      thinkingPulse.setValue(0);
    };
  }, [loading, thinkingPulse]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === classId) ?? null,
    [classes, classId]
  );
  const className = selectedClass?.name ?? "Turma";

  const isDesktopLayout = Platform.OS === "web" && width >= 1100;

  const userDisplayName = useMemo(() => {
    const email = session?.user?.email ?? "";
    const beforeAt = email.split("@")[0] ?? "";
    if (!beforeAt) return "Coach";
    const normalized = beforeAt.replace(/[._-]+/g, " ").trim();
    if (!normalized) return "Coach";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }, [session?.user?.email]);

  const recentUserPrompts = useMemo(
    () => messages.filter((message) => message.role === "user").slice(-6).reverse(),
    [messages]
  );

  const quickPrompts = useMemo(
    () => [
      {
        title: "Gerar treino",
        subtitle: "Crie um plano por fase",
        icon: "sparkles-outline" as const,
        prompt: "Monte um treino de 60 minutos para a turma atual com aquecimento, parte principal e volta à calma.",
      },
      {
        title: "Melhorar prompt",
        subtitle: "Refine para resultados melhores",
        icon: "create-outline" as const,
        prompt: "Me ajude a melhorar este pedido para o assistente gerar um treino mais específico para a turma atual.",
      },
      {
        title: "Explorar estilos",
        subtitle: "Variações por objetivo",
        icon: "color-palette-outline" as const,
        prompt: "Sugira 3 variações de treino para foco em técnica, físico e jogo reduzido.",
      },
    ],
    []
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    setDraft(null);
    setSources([]);
    setShowSavedLink(false);
    setInput("");
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const nextMessages = [...messages, { role: "user", content: input.trim() }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setDraft(null);
    setSources([]);
    setShowSavedLink(false);

    try {
      const accessToken = await getValidAccessToken();
      if (!accessToken) {
        Alert.alert("Sessão expirada", "Faca login novamente para usar o assistente.");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sessão expirada. Faca login novamente e tente de novo.",
          },
        ]);
        return;
      }
      const response = await fetch(`${SUPABASE_URL}/functions/v1/assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          classId,
        }),
      });

      const payloadText = await response.text();
      if (!response.ok) {
        throw new Error(payloadText || "Falha no assistente");
      }

      const data = JSON.parse(payloadText) as AssistantResponse;
      const rawReply =
        typeof data.reply === "string" && data.reply.trim()
           ? data.reply
          : "Sem resposta do assistente. Tente novamente.";
      const nextDraft = data.draftTraining ?? null;
      const reply =
        nextDraft && looksLikeJsonPayload(rawReply)
          ? "Montei um planejamento para você. Revise os blocos abaixo."
          : rawReply;

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setSources(Array.isArray(data.sources) ? data.sources : []);
      setDraft(nextDraft);
      if (nextDraft) {
        void notifyTrainingCreated();
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Erro ao consultar o assistente. Confira o deploy e tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async () => {
    if (!draft || !classId) return;
    try {
      const plan = buildTraining(draft, classId);
      await saveTrainingPlan(plan);
      setDraft(null);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Planejamento salvo com sucesso." },
      ]);
      setShowSavedLink(true);
      void notifyTrainingSaved();
    } catch (error) {
      const detail =
        error instanceof Error && error.message
          ? error.message
          : "Erro desconhecido.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Não consegui salvar o planejamento. " +
            "Detalhe: " +
            detail.replace(/\s+/g, " "),
        },
      ]);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: isDesktopLayout ? 20 : 14,
          paddingTop: 12,
          paddingBottom: 12,
          gap: 12,
          flexDirection: isDesktopLayout ? "row" : "column",
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 14,
            gap: 12,
          }}
        >
          <ScrollView
            contentContainerStyle={{
              gap: 10,
              paddingBottom: composerHeight + keyboardHeight + insets.bottom + 12,
            }}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 ? (
              <View
                style={{
                  width: "100%",
                  maxWidth: isDesktopLayout ? 860 : undefined,
                  alignSelf: "center",
                  minHeight: Platform.OS === "web" ? Math.max(470, Math.round(height * 0.6)) : undefined,
                  paddingHorizontal: isDesktopLayout ? 20 : 6,
                  paddingTop: isDesktopLayout ? 26 : 10,
                  paddingBottom: 10,
                  gap: 16,
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="sparkles" size={30} color={colors.muted} />
                </View>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: isDesktopLayout ? 42 : 34,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  Bem-vindo, {userDisplayName}!
                </Text>
                <Text style={{ color: colors.muted, textAlign: "center" }}>
                  Como posso ajudar hoje?
                </Text>
                <View
                  style={{
                    width: "100%",
                    flexDirection: "row",
                    flexWrap: "nowrap",
                    gap: 12,
                    justifyContent: "center",
                    marginTop: 10,
                  }}
                >
                  {quickPrompts.map((item) => (
                    <Pressable
                      key={item.title}
                      onPress={() => setInput(item.prompt)}
                      style={{
                        flex: 1,
                        aspectRatio: 1,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        padding: 12,
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.secondaryBg,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Ionicons name={item.icon} size={16} color={colors.muted} />
                      </View>
                      <View style={{ gap: 6 }}>
                        <Text
                          numberOfLines={2}
                          style={{ color: colors.text, fontWeight: "800", fontSize: 13, lineHeight: 17 }}
                        >
                          {item.title}
                        </Text>
                        <Text
                          numberOfLines={3}
                          style={{ color: colors.muted, fontSize: 11, lineHeight: 15 }}
                        >
                          {item.subtitle}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {messages.map((message, index) => (
              <View
                key={String(index)}
                style={{
                  alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: message.role === "user" ? colors.primaryBg : colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: message.role === "user" ? colors.primaryText : colors.text }}>
                  {message.content}
                </Text>
              </View>
            ))}

            {loading ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  maxWidth: "58%",
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {[0, 1, 2].map((index) => {
                    const phase = index * 0.2;
                    const opacity = thinkingPulse.interpolate({
                      inputRange: [0, phase, phase + 0.2, 1],
                      outputRange: [0.3, 0.45, 1, 0.35],
                      extrapolate: "clamp",
                    });
                    const translateY = thinkingPulse.interpolate({
                      inputRange: [0, phase, phase + 0.2, 1],
                      outputRange: [0, 0, -3, 0],
                      extrapolate: "clamp",
                    });

                    return (
                      <Animated.View
                        key={`thinking-dot-${index}`}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.muted,
                          opacity,
                          transform: [{ translateY }],
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}

            { draft ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  Planejamento sugerido
                </Text>
                <Text style={{ color: colors.muted, marginTop: 6 }}>
                  {draft.title}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Text style={{ color: colors.muted }}>
                    {"Turma: " + className}
                  </Text>
                  { selectedClass ? (
                    <ClassGenderBadge gender={selectedClass.gender} size="sm" />
                  ) : null}
                </View>
                <View
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: colors.text }}>
                    Aquecimento {draft.warmupTime ? "(" + draft.warmupTime + ")" : ""}
                  </Text>
                  <Text style={{ color: colors.text }}>{renderList(draft.warmup)}</Text>
                </View>
                <View
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: colors.text }}>
                    Parte principal {draft.mainTime ? "(" + draft.mainTime + ")" : ""}
                  </Text>
                  <Text style={{ color: colors.text }}>{renderList(draft.main)}</Text>
                </View>
                <View
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: colors.text }}>
                    Volta a calma {draft.cooldownTime ? "(" + draft.cooldownTime + ")" : ""}
                  </Text>
                  <Text style={{ color: colors.text }}>
                    {renderList(draft.cooldown)}
                  </Text>
                </View>
                { draft.tags.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {draft.tags.map((tag) => (
                      <View
                        key={tag}
                        style={{
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                          borderRadius: 999,
                          backgroundColor: colors.secondaryBg,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 12 }}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={{ marginTop: 10 }}>
                  <Button label="Salvar planejamento" onPress={saveDraft} />
                </View>
              </View>
            ) : null}

            { showSavedLink ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  Planejamento salvo
                </Text>
                <Text style={{ color: colors.muted, marginTop: 6 }}>
                  Clique para ver na lista de planejamentos.
                </Text>
                <View style={{ marginTop: 10 }}>
                  <Button
                    label="Ver planejamentos"
                    onPress={() => router.push({ pathname: "/training" })}
                    variant="secondary"
                  />
                </View>
              </View>
            ) : null}

            { sources.length > 0 ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  Fontes citadas
                </Text>
                {sources.map((source, index) => (
                  <View key={String(index)} style={{ marginTop: 8 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      {source.title}
                    </Text>
                    <Text style={{ color: colors.muted }}>
                      {source.author + " - " + source.url}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View
            onLayout={(event) => {
              const next = Math.round(event.nativeEvent.layout.height);
              if (next !== composerHeight) setComposerHeight(next);
            }}
            style={{
              gap: 8,
              padding: 12,
              borderRadius: 16,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: keyboardHeight,
              paddingBottom: 12 + insets.bottom,
            }}
          >
            <TextInput
              placeholder="Descreva a aula ou o planejamento..."
              value={input}
              onChangeText={setInput}
              placeholderTextColor={colors.placeholder}
              multiline
              style={{
                minHeight: 54,
                maxHeight: 130,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                paddingHorizontal: 10,
                paddingVertical: 10,
                color: colors.inputText,
                textAlignVertical: "top",
              }}
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => setInput(quickPrompts[0].prompt)}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>Sugestão</Text>
                </Pressable>
                <Pressable
                  onPress={clearConversation}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>Limpar chat</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={sendMessage}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: colors.primaryBg,
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                  {loading ? "..." : "Enviar"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {isDesktopLayout ? (
          <View
            style={{
              width: 320,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 12,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800" }}>
              Histórico
            </Text>
            <TextInput
              placeholder="Buscar..."
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 8,
                color: colors.inputText,
                backgroundColor: colors.background,
              }}
            />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }}>
              {recentUserPrompts.length === 0 ? (
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    padding: 10,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Sem conversas recentes.
                  </Text>
                </View>
              ) : (
                recentUserPrompts.map((message, index) => (
                  <Pressable
                    key={`history-${index}`}
                    onPress={() => setInput(message.content)}
                    style={{
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      padding: 10,
                      gap: 4,
                    }}
                  >
                    <Text numberOfLines={2} style={{ color: colors.text, fontWeight: "700" }}>
                      {message.content}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      Prompt recente
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable
              onPress={clearConversation}
              style={{
                borderRadius: 999,
                backgroundColor: colors.primaryBg,
                alignItems: "center",
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                Novo chat
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
