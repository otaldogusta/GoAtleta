import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../src/api/config";
import { getValidAccessToken } from "../../src/auth/session";
import type { Exercise } from "../../src/core/models";
import {
  listApprovedMediaAssets,
  listDraftMediaAssets,
} from "../../src/exercise-media/exercise-media-approval";
import { bootstrapExerciseMediaStore } from "../../src/exercise-media/bootstrap-exercise-media-store";
import type { ExerciseMediaAsset } from "../../src/exercise-media/exercise-media.types";
import { bootstrapMediaGenerationHandoffStore } from "../../src/media-generation/handoff/bootstrap-media-generation-handoff-store";
import {
  deleteExercise,
  getExercises,
  saveExercise,
  updateExercise,
} from "../../src/db/seed";
import { useDebouncedValue } from "../../src/hooks/useDebouncedValue";
import {
  archiveExerciseMediaReviewAsset,
  approveExerciseMediaReviewAsset,
} from "../../src/screens/exercises/exercise-media-review-actions";
import { ExerciseLibraryHeader } from "../../src/screens/exercises/components/ExerciseLibraryHeader";
import { ExerciseMediaGenerateCard } from "../../src/screens/exercises/components/ExerciseMediaGenerateCard";
import { ExerciseMediaGenerationJobsSection } from "../../src/screens/exercises/components/ExerciseMediaGenerationJobsSection";
import { ExerciseMediaHandoffJobsSection } from "../../src/screens/exercises/components/ExerciseMediaHandoffJobsSection";
import { ExerciseLinkForm } from "../../src/screens/exercises/components/ExerciseLinkForm";
import { ExerciseListSection } from "../../src/screens/exercises/components/ExerciseListSection";
import { ExerciseMediaReviewSection } from "../../src/screens/exercises/components/ExerciseMediaReviewSection";
import { ExerciseSummaryCards } from "../../src/screens/exercises/components/ExerciseSummaryCards";
import { cancelExerciseMediaHandoffJobForReview } from "../../src/screens/exercises/exercise-media-handoff-actions";
import {
  cancelExerciseMediaGenerationJobForReview,
  retryExerciseMediaGenerationJobForReview,
} from "../../src/screens/exercises/exercise-media-generation-job-actions";
import { useAppTheme } from "../../src/ui/app-theme";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";
import { useConfirmUndo } from "../../src/ui/confirm-undo";

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

function matchesMediaQuery(asset: ExerciseMediaAsset, query: string) {
  const haystack = [
    asset.title,
    asset.exerciseKey,
    asset.kind,
    asset.source,
    asset.modality,
    asset.sport,
    asset.ageBand,
    asset.level,
    ...(asset.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export default function ExercisesScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { confirm } = useConfirmUndo();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { width } = useWindowDimensions();
  const isWideLayout = Platform.OS === "web" && width >= 1100;
  const contentMaxWidth = isWideLayout ? 1420 : 960;

  const [items, setItems] = useState<Exercise[]>([]);
  const [draftMedia, setDraftMedia] = useState<ExerciseMediaAsset[]>([]);
  const [approvedMedia, setApprovedMedia] = useState<ExerciseMediaAsset[]>([]);
  const [refreshing, setRefreshing] = useState(false);
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
  const [formExpanded, setFormExpanded] = useState(isWideLayout);
  const [jobsRefreshToken, setJobsRefreshToken] = useState(0);
  const [handoffRefreshToken, setHandoffRefreshToken] = useState(0);
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSave = Boolean(videoUrl.trim()) && !metaLoading;
  const debouncedSearchText = useDebouncedValue(searchText, 250);

  useEffect(() => {
    if (isWideLayout) {
      setFormExpanded(true);
    }
  }, [isWideLayout]);

  const load = useCallback(async () => {
    try {
      const data = await getExercises();
      setItems(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Missing auth token")) return;
      throw err;
    }
  }, []);

  const reloadMediaSections = useCallback(() => {
    setDraftMedia(listDraftMediaAssets());
    setApprovedMedia(listApprovedMediaAssets());
  }, []);

  const reloadGeneratedArtifacts = useCallback(() => {
    reloadMediaSections();
    setJobsRefreshToken((current) => current + 1);
    setHandoffRefreshToken((current) => current + 1);
  }, [reloadMediaSections]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await bootstrapExerciseMediaStore();
        await bootstrapMediaGenerationHandoffStore();
        await load();
        reloadGeneratedArtifacts();
      })();
    }, [load, reloadGeneratedArtifacts]),
  );

  const filteredItems = useMemo(() => {
    const query = debouncedSearchText.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) => {
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
  }, [debouncedSearchText, items]);

  const filteredDraftMedia = useMemo(() => {
    const query = debouncedSearchText.trim().toLowerCase();
    if (!query) return draftMedia;
    return draftMedia.filter((asset) => matchesMediaQuery(asset, query));
  }, [debouncedSearchText, draftMedia]);

  const filteredApprovedMedia = useMemo(() => {
    const query = debouncedSearchText.trim().toLowerCase();
    if (!query) return approvedMedia;
    return approvedMedia.filter((asset) => matchesMediaQuery(asset, query));
  }, [debouncedSearchText, approvedMedia]);

  const clearForm = useCallback(() => {
    setTitle("");
    setVideoUrl("");
    setSource("");
    setNotes("");
    setDescription("");
    setPublishedAt("");
    setEditingId(null);
    setEditingCreatedAt(null);
    setMetaStatus("");
    if (!isWideLayout) {
      setFormExpanded(false);
    }
  }, [isWideLayout]);

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
      Alert.alert("Link obrigatório", "Cole o link do vídeo.");
      return;
    }
    const fallbackTitle = title.trim() || "Vídeo";
    const nowIso = new Date().toISOString();
    const exercise: Exercise = {
      id: editingId ?? `ex_${Date.now()}`,
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
    Alert.alert("Exercício salvo", "Exercício salvo com sucesso.");
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
          setMetaStatus("Sessão expirada. Faça login novamente.");
          return;
        }
        const response = await fetch(`${SUPABASE_URL}/functions/v1/link-metadata`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ url: videoUrl.trim() }),
        });
        const text = await response.text();
        if (!response.ok) {
          throw new Error(text || "Falha ao buscar dados do link.");
        }
        const data = JSON.parse(text) as {
          title: string;
          author: string;
          host: string;
          description: string;
          publishedAt: string;
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
            : "Não foi possível ler o link.",
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

  const shareLink = async (url: string, itemTitle: string) => {
    if (!url) {
      Alert.alert("Link vazio", "Adicione um link para compartilhar.");
      return;
    }
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    await Share.share({ message: `${itemTitle}\n${normalized}` });
  };

  const confirmDelete = (exercise: Exercise) => {
    confirm({
      title: "Excluir exercício?",
      message: exercise.title
        ? `Deseja remover ${exercise.title}?`
        : "Deseja remover este exercício?",
      confirmLabel: "Excluir",
      undoMessage: "Exercício excluído. Deseja desfazer?",
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

  const handleEditExercise = (item: Exercise) => {
    setEditingId(item.id);
    setEditingCreatedAt(item.createdAt);
    setTitle(item.title);
    setVideoUrl(item.videoUrl);
    setSource(item.source ?? "");
    setDescription(item.description ?? "");
    setPublishedAt(item.publishedAt ?? "");
    setNotes(item.notes);
    setFormExpanded(true);
  };

  const handleApproveMedia = (asset: ExerciseMediaAsset) => {
    void confirmDialog({
      title: "Aprovar mídia?",
      message: `Deseja liberar ${asset.title} para treinos e PDFs?`,
      confirmLabel: "Aprovar",
      cancelLabel: "Cancelar",
      onConfirm: async () => {
        try {
          const updated = await approveExerciseMediaReviewAsset(asset.id);
          if (!updated) {
            Alert.alert("Não foi possível aprovar", "A mídia não está mais disponível.");
            return;
          }
          reloadMediaSections();
          setJobsRefreshToken((current) => current + 1);
        } catch (error) {
          Alert.alert(
            "Não foi possível aprovar",
            error instanceof Error ? error.message : "Erro ao persistir a mídia.",
          );
        }
      },
    });
  };

  const handleArchiveMedia = (asset: ExerciseMediaAsset) => {
    void confirmDialog({
      title: "Arquivar mídia?",
      message: `Deseja arquivar ${asset.title}?`,
      confirmLabel: "Arquivar",
      cancelLabel: "Cancelar",
      tone: "danger",
      onConfirm: async () => {
        try {
          const updated = await archiveExerciseMediaReviewAsset(asset.id);
          if (!updated) {
            Alert.alert("Não foi possível arquivar", "A mídia não está mais disponível.");
            return;
          }
          reloadMediaSections();
          setJobsRefreshToken((current) => current + 1);
        } catch (error) {
          Alert.alert(
            "Não foi possível arquivar",
            error instanceof Error ? error.message : "Erro ao persistir a mídia.",
          );
        }
      },
    });
  };

  const summaryItems = useMemo(
    () => [
      { label: "Para revisar", value: draftMedia.length, tone: "warning" as const },
      { label: "Liberadas", value: approvedMedia.length, tone: "success" as const },
      { label: "Links", value: items.length },
    ],
    [draftMedia.length, approvedMedia.length, items.length],
  );

  const listEmptyMessage = debouncedSearchText.trim()
    ? "Nenhum exercício encontrado para essa busca."
    : "Nenhum exercício cadastrado ainda.";
  const draftEmptyMessage = debouncedSearchText.trim()
    ? "Nenhuma mídia pendente encontrada para essa busca."
    : "Nenhuma mídia pendente.";
  const approvedEmptyMessage = debouncedSearchText.trim()
    ? "Nenhuma mídia aprovada encontrada para essa busca."
    : "Nenhuma mídia aprovada ainda.";

  const isFormVisible =
    isWideLayout || formExpanded || Boolean(editingId) || Boolean(videoUrl.trim());

  return (
    <SafeAreaView
      style={{ flex: 1, padding: 16, backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{
            gap: 16,
            paddingBottom: 28,
            width: "100%",
            maxWidth: contentMaxWidth,
            alignSelf: "center",
          }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                try {
                  await bootstrapExerciseMediaStore();
                  await bootstrapMediaGenerationHandoffStore();
                  await load();
                  reloadGeneratedArtifacts();
                } finally {
                  setRefreshing(false);
                }
              }}
              tintColor={colors.text}
              colors={[colors.text]}
            />
          }
        >
          <ExerciseLibraryHeader
            colors={colors}
            onBack={() => {
              if (router.canGoBack()) {
                router.back();
                return;
              }
              router.replace("/");
            }}
            onToggleForm={() => setFormExpanded((current) => !current)}
            isFormExpanded={isFormVisible}
            showToggleAction={!isWideLayout}
          />

          <View
            style={{
              padding: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <TextInput
              placeholder="Buscar exercício ou demonstração..."
              placeholderTextColor={colors.placeholder}
              value={searchText}
              onChangeText={setSearchText}
              style={{ color: colors.inputText, paddingVertical: 4 }}
            />
          </View>

          <ExerciseSummaryCards colors={colors} items={summaryItems} />

          <View
            style={{
              flexDirection: isWideLayout ? "row" : "column",
              alignItems: "flex-start",
              gap: 16,
            }}
          >
            <View
              style={{
                flex: isWideLayout ? 2 : undefined,
                width: "100%",
                gap: 16,
              }}
            >
              {!isWideLayout ? (
                <ExerciseMediaGenerateCard
                  colors={colors}
                  onGenerated={reloadGeneratedArtifacts}
                />
              ) : null}

              <ExerciseMediaReviewSection
                colors={colors}
                title="Demonstrações para revisar"
                subtitle="Apenas mídias aprovadas aparecem no treino e no PDF."
                emptyMessage={draftEmptyMessage}
                items={filteredDraftMedia}
                onView={() => {}}
                onApprove={handleApproveMedia}
                onArchive={handleArchiveMedia}
                pills={[
                  { label: "Pendentes", active: true },
                  { label: "Liberadas" },
                  { label: "Arquivadas" },
                ]}
                compactCards
              />

              <ExerciseMediaReviewSection
                colors={colors}
                title="Liberadas"
                emptyMessage={approvedEmptyMessage}
                items={filteredApprovedMedia}
                onView={() => {}}
                onArchive={handleArchiveMedia}
                compactCards
              />

              <ExerciseListSection
                colors={colors}
                items={filteredItems}
                emptyMessage={listEmptyMessage}
                getThumbnail={getThumbnail}
                onOpen={openLink}
                onShare={shareLink}
                onEdit={handleEditExercise}
                onDelete={confirmDelete}
              />
            </View>

            <View
              style={{
                width: isWideLayout ? 404 : "100%",
                maxWidth: isWideLayout ? 440 : undefined,
                gap: 16,
                alignSelf: "stretch",
              }}
            >
              {isWideLayout ? (
                <ExerciseMediaGenerateCard
                  colors={colors}
                  onGenerated={reloadGeneratedArtifacts}
                />
              ) : null}

              <ExerciseMediaHandoffJobsSection
                colors={colors}
                refreshToken={handoffRefreshToken}
                onCancel={(job) => {
                  void confirmDialog({
                    title: "Cancelar pedido?",
                    message: `Deseja cancelar o pedido de ${job.request.exerciseName ?? job.request.title ?? "demonstração"}?`,
                    confirmLabel: "Cancelar pedido",
                    cancelLabel: "Voltar",
                    tone: "danger",
                    onConfirm: async () => {
                      const updated = await cancelExerciseMediaHandoffJobForReview(job.id);
                      if (!updated) {
                        Alert.alert("Não foi possível cancelar", "O pedido não está mais disponível.");
                        return;
                      }
                      setHandoffRefreshToken((current) => current + 1);
                    },
                  });
                }}
              />

              {!isWideLayout ? null : (
                <ExerciseMediaGenerationJobsSection
                  colors={colors}
                  refreshToken={jobsRefreshToken}
                  onCancel={(job) => {
                    const updated = cancelExerciseMediaGenerationJobForReview(job.id);
                    if (!updated) {
                      Alert.alert("Não foi possível cancelar", "A geração não está mais disponível.");
                      return;
                    }
                    setJobsRefreshToken((current) => current + 1);
                  }}
                  onRetry={(job) => {
                    void confirmDialog({
                      title: "Tentar novamente?",
                      message: `Deseja gerar novamente ${job.request.exerciseName ?? job.request.title ?? "esta demonstração"}?`,
                      confirmLabel: "Gerar novamente",
                      cancelLabel: "Cancelar",
                      onConfirm: async () => {
                        const result = await retryExerciseMediaGenerationJobForReview(job.id);
                        if (!result.ok) {
                          Alert.alert("Não foi possível gerar", result.message);
                          setJobsRefreshToken((current) => current + 1);
                          return;
                        }
                        Alert.alert("Rascunho criado", result.message);
                        reloadGeneratedArtifacts();
                      },
                    });
                  }}
                />
              )}

              {!isWideLayout ? (
                <ExerciseMediaGenerationJobsSection
                  colors={colors}
                  refreshToken={jobsRefreshToken}
                  onCancel={(job) => {
                    const updated = cancelExerciseMediaGenerationJobForReview(job.id);
                    if (!updated) {
                      Alert.alert("Não foi possível cancelar", "A geração não está mais disponível.");
                      return;
                    }
                    setJobsRefreshToken((current) => current + 1);
                  }}
                  onRetry={(job) => {
                    void confirmDialog({
                      title: "Tentar novamente?",
                      message: `Deseja gerar novamente ${job.request.exerciseName ?? job.request.title ?? "esta demonstração"}?`,
                      confirmLabel: "Gerar novamente",
                      cancelLabel: "Cancelar",
                      onConfirm: async () => {
                        const result = await retryExerciseMediaGenerationJobForReview(job.id);
                        if (!result.ok) {
                          Alert.alert("Não foi possível gerar", result.message);
                          setJobsRefreshToken((current) => current + 1);
                          return;
                        }
                        Alert.alert("Rascunho criado", result.message);
                        reloadGeneratedArtifacts();
                      },
                    });
                  }}
                />
              ) : null}

              <ExerciseLinkForm
                colors={colors}
                isVisible={isFormVisible}
                isWideLayout={isWideLayout}
                isEditing={Boolean(editingId)}
                videoUrl={videoUrl}
                title={title}
                source={source}
                notes={notes}
                metaStatus={metaStatus}
                metaLoading={metaLoading}
                canSave={canSave}
                onVideoUrlChange={setVideoUrl}
                onTitleChange={setTitle}
                onSourceChange={setSource}
                onNotesChange={setNotes}
                onSave={save}
                onCancel={() => {
                  if (isFormDirty) {
                    void confirmDialog({
                      title: "Sair sem salvar?",
                      message: "Você tem alterações não salvas.",
                      confirmLabel: "Descartar",
                      cancelLabel: "Continuar",
                      onConfirm: async () => {
                        clearForm();
                      },
                    });
                    return;
                  }
                  clearForm();
                }}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
