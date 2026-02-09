import { useRouter } from "expo-router";
import {
    useEffect,
    useMemo,
    useState
} from "react";
import {
    Alert,
    Keyboard,
    Platform,
    ScrollView,
    Text,
    TextInput,
    View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "../../src/ui/Pressable";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../src/api/config";
import { getValidAccessToken } from "../../src/auth/session";
import type { ClassGroup, TrainingPlan } from "../../src/core/models";
import { getClasses, saveTrainingPlan } from "../../src/db/seed";
import { notifyTrainingCreated, notifyTrainingSaved } from "../../src/notifications";
import { useAppTheme } from "../../src/ui/app-theme";
import { Button } from "../../src/ui/Button";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { sortClassesByAgeBand } from "../../src/ui/sort-classes";

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
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
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

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === classId) ?? null,
    [classes, classId]
  );
  const className = selectedClass?.name ?? "Turma";

  const sortedClasses = useMemo(
    () => sortClassesByAgeBand(classes),
    [classes]
  );

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
      const reply =
        typeof data.reply === "string" && data.reply.trim()
           ? data.reply
          : "Sem resposta do assistente. Tente novamente.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setSources(Array.isArray(data.sources) ? data.sources : []);
      const nextDraft = data.draftTraining ?? null;
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
      <View style={{ flex: 1, padding: 16 }}>
      <View style={{ gap: 6, marginBottom: 12 }}>
        <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
          Assistente
        </Text>
        <Text style={{ color: colors.muted }}>
          Crie planejamentos e planos com referências
        </Text>
      </View>

      <View
        style={{
          gap: 8,
          padding: 14,
          borderRadius: 18,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
          Turma selecionada
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {sortedClasses.map((item) => {
            const active = item.id === classId;
            return (
              <Pressable
                key={item.id}
                onPress={() => setClassId(item.id)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ color: active ? colors.primaryText : colors.text }}>
                    {item.name}
                  </Text>
                  <ClassGenderBadge gender={item.gender} size="sm" />
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          gap: 10,
          paddingBottom: composerHeight + keyboardHeight + insets.bottom + 12,
        }}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((message, index) => (
          <View
            key={String(index)}
            style={{
              alignSelf: message.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              padding: 12,
              borderRadius: 16,
              backgroundColor: message.role === "user" ? colors.primaryBg : colors.card,
              borderWidth: message.role === "user" ? 0 : 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: message.role === "user" ? colors.primaryText : colors.text }}>
              {message.content}
            </Text>
          </View>
        ))}

        { draft ? (
          <View
            style={{
              padding: 14,
              borderRadius: 18,
              backgroundColor: colors.card,
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
                Aquecimento{" "}
                {draft.warmupTime ? "(" + draft.warmupTime + ")" : ""}
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
                Parte principal{" "}
                {draft.mainTime ? "(" + draft.mainTime + ")" : ""}
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
                Volta a calma{" "}
                {draft.cooldownTime ? "(" + draft.cooldownTime + ")" : ""}
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
                      backgroundColor: "#eef2f7",
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
              backgroundColor: colors.card,
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
              backgroundColor: colors.card,
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
          flexDirection: "row",
          gap: 8,
          padding: 12,
          borderRadius: 16,
          backgroundColor: colors.card,
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
          style={{ flex: 1, padding: 8, color: colors.inputText }}
        />
        <Pressable
          onPress={sendMessage}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
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
    </SafeAreaView>
  );
}
