import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Linking,
    Platform,
    RefreshControl,
    ScrollView,
    Share,
    Text,
    TextInput,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "../../src/ui/Pressable";

import {
  getLinkKey,
  LINK_METADATA_FALLBACK_STATUS,
  requestLinkMetadata,
  type LinkMetadata,
} from "../../src/api/link-metadata";
import { getValidAccessToken } from "../../src/auth/session";
import { ScreenPageHeader } from "../../src/components/ui/ScreenPageHeader";
import {
  getExerciseLinkPresentation,
  mergeInferredExerciseLinkTags,
  matchesExerciseLinkSearch,
} from "../../src/core/exercise-link-classifier";
import type { Exercise } from "../../src/core/models";
import {
    deleteExercise,
    getExercises,
    saveExercise,
    updateExercise,
} from "../../src/db/seed";
import { navigateBackOrReplace } from "../../src/navigation/safe-router";
import { useDebouncedValue } from "../../src/hooks/useDebouncedValue";
import { ActivityCatalogTab } from "../../src/screens/library/ActivityCatalogTab";
import { AnimatedSegmentedTabs } from "../../src/ui/AnimatedSegmentedTabs";
import { useAppTheme } from "../../src/ui/app-theme";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";
import { ModalSheet } from "../../src/ui/ModalSheet";
import { useConfirmUndo } from "../../src/ui/confirm-undo";
import { useUndoableListDelete } from "../../src/ui/useUndoableListDelete";
import { markRender, measureAsync } from "../../src/observability/perf";
import { GoAtletaIcon } from "../../src/ui/icon-registry";

type LibraryTab = "links" | "catalog";

type LinkFormSnapshot = {
  editingId: string | null;
  title: string;
  videoUrl: string;
  source: string;
  notes: string;
  description: string;
  publishedAt: string;
};

const LINK_METADATA_CACHE_KEY = "goatleta.library.linkMetadata.v2";
const LINK_METADATA_CACHE_LIMIT = 80;

const normalizeLinkFormValue = (value?: string | null) => (value ?? "").trim();

const EMPTY_LINK_FORM_SNAPSHOT: LinkFormSnapshot = {
  editingId: null,
  title: "",
  videoUrl: "",
  source: "",
  notes: "",
  description: "",
  publishedAt: "",
};

const buildLinkFormSnapshot = (form: LinkFormSnapshot): LinkFormSnapshot => ({
  editingId: form.editingId ?? null,
  title: normalizeLinkFormValue(form.title),
  videoUrl: normalizeLinkFormValue(form.videoUrl),
  source: normalizeLinkFormValue(form.source),
  notes: normalizeLinkFormValue(form.notes),
  description: normalizeLinkFormValue(form.description),
  publishedAt: normalizeLinkFormValue(form.publishedAt),
});

const areLinkFormSnapshotsEqual = (
  left: LinkFormSnapshot,
  right: LinkFormSnapshot
) =>
  left.editingId === right.editingId &&
  left.title === right.title &&
  left.videoUrl === right.videoUrl &&
  left.source === right.source &&
  left.notes === right.notes &&
  left.description === right.description &&
  left.publishedAt === right.publishedAt;

const getYoutubeId = (url: string) => {
  const match =
    url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/) ||
    url.match(/[?&]v=([a-zA-Z0-9_-]+)/) ||
    url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : "";
};

const getInstagramMediaUrl = (url: string) => {
  const match = url.match(/instagram\.com\/(?:.*\/)?(p|reel|tv)\/([^/?#]+)/i);
  if (!match?.[1] || !match?.[2]) return "";
  return `https://www.instagram.com/${match[1]}/${match[2]}/media/?size=l`;
};

const getThumbnail = (url: string, metadataImage = "") => {
  const image = metadataImage.trim();
  if (image) return image;
  const normalized = url.trim();
  if (!normalized) return "";
  const id = getYoutubeId(normalized);
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  const instagramMedia = getInstagramMediaUrl(normalized);
  if (instagramMedia) return instagramMedia;
  return "";
};

const getHostLabel = (url: string) => {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).host
      .replace(/^www\./, "");
  } catch {
    return "";
  }
};

const getLinkProvider = (url: string) => {
  const host = getHostLabel(url).toLowerCase();
  if (host.includes("youtube") || host.includes("youtu.be")) {
    return { label: "YouTube", icon: "youtube" as const, tint: "#ef4444" };
  }
  if (host.includes("instagram")) {
    return { label: "Instagram", icon: "instagram" as const, tint: "#d946ef" };
  }
  if (host.includes("vimeo")) {
    return { label: "Vimeo", icon: "vimeo" as const, tint: "#38bdf8" };
  }
  return { label: host || "Link", icon: "link" as const, tint: "#38bdf8" };
};

const isGenericVideoTitle = (value: string) =>
  !value.trim() || value.trim().toLowerCase() === "vídeo" || value.trim().toLowerCase() === "video";

const getDisplayPresentation = (item: Exercise, metadata?: LinkMetadata | null) =>
  getExerciseLinkPresentation({
    ...item,
    metadataTitle: metadata?.title,
    metadataDescription: metadata?.description,
    metadataAuthor: metadata?.author,
    metadataHost: metadata?.host,
  });

const getDisplayTitle = (item: Exercise, metadata?: LinkMetadata | null) =>
  getDisplayPresentation(item, metadata).title;

const getDisplaySource = (item: Exercise, metadata?: LinkMetadata | null) =>
  getDisplayPresentation(item, metadata).sourceLabel || getHostLabel(item.videoUrl);

const getDisplayDescription = (item: Exercise, metadata?: LinkMetadata | null) =>
  getDisplayPresentation(item, metadata).description;

const readCachedLinkMetadata = async () => {
  try {
    const raw = await AsyncStorage.getItem(LINK_METADATA_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LinkMetadata | null>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, value]) => key.trim() && value?.title !== undefined
      )
    ) as Record<string, LinkMetadata>;
  } catch {
    return {};
  }
};

const writeCachedLinkMetadata = async (
  metadataByUrl: Record<string, LinkMetadata | null>
) => {
  try {
    const cacheableEntries = Object.entries(metadataByUrl)
      .filter(([, value]) => Boolean(value))
      .slice(-LINK_METADATA_CACHE_LIMIT);
    await AsyncStorage.setItem(
      LINK_METADATA_CACHE_KEY,
      JSON.stringify(Object.fromEntries(cacheableEntries))
    );
  } catch {
    // Cache is optional; the library still works with live metadata/fallbacks.
  }
};

export default function ExercisesScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { confirm } = useConfirmUndo();
  const { confirm: confirmDialog } = useConfirmDialog();
  const [items, setItems] = useState<Exercise[]>([]);
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
  const [initialLinkFormSnapshot, setInitialLinkFormSnapshot] =
    useState<LinkFormSnapshot>(EMPTY_LINK_FORM_SNAPSHOT);
  const [metaStatus, setMetaStatus] = useState("");
  const [metaLoading, setMetaLoading] = useState(false);
  const [linkPreviews, setLinkPreviews] = useState<Record<string, LinkMetadata | null>>({});
  const [brokenThumbnails, setBrokenThumbnails] = useState<Record<string, true>>({});
  const [activeLibraryTab, setActiveLibraryTab] = useState<LibraryTab>("links");
  const [showLinkModal, setShowLinkModal] = useState(false);
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canSave = Boolean(videoUrl.trim()) && !metaLoading;
  const debouncedSearchText = useDebouncedValue(searchText, 250);
  const getExerciseId = useCallback((exercise: Exercise) => exercise.id, []);
  markRender("screen.exercises.render.root");
  const undoableExerciseDelete = useUndoableListDelete({
    items,
    setItems,
    getId: getExerciseId,
    confirm,
    title: "Excluir exercício?",
    message: (targets) => {
      const [exercise] = targets;
      const displayTitle = exercise
        ? getDisplayTitle(exercise, linkPreviews[getLinkKey(exercise.videoUrl)])
        : "";
      return displayTitle
        ? `Deseja remover ${displayTitle}?`
        : "Deseja remover este exercício?";
    },
    confirmLabel: "Excluir",
    undoMessage: "Exercício excluído. Deseja desfazer?",
    deleteItems: async (ids) => {
      const [exerciseId] = ids;
      if (!exerciseId) return;
      await deleteExercise(exerciseId);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";
      Alert.alert("Não foi possível excluir", message);
    },
  });

  useEffect(() => {
    let mounted = true;
    void readCachedLinkMetadata().then((cached) => {
      if (!mounted || !Object.keys(cached).length) return;
      setLinkPreviews((previous) => ({
        ...cached,
        ...previous,
      }));
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    void writeCachedLinkMetadata(linkPreviews);
  }, [linkPreviews]);

  const load = useCallback(async () => {
    try {
      const data = await measureAsync("screen.exercises.load.links", () =>
        getExercises()
      );
      setItems(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Missing auth token")) return;
      throw err;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filteredItems = useMemo(() => {
    let list = items;
    const query = debouncedSearchText.trim();
    if (!query) return list;
    return list.filter((item) => {
      const metadata = linkPreviews[getLinkKey(item.videoUrl)];
      return matchesExerciseLinkSearch(
        {
          ...item,
          metadataTitle: metadata?.title,
          metadataDescription: metadata?.description,
          metadataAuthor: metadata?.author,
          metadataHost: metadata?.host,
        },
        query
      );
    });
  }, [debouncedSearchText, items, linkPreviews]);

  const clearForm = () => {
    setTitle("");
    setVideoUrl("");
    setSource("");
    setNotes("");
    setDescription("");
    setPublishedAt("");
    setEditingId(null);
    setEditingCreatedAt(null);
    setInitialLinkFormSnapshot(EMPTY_LINK_FORM_SNAPSHOT);
    setMetaStatus("");
  };

  const openNewLinkModal = () => {
    clearForm();
    setInitialLinkFormSnapshot(EMPTY_LINK_FORM_SNAPSHOT);
    setShowLinkModal(true);
  };

  const openEditLinkModal = (item: Exercise) => {
    const initialSnapshot = buildLinkFormSnapshot({
      editingId: item.id,
      title: item.title,
      videoUrl: item.videoUrl,
      source: item.source ?? "",
      description: item.description ?? "",
      publishedAt: item.publishedAt ?? "",
      notes: item.notes,
    });
    setEditingId(initialSnapshot.editingId);
    setEditingCreatedAt(item.createdAt);
    setTitle(initialSnapshot.title);
    setVideoUrl(initialSnapshot.videoUrl);
    setSource(initialSnapshot.source);
    setDescription(initialSnapshot.description);
    setPublishedAt(initialSnapshot.publishedAt);
    setNotes(initialSnapshot.notes);
    setInitialLinkFormSnapshot(initialSnapshot);
    setMetaStatus("");
    setShowLinkModal(true);
  };

  const currentLinkFormSnapshot = buildLinkFormSnapshot({
    editingId,
    title,
    videoUrl,
    source,
    notes,
    description,
    publishedAt,
  });
  const isFormDirty = !areLinkFormSnapshotsEqual(
    currentLinkFormSnapshot,
    initialLinkFormSnapshot
  );

  const requestCloseLinkModal = () => {
    if (isFormDirty) {
      confirmDialog({
        title: "Sair sem salvar?",
        message: "Você tem alterações não salvas.",
        confirmLabel: "Descartar",
        cancelLabel: "Continuar",
        onConfirm: () => {
          clearForm();
          setShowLinkModal(false);
        },
      });
      return;
    }
    clearForm();
    setShowLinkModal(false);
  };

  const save = async () => {
    if (metaLoading) {
      Alert.alert("Aguarde", "Carregando informações do link.");
      return;
    }
    if (!videoUrl.trim()) {
      Alert.alert("Link obrigatório", "Cole o link do vídeo.");
      return;
    }
    const metadata = linkPreviews[getLinkKey(videoUrl)];
    const provider = getLinkProvider(videoUrl).label;
    const rawTitle =
      title.trim() ||
      metadata?.title ||
      (provider === "Link" ? "Link salvo" : `Vídeo do ${provider}`);
    const rawSource = source.trim() || metadata?.author || metadata?.host || getHostLabel(videoUrl);
    const rawDescription = description.trim() || metadata?.description || "";
    const rawPublishedAt = publishedAt.trim() || metadata?.publishedAt || "";
    const nowIso = new Date().toISOString();
    const existingTags = editingId
      ? items.find((item) => item.id === editingId)?.tags ?? []
      : [];
    const classificationInput = {
      title: rawTitle,
      videoUrl: videoUrl.trim(),
      source: rawSource,
      description: rawDescription,
      publishedAt: rawPublishedAt,
      notes: notes.trim(),
      metadataTitle: metadata?.title,
      metadataDescription: metadata?.description,
      metadataAuthor: metadata?.author,
      metadataHost: metadata?.host,
    };
    const inferredTags = mergeInferredExerciseLinkTags(
      classificationInput,
      existingTags
    );
    const presentation = getExerciseLinkPresentation({
      ...classificationInput,
      tags: inferredTags,
    });
    const exercise: Exercise = {
      id: editingId ?? "ex_" + Date.now(),
      title: presentation.title,
      videoUrl: videoUrl.trim(),
      tags: inferredTags,
      source: rawSource,
      description: presentation.description,
      publishedAt: rawPublishedAt,
      notes: notes.trim(),
      createdAt: editingCreatedAt ?? nowIso,
    };
    if (editingId) {
      await updateExercise(exercise);
    } else {
      await saveExercise(exercise);
    }
    clearForm();
    setShowLinkModal(false);
    await load();
    Alert.alert("Exercício salvo", "Exercício salvo com sucesso.");
  };

  useEffect(() => {
    if (!videoUrl.trim()) {
      setMetaStatus("");
      return;
    }
    const normalizedVideoUrl = normalizeLinkFormValue(videoUrl);
    const isEditingOriginalUrl =
      Boolean(editingId) && normalizedVideoUrl === initialLinkFormSnapshot.videoUrl;
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
        const data = await requestLinkMetadata(videoUrl.trim(), accessToken);
        setLinkPreviews((previous) => ({
          ...previous,
          [getLinkKey(videoUrl)]: data,
        }));
        if (isEditingOriginalUrl) {
          setMetaStatus("");
          return;
        }
        const presentation = getExerciseLinkPresentation({
          title: data.title,
          videoUrl: videoUrl.trim(),
          source: data.author || data.host || getHostLabel(videoUrl),
          description: data.description || "",
          publishedAt: data.publishedAt || "",
          notes,
          metadataTitle: data.title,
          metadataDescription: data.description,
          metadataAuthor: data.author,
          metadataHost: data.host,
        });
        if (!title.trim() && data.title) {
          setTitle(presentation.title);
        }
        if (!source.trim() && (data.author || data.host)) {
          setSource(data.author || data.host || "");
        }
        if (!description.trim() && data.description) {
          setDescription(presentation.description);
        }
        if (!publishedAt.trim() && data.publishedAt) {
          setPublishedAt(data.publishedAt);
        }
        setMetaStatus("Informações preenchidas automaticamente.");
      } catch (error) {
        setLinkPreviews((previous) => ({
          ...previous,
          [getLinkKey(videoUrl)]: null,
        }));
        setMetaStatus(
          error instanceof Error ?
            error.message
            : "Não foi possível ler o link."
        );
      } finally {
        setMetaLoading(false);
      }
    }, 700);
    return () => {
      if (metaTimer.current) clearTimeout(metaTimer.current);
    };
  }, [
    videoUrl,
    editingId,
    initialLinkFormSnapshot.videoUrl,
    title,
    source,
    description,
    notes,
    publishedAt,
  ]);

  useEffect(() => {
    if (activeLibraryTab !== "links" || !filteredItems.length) return;
    const candidates = filteredItems
      .filter((item) => {
        const key = getLinkKey(item.videoUrl);
        if (!key) return false;
        if (Object.prototype.hasOwnProperty.call(linkPreviews, key)) {
          return false;
        }
        const provider = getLinkProvider(item.videoUrl);
        const hasThumbnail = Boolean(getThumbnail(item.videoUrl));
        return (
          provider.label === "Instagram" ||
          !hasThumbnail ||
          isGenericVideoTitle(item.title) ||
          !item.source?.trim() ||
          !item.description?.trim()
        );
      })
      .slice(0, 8);
    if (!candidates.length) return;
    let cancelled = false;
    (async () => {
      const accessToken = await getValidAccessToken();
      if (!accessToken) return;
      const entries = await Promise.all(
        candidates.map(async (item) => {
          const key = getLinkKey(item.videoUrl);
          try {
            const metadata = await requestLinkMetadata(item.videoUrl, accessToken);
            return [key, metadata] as const;
          } catch {
            return [key, null] as const;
          }
        })
      );
      if (cancelled) return;
      setLinkPreviews((previous) => {
        const next = { ...previous };
        entries.forEach(([key, value]) => {
          next[key] = value;
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeLibraryTab, filteredItems, linkPreviews]);

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
    undoableExerciseDelete.deleteOne(exercise);
  };

  const markThumbnailBroken = useCallback((uri: string) => {
    if (!uri) return;
    setBrokenThumbnails((previous) =>
      previous[uri] ? previous : { ...previous, [uri]: true }
    );
  }, []);

  const formPreview = videoUrl.trim()
    ? linkPreviews[getLinkKey(videoUrl)]
    : undefined;
  const formProvider = getLinkProvider(videoUrl);
  const formThumbnail = getThumbnail(videoUrl, formPreview?.image ?? "");
  const visibleFormThumbnail =
    formThumbnail && !brokenThumbnails[formThumbnail] ? formThumbnail : "";
  const formTitle =
    title.trim() ||
    formPreview?.title ||
    (videoUrl.trim()
      ? formProvider.label === "Link"
        ? "Link salvo"
        : `Vídeo do ${formProvider.label}`
      : "");
  const formSource =
    source.trim() || formPreview?.author || formPreview?.host || getHostLabel(videoUrl);
  const formDescription = description.trim() || formPreview?.description || "";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScreenPageHeader
          title="Biblioteca"
          subtitle="Biblioteca com vídeos, links e catálogo pedagógico."
          onBack={() => navigateBackOrReplace({ router, fallback: "/prof/home" })}
        >
          <AnimatedSegmentedTabs<LibraryTab>
            tabs={[
              { id: "links", label: "Meus Links" },
              { id: "catalog", label: "Catálogo GoAtleta" },
            ]}
            activeTab={activeLibraryTab}
            onChange={setActiveLibraryTab}
          />
        </ScreenPageHeader>
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 150 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >
        {activeLibraryTab === "links" ? (
          <>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 14,
              backgroundColor: colors.card,
            }}
          >
            <TextInput
              placeholder="Buscar link, fonte ou descrição..."
              placeholderTextColor={colors.placeholder}
              value={searchText}
              onChangeText={setSearchText}
              style={{ flex: 1, paddingVertical: 2, color: colors.inputText }}
            />
            <GoAtletaIcon name="search" size={18} color={colors.muted} />
          </View>
          <Pressable
            onPress={openNewLinkModal}
            testID="add-link-video-button"
            accessibilityRole="button"
            accessibilityLabel="Adicionar link de vídeo"
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              backgroundColor: colors.primaryBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GoAtletaIcon name="link" size={22} color={colors.primaryText} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {filteredItems.map((item) => {
            const metadata = linkPreviews[getLinkKey(item.videoUrl)];
            const provider = getLinkProvider(item.videoUrl);
            const thumbnail = getThumbnail(item.videoUrl, metadata?.image ?? "");
            const visibleThumbnail =
              thumbnail && !brokenThumbnails[thumbnail] ? thumbnail : "";
            const displayTitle = getDisplayTitle(item, metadata);
            const displaySource = getDisplaySource(item, metadata);
            const displayDescription = getDisplayDescription(item, metadata);
            return (
              <View
                key={item.id}
                style={{
                  flexGrow: 1,
                  flexBasis: 300,
                  maxWidth: 360,
                  minWidth: 280,
                  height: 418,
                  borderRadius: 18,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: "hidden",
                }}
              >
                <Pressable
                  onPress={() => openLink(item.videoUrl)}
                  accessibilityLabel={`Abrir ${displayTitle}`}
                  style={{
                    aspectRatio: 16 / 9,
                    backgroundColor: colors.thumbFallback,
                  }}
                >
                  {visibleThumbnail ? (
                    <Image
                      source={{ uri: visibleThumbnail }}
                      resizeMode="cover"
                      onError={() => markThumbnailBroken(visibleThumbnail)}
                      style={{ width: "100%", height: "100%" }}
                    />
                  ) : (
                    <View
                      style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: `${provider.tint}1F`,
                      }}
                    >
                      <GoAtletaIcon
                        name={provider.icon}
                        size={30}
                        color={provider.tint}
                      />
                    </View>
                  )}
                  <View
                    style={{
                      position: "absolute",
                      left: 12,
                      top: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <GoAtletaIcon name={provider.icon} size={14} color={provider.tint} />
                    <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>
                      {provider.label}
                    </Text>
                  </View>
                  <View
                    style={{
                      position: "absolute",
                      right: 12,
                      top: 12,
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <GoAtletaIcon name="play" size={18} color={colors.text} />
                  </View>
                </Pressable>

                <View style={{ padding: 12, gap: 8 }}>
                  <View style={{ gap: 3 }}>
                    <Text
                      numberOfLines={2}
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        fontSize: 16,
                        minHeight: 42,
                        lineHeight: 21,
                      }}
                    >
                      {displayTitle}
                    </Text>
                    {displaySource ? (
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.muted, fontWeight: "700", fontSize: 12 }}
                      >
                        {displaySource}
                      </Text>
                    ) : null}
                    {displayDescription ? (
                      <Text
                        numberOfLines={3}
                        style={{
                          color: colors.muted,
                          lineHeight: 18,
                          fontSize: 13,
                          minHeight: 54,
                        }}
                      >
                        {displayDescription}
                      </Text>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <Pressable
                      onPress={() => openLink(item.videoUrl)}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir ${displayTitle}`}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: colors.primaryBg,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 6,
                      }}
                    >
                      <GoAtletaIcon name="open" size={16} color={colors.primaryText} />
                      <Text
                        style={{
                          color: colors.primaryText,
                          fontWeight: "800",
                          fontSize: 13,
                        }}
                      >
                        Abrir
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => shareLink(item.videoUrl, displayTitle)}
                      accessibilityRole="button"
                      accessibilityLabel={`Compartilhar ${displayTitle}`}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        backgroundColor: colors.secondaryBg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <GoAtletaIcon name="share" size={18} color={colors.secondaryText} />
                    </Pressable>
                    <Pressable
                      onPress={() => openEditLinkModal(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${displayTitle}`}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        backgroundColor: colors.secondaryBg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <GoAtletaIcon name="edit" size={18} color={colors.secondaryText} />
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Excluir ${displayTitle}`}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        backgroundColor: colors.dangerBg,
                        borderWidth: 1,
                        borderColor: colors.dangerBorder,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <GoAtletaIcon name="trash" size={18} color={colors.dangerText} />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
          { !filteredItems.length ? (
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
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
                Nenhum link salvo ainda
              </Text>
              <Text style={{ color: colors.muted, lineHeight: 20 }}>
                Salve vídeos do YouTube, Instagram ou outras fontes para consultar depois durante seus planejamentos.
              </Text>
            </View>
          ) : null}
        </View>
          </>
        ) : (
          <ActivityCatalogTab />
        )}
      </ScrollView>
      </KeyboardAvoidingView>
      <ModalSheet
        visible={showLinkModal}
        onClose={requestCloseLinkModal}
        position="center"
        cardStyle={{
          width: "94%",
          maxWidth: 720,
          maxHeight: "88%",
          padding: 18,
          borderRadius: 22,
          gap: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>
              {editingId ? "Editar link" : "Adicionar link"}
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              Cole um vídeo ou referência para salvar na biblioteca.
            </Text>
          </View>
          <Pressable
            onPress={requestCloseLinkModal}
            testID="close-link-modal-button"
            accessibilityRole="button"
            accessibilityLabel="Fechar cadastro de link"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
            }}
          >
            <GoAtletaIcon name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontWeight: "800", fontSize: 12 }}>
              Link do vídeo
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                backgroundColor: colors.inputBg,
                paddingHorizontal: 12,
              }}
            >
              <GoAtletaIcon name="link" size={18} color={colors.muted} />
              <TextInput
                placeholder="https://..."
                placeholderTextColor={colors.placeholder}
                value={videoUrl}
                onChangeText={setVideoUrl}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  flex: 1,
                  minHeight: 48,
                  color: colors.inputText,
                }}
              />
            </View>
          </View>

          {videoUrl.trim() ? (
            <View
              style={{
                borderRadius: 18,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: "hidden",
              }}
            >
              <View style={{ aspectRatio: 16 / 9, backgroundColor: colors.thumbFallback }}>
                {visibleFormThumbnail ? (
                  <Image
                    source={{ uri: visibleFormThumbnail }}
                    resizeMode="cover"
                    onError={() => markThumbnailBroken(visibleFormThumbnail)}
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <View
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: `${formProvider.tint}22`,
                    }}
                  >
                    <GoAtletaIcon
                      name={formProvider.icon}
                      size={32}
                      color={formProvider.tint}
                    />
                  </View>
                )}
                <View
                  style={{
                    position: "absolute",
                    left: 12,
                    top: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: colors.secondaryBg,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <GoAtletaIcon name={formProvider.icon} size={14} color={formProvider.tint} />
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>
                    {formProvider.label}
                  </Text>
                </View>
              </View>
              <View style={{ padding: 12, gap: 6 }}>
                <Text
                  numberOfLines={2}
                  style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}
                >
                  {formTitle || "Lendo link..."}
                </Text>
                {formSource ? (
                  <Text numberOfLines={1} style={{ color: colors.muted, fontWeight: "700" }}>
                    {formSource}
                  </Text>
                ) : null}
                {formDescription ? (
                  <Text numberOfLines={2} style={{ color: colors.muted, lineHeight: 19 }}>
                    {formDescription}
                  </Text>
                ) : null}
                {metaStatus ? (
                  <Text
                    numberOfLines={2}
                    style={{
                      color:
                        metaStatus.includes("Falha") || metaStatus.includes("Não foi")
                          ? colors.dangerText
                          : colors.muted,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {metaStatus}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            <TextInput
              placeholder="Título (opcional)"
              placeholderTextColor={colors.placeholder}
              value={title}
              onChangeText={setTitle}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
                borderRadius: 14,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
            <TextInput
              placeholder="Descrição curta (opcional)"
              placeholderTextColor={colors.placeholder}
              value={description}
              onChangeText={setDescription}
              multiline
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
                minHeight: 84,
                borderRadius: 14,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
                textAlignVertical: "top",
              }}
            />
          </View>
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={save}
            accessibilityRole="button"
            accessibilityLabel={editingId ? "Salvar alterações do link" : "Salvar link"}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 14,
              backgroundColor: canSave ? colors.primaryBg : colors.primaryDisabledBg,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
            }}
          >
            <GoAtletaIcon
              name={editingId ? "checkmarkOutline" : "add"}
              size={18}
              color={colors.primaryText}
            />
            <Text style={{ color: colors.primaryText, fontWeight: "900" }}>
              {editingId ? "Salvar alterações" : "Salvar link"}
            </Text>
          </Pressable>
          <Pressable
            onPress={requestCloseLinkModal}
            testID="cancel-link-modal-button"
            accessibilityRole="button"
            accessibilityLabel="Cancelar cadastro de link"
            style={{
              minHeight: 48,
              paddingHorizontal: 18,
              borderRadius: 14,
              backgroundColor: colors.secondaryBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.secondaryText, fontWeight: "800" }}>
              Cancelar
            </Text>
          </Pressable>
        </View>
      </ModalSheet>
    </SafeAreaView>
  );
}
