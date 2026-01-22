import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Image,
  ScrollView,
  Share,
  Text,
  TextInput,
  View
} from "react-native";
import { Pressable } from "../../src/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import {
  deleteExercise,
  getExercises,
  saveExercise,
  updateExercise,
} from "../../src/db/seed";
import type { Exercise } from "../../src/core/models";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../src/api/config";
import { getValidAccessToken } from "../../src/auth/session";
import { useAppTheme } from "../../src/ui/app-theme";
import { useConfirmUndo } from "../../src/ui/confirm-undo";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";

const getYoutubeId = (url: string) => {
  const match =
    url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/) ||
    url.match(/[?&]v=([a-zA-Z0-9_-]+)/) ||
    url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : "";
};

const getThumbnail = (url: string) => {
  const normalized = url.trim();
  if (!normalized) return "";
  const id = getYoutubeId(normalized);
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  return "";
};

export default function ExercisesScreen() {
  const { colors } = useAppTheme();
  const { confirm } = useConfirmUndo();
  const { confirm: confirmDialog } = useConfirmDialog();
  const [items, setItems] = useState<Exercise[]>([]);
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [source, setSource] = useState("");
  const [searchText, setSearchText] = useState("");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCreatedAt, setEditingCreatedAt] = useState<string | null>(null);
  const [metaStatus, setMetaStatus] = useState("");
  const [metaLoading, setMetaLoading] = useState(false);
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const canSave = Boolean(videoUrl.trim()) && !metaLoading;

  const load = useCallback(async () => {
    const data = await getExercises();
    setItems(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filteredItems = useMemo(() => {
    let list = items;
    const query = searchText.trim().toLowerCase();
    if (!query) return list;
    return list.filter((item) => {
      const haystack = [
        item.title,
        item.description,
        item.notes,
        item.source,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [items, searchText]);

  const clearForm = () => {
    setTitle("");
    setVideoUrl("");
    setSource("");
    setNotes("");
    setDescription("");
    setPublishedAt("");
    setEditingId(null);
    setEditingCreatedAt(null);
    setMetaStatus("");
  };

  const isFormDirty =
    title.trim() ||
    videoUrl.trim() ||
    source.trim() ||
    notes.trim() ||
    description.trim() ||
    publishedAt.trim() ||
    editingId;

  const save = async () => {
    if (metaLoading) {
      Alert.alert("Aguarde", "Carregando informações do link.");
      return;
    }
    if (!videoUrl.trim()) {
      Alert.alert("Link obrigatorio", "Cole o link do video.");
      return;
    }
    const fallbackTitle = title.trim() || "Video";
    const nowIso = new Date().toISOString();
    const exercise: Exercise = {
      id: editingId ?? "ex_" + Date.now(),
      title: fallbackTitle,
      videoUrl: videoUrl.trim(),
      tags: [],
      source: source.trim(),
      description: description.trim(),
      publishedAt,
      notes: notes.trim(),
      createdAt: editingCreatedAt ?? nowIso,
    };
    if (editingId) {
      await updateExercise(exercise);
    } else {
      await saveExercise(exercise);
    }
    clearForm();
    await load();
    Alert.alert("Exercicio salvo", "Exercicio salvo com sucesso.");
  };

  useEffect(() => {
    if (!videoUrl.trim()) {
      setMetaStatus("");
      return;
    }
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(async () => {
      try {
        setMetaLoading(true);
        setMetaStatus("");
        const accessToken = await getValidAccessToken();
        if (!accessToken) {
          setMetaStatus("Sessão expirada. Faca login novamente.");
          return;
        }
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/link-metadata`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
              apikey: SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ url: videoUrl.trim() }),
          }
        );
        const text = await response.text();
        if (!response.ok) {
          throw new Error(text || "Falha ao buscar dados do link.");
        }
        const data = JSON.parse(text) as {
          title?: string;
          author?: string;
          host?: string;
          description?: string;
          publishedAt?: string;
        };
        if (!title.trim() && data.title) {
          setTitle(data.title);
        }
        if (!source.trim() && (data.author || data.host)) {
          setSource(data.author || data.host || "");
        }
        setMetaStatus("Informações preenchidas automaticamente.");
      } catch (error) {
        setMetaStatus(
          error instanceof Error
            ? error.message
            : "Não foi possível ler o link."
        );
      } finally {
        setMetaLoading(false);
      }
    }, 700);
    return () => {
      if (metaTimer.current) clearTimeout(metaTimer.current);
    };
  }, [videoUrl, title, source]);

  const openLink = async (url: string) => {
    if (!url) return;
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const canOpen = await Linking.canOpenURL(normalized);
    if (!canOpen) {
      Alert.alert("Link inválido", "Não foi possível abrir o link.");
      return;
    }
    await Linking.openURL(normalized);
  };

  const shareLink = async (url: string, title: string) => {
    if (!url) {
      Alert.alert("Link vazio", "Adicione um link para compartilhar.");
      return;
    }
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    await Share.share({ message: `${title}\n${normalized}` });
  };

  const confirmDelete = (exercise: Exercise) => {
    confirm({
      title: "Excluir exercicio?",
      message: exercise.title
        ? `Deseja remover ${exercise.title}?`
        : "Deseja remover este exercicio?",
      confirmLabel: "Excluir",
      undoMessage: "Exercicio excluido. Deseja desfazer?",
      onOptimistic: () => {
        setItems((prev) => prev.filter((item) => item.id !== exercise.id));
      },
      onConfirm: async () => {
        try {
          await deleteExercise(exercise.id);
          await load();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Erro desconhecido.";
          Alert.alert("Não foi possível excluir", message);
        }
      },
      onUndo: async () => {
        await load();
      },
    });
  };

  return (
    <SafeAreaView
      style={{ flex: 1, padding: 16, backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
            Exercicios
          </Text>
          <Text style={{ color: colors.muted }}>
            Biblioteca com videos e links
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 12,
            backgroundColor: colors.card,
          }}
        >
          <TextInput
            placeholder="Buscar exercicio, tag ou fonte..."
            placeholderTextColor={colors.placeholder}
            value={searchText}
            onChangeText={setSearchText}
            style={{ flex: 1, paddingVertical: 2, color: colors.inputText }}
          />
          <Text style={{ color: colors.text, fontSize: 16, marginLeft: 6 }}>
            {"\uD83D\uDD0D"}
          </Text>
        </View>

        <View
          style={{
            padding: 12,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
          }}
        >
            <TextInput
              placeholder="Link do video (YouTube, Instagram, etc.)"
              placeholderTextColor={colors.placeholder}
              value={videoUrl}
              onChangeText={setVideoUrl}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 8,
                borderRadius: 10,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={save}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: canSave
                    ? colors.primaryBg
                    : colors.primaryDisabledBg,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.primaryText,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {editingId ? "Salvar alterações" : "Salvar exercicio"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (isFormDirty) {
                    confirmDialog({
                      title: "Sair sem salvar?",
                      message: "Você tem alterações não salvas.",
                      confirmLabel: "Descartar",
                      cancelLabel: "Continuar",
                      onConfirm: () => {
                        clearForm();
                      },
                    });
                    return;
                  }
                  clearForm();
                }}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: colors.secondaryBg,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.secondaryText,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  Cancelar
                </Text>
              </Pressable>
            </View>
        </View>

        <View style={{ gap: 10 }}>
          {filteredItems.map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                setExpandedId((prev) => (prev === item.id ? null : item.id))
              }
              style={{
                padding: 10,
                borderRadius: 14,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: "row", gap: 10 }}>
                {getThumbnail(item.videoUrl) ? (
                  <Image
                    source={{ uri: getThumbnail(item.videoUrl) }}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 10,
                      backgroundColor: colors.thumbFallback,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 10,
                      backgroundColor: colors.thumbFallback,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted }}>
                      VIDEO
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                    {item.title}
                  </Text>
                  {item.source ? (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Fonte: {item.source}
                    </Text>
                  ) : null}
                  {item.notes ? (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {item.notes}
                    </Text>
                  ) : null}
                </View>
              </View>
              {expandedId === item.id ? (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => openLink(item.videoUrl)}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: colors.primaryBg,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: colors.primaryText,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        Abrir
                      </Text>
                    </Pressable>
                  <Pressable
                    onPress={() => shareLink(item.videoUrl, item.title)}
                    style={{
                      flex: 1,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: colors.secondaryBg,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: colors.secondaryText,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        Share
                      </Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => {
                        setEditingId(item.id);
                        setEditingCreatedAt(item.createdAt);
                        setTitle(item.title);
                        setVideoUrl(item.videoUrl);
                        setSource(item.source ?? "");
                        setDescription(item.description ?? "");
                        setPublishedAt(item.publishedAt ?? "");
                        setNotes(item.notes);
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: colors.secondaryBg,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: colors.secondaryText,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        Editar
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(item)}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: colors.dangerBg,
                        borderWidth: 1,
                        borderColor: colors.dangerBorder,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: colors.dangerText,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        Excluir
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </Pressable>
          ))}
          {!filteredItems.length ? (
            <Text style={{ color: colors.muted }}>
              Nenhum exercicio cadastrado.
            </Text>
          ) : null}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
