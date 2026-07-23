import { useEffect, useMemo, useState } from "react";
import {
  ImageBackground,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { getLinkKey, requestLinkMetadata, type LinkMetadata } from "../../../api/link-metadata";
import { getValidAccessToken } from "../../../auth/session";
import {
  getExerciseLinkPresentation,
  matchesExerciseLinkSearch,
  scoreExerciseLinkForPlanningBlock,
  scoreExerciseLinkSearchRelevance,
  shouldRefreshExerciseLinkMetadata,
} from "../../../core/exercise-link-classifier";
import type { Exercise } from "../../../core/models";
import type { TrainingPlanBlockKey } from "../../../core/training-plan-blocks";
import type { ActivityPatternStage } from "../../../core/volleyball/activity-pattern-engine";
import { getExercises } from "../../../db/seed";
import { AnimatedSegmentedTabs } from "../../../ui/AnimatedSegmentedTabs";
import { ModalDialogFrame } from "../../../ui/ModalDialogFrame";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { ActivityCatalogFilterSheet } from "../../library/ActivityCatalogFilterSheet";
import { ActivityCatalogThumbnail } from "../../library/ActivityCatalogThumbnail";
import { ActivityCatalogVideoDetailSheet } from "../../library/ActivityCatalogVideoDetailSheet";
import { skillLabels } from "../../library/activity-catalog-labels";
import {
  buildActivityCatalogListItems,
  EMPTY_CATALOG_FILTERS,
  filterActivityCatalogItems,
  getActivityCatalogCardChips,
  getCatalogActivityPrimaryBadge,
  getCatalogFilterOptions,
  hasActiveCatalogFilters,
  type ActivityCatalogListItem,
  type CatalogFilterOptions,
  type CatalogFilterState,
} from "../../library/activity-catalog-view-model";
import { getPlanningBlockLabel } from "../application/planning-library-bridge";
import { GoAtletaIcon } from "../../../ui/icon-registry";

type LibraryTab = "catalog" | "links";

type Props = {
  visible: boolean;
  blockKey: TrainingPlanBlockKey | null;
  onClose: () => void;
  onAddCatalogActivity: (item: ActivityCatalogListItem) => void;
  onAddExerciseLink: (exercise: Exercise) => void;
};

const tabs = [
  { id: "catalog", label: "Catálogo GoAtleta" },
  { id: "links", label: "Meus Links" },
] satisfies readonly { id: LibraryTab; label: string }[];

const defaultPhaseByBlock: Record<TrainingPlanBlockKey, ActivityPatternStage> = {
  warmup: "warmup",
  main: "drill",
  cooldown: "cooldown",
};

const exerciseLinkBadgeLabels: Record<string, string> = {
  aquecimento: "Aquecimento",
  ataque: "Ataque",
  bloqueio: "Bloqueio",
  circuito: "Circuito",
  coordenacao: "Coordenação",
  core: "Core",
  defesa: "Defesa",
  desenvolvimento: "Desenvolvimento",
  drill: "Drill",
  duplas: "Duplas",
  forca: "Força",
  grupo: "Grupo",
  "jogo-aplicacao": "Jogo",
  "jogo-reduzido": "Jogo reduzido",
  levantamento: "Levantamento",
  mobilidade: "Mobilidade",
  passe: "Passe",
  prevencao: "Prevenção",
  queimada: "Queimada",
  recepcao: "Recepção",
  saque: "Saque",
  toque: "Toque",
  transicao: "Transição",
  trios: "Trios",
  "volta-calma": "Volta à calma",
};

const exerciseLinkBadgePriority = [
  "queimada",
  "forca",
  "core",
  "mobilidade",
  "prevencao",
  "coordenacao",
  "agilidade",
  "passe",
  "toque",
  "levantamento",
  "recepcao",
  "saque",
  "ataque",
  "bloqueio",
  "defesa",
  "transicao",
  "aquecimento",
  "jogo-aplicacao",
  "jogo-reduzido",
  "volta-calma",
  "drill",
  "circuito",
  "duplas",
  "trios",
  "grupo",
];

const getExerciseLinkBadges = (tags: string[], sourceLabel?: string) => {
  const tagSet = new Set(tags);
  const rankedTags = exerciseLinkBadgePriority.filter((tag) => tagSet.has(tag));
  const [primaryTag, secondaryTag] = rankedTags;
  return {
    primary: (primaryTag && exerciseLinkBadgeLabels[primaryTag]) || "Vídeo/link",
    secondary: (secondaryTag && exerciseLinkBadgeLabels[secondaryTag]) || sourceLabel || "Link",
  };
};

const getExerciseLinkSourceDisplayLabel = (sourceLabel?: string) => {
  const value = sourceLabel?.trim();
  if (!value) return "Link";

  const normalized = value.toLowerCase();
  if (normalized.includes("instagram")) return "Instagram";
  if (normalized.includes("pinterest")) return "Pinterest";
  if (normalized.includes("youtube") || normalized.includes("youtu.be")) return "YouTube";
  if (normalized.includes("tiktok")) return "TikTok";
  if (normalized.includes("vimeo")) return "Vimeo";
  if (/^https?:\/\//.test(normalized) || normalized.startsWith("www.") || normalized.includes(".")) {
    return "Link";
  }

  return value;
};

const getMetadataForExercise = (
  previews: Record<string, LinkMetadata | null>,
  exercise: Exercise
) => {
  const key = getLinkKey(exercise.videoUrl ?? "");
  if (!key || !Object.prototype.hasOwnProperty.call(previews, key)) return undefined;
  return previews[key];
};

const buildExerciseLinkInput = (exercise: Exercise, metadata?: LinkMetadata | null) => ({
  ...exercise,
  metadataTitle: metadata?.title,
  metadataDescription: metadata?.description,
  metadataAuthor: metadata?.author,
  metadataHost: metadata?.host,
});

const buildExerciseForPlanningBlock = (
  exercise: Exercise,
  metadata?: LinkMetadata | null
): Exercise => {
  const presentation = getExerciseLinkPresentation(buildExerciseLinkInput(exercise, metadata));
  const sourceLabel = getExerciseLinkSourceDisplayLabel(presentation.sourceLabel);
  return {
    ...exercise,
    title: presentation.title,
    description: presentation.description,
    source: sourceLabel,
    tags: presentation.tags,
  };
};

export function PlanningLibraryBridgeSheet({
  visible,
  blockKey,
  onClose,
  onAddCatalogActivity,
  onAddExerciseLink,
}: Props) {
  const { colors } = useAppTheme();
  const { height, width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<LibraryTab>("catalog");
  const [filters, setFilters] = useState<CatalogFilterState>(EMPTY_CATALOG_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] =
    useState<ActivityCatalogListItem | null>(null);
  const [linkQuery, setLinkQuery] = useState("");
  const [links, setLinks] = useState<Exercise[]>([]);
  const [linkPreviews, setLinkPreviews] = useState<Record<string, LinkMetadata | null>>({});
  const [linksError, setLinksError] = useState("");
  const [loadingLinks, setLoadingLinks] = useState(false);

  const catalogItems = useMemo(() => buildActivityCatalogListItems(), []);
  const options = useMemo(() => getCatalogFilterOptions(catalogItems), [catalogItems]);
  const filteredCatalogItems = useMemo(
    () => filterActivityCatalogItems(catalogItems, filters),
    [catalogItems, filters]
  );
  const filteredLinks = useMemo(() => {
    const query = linkQuery.trim();
    const matchingLinks = query
      ? links.filter((exercise) =>
          matchesExerciseLinkSearch(
            buildExerciseLinkInput(exercise, getMetadataForExercise(linkPreviews, exercise)),
            query
          )
        )
      : links;
    if (!blockKey && !query) return matchingLinks;
    return [...matchingLinks].sort((left, right) => {
      const rightInput = buildExerciseLinkInput(
        right,
        getMetadataForExercise(linkPreviews, right)
      );
      const leftInput = buildExerciseLinkInput(left, getMetadataForExercise(linkPreviews, left));
      const queryDelta =
        scoreExerciseLinkSearchRelevance(rightInput, query) -
        scoreExerciseLinkSearchRelevance(leftInput, query);
      if (queryDelta !== 0) return queryDelta;

      if (blockKey) {
        const blockDelta =
          scoreExerciseLinkForPlanningBlock(rightInput, blockKey) -
          scoreExerciseLinkForPlanningBlock(leftInput, blockKey);
        if (blockDelta !== 0) return blockDelta;
      }

      const rightTitle = getExerciseLinkPresentation(rightInput).title;
      const leftTitle = getExerciseLinkPresentation(leftInput).title;
      return leftTitle.localeCompare(rightTitle, "pt-BR");
    });
  }, [blockKey, linkPreviews, linkQuery, links]);

  useEffect(() => {
    if (!visible) {
      setSelectedCatalogItem(null);
      setShowFilters(false);
      return;
    }
    setActiveTab("catalog");
    setFilters({
      ...EMPTY_CATALOG_FILTERS,
      recommendedPhase: blockKey ? defaultPhaseByBlock[blockKey] : "",
    });
    setLinkQuery("");
  }, [blockKey, visible]);

  useEffect(() => {
    if (!visible || activeTab !== "links") return;
    let alive = true;
    setLoadingLinks(true);
    setLinksError("");
    getExercises()
      .then((items) => {
        if (alive) setLinks(items);
      })
      .catch(() => {
        if (alive) setLinksError("Não foi possível carregar Meus Links.");
      })
      .finally(() => {
        if (alive) setLoadingLinks(false);
      });
    return () => {
      alive = false;
    };
  }, [activeTab, visible]);

  useEffect(() => {
    if (!visible || activeTab !== "links" || !links.length) return;
    const candidates = links
      .filter((exercise) => {
        const key = getLinkKey(exercise.videoUrl ?? "");
        if (!key || Object.prototype.hasOwnProperty.call(linkPreviews, key)) return false;
        return shouldRefreshExerciseLinkMetadata(exercise);
      })
      .slice(0, 6);
    if (!candidates.length) return;

    let alive = true;
    const loadMetadata = async () => {
      const accessToken = await getValidAccessToken();
      if (!accessToken || !alive) return;
      const entries = await Promise.all(
        candidates.map(async (exercise) => {
          const key = getLinkKey(exercise.videoUrl);
          try {
            const metadata = await requestLinkMetadata(exercise.videoUrl, accessToken);
            return [key, metadata] as const;
          } catch {
            return [key, null] as const;
          }
        })
      );
      if (!alive) return;
      setLinkPreviews((current) => {
        const next = { ...current };
        entries.forEach(([key, metadata]) => {
          if (key && !Object.prototype.hasOwnProperty.call(next, key)) {
            next[key] = metadata;
          }
        });
        return next;
      });
    };

    void loadMetadata();
    return () => {
      alive = false;
    };
  }, [activeTab, linkPreviews, links, visible]);

  if (!visible || !blockKey) return null;

  const addCatalogItem = (item: ActivityCatalogListItem) => {
    onAddCatalogActivity(item);
    setSelectedCatalogItem(null);
  };

  const useGridCards = width >= 720;
  const modalHeight = Math.min(height * 0.8, 700);

  return (
    <>
      <ModalDialogFrame
        visible={visible}
        onClose={onClose}
        colors={colors}
        title="Adicionar atividade"
        subtitle={`Destino: ${getPlanningBlockLabel(blockKey)}`}
        position="center"
        cardStyle={{ width: "92%", maxWidth: 780, height: modalHeight }}
        contentContainerStyle={{ gap: 10, paddingBottom: 14, paddingTop: 10 }}
      >
        <AnimatedSegmentedTabs<LibraryTab>
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          itemMinHeight={38}
          style={{
            backgroundColor: colors.secondaryBg,
            padding: 6,
          }}
        />

        {activeTab === "catalog" ? (
          <View style={{ gap: 8 }}>
            <PlanningCatalogControls
              filters={filters}
              options={options}
              resultCount={filteredCatalogItems.length}
              onChange={setFilters}
              onOpenFilters={() => setShowFilters(true)}
            />
            {filteredCatalogItems.length ? (
              <View
                style={{
                  flexDirection: useGridCards ? "row" : "column",
                  flexWrap: useGridCards ? "wrap" : "nowrap",
                  gap: 8,
                }}
              >
                {filteredCatalogItems.map((item) => (
                  <PlanningCatalogCompactCard
                    key={item.id}
                    item={item}
                    grid={useGridCards}
                    onView={setSelectedCatalogItem}
                    onAdd={addCatalogItem}
                  />
                ))}
              </View>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "700" }}>
                Nenhuma atividade encontrada para os filtros selecionados.
              </Text>
            )}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: colors.inputBg,
              }}
            >
              <TextInput
                testID="planning-library-link-search"
                placeholder="Buscar nos meus links..."
                placeholderTextColor={colors.placeholder}
                value={linkQuery}
                onChangeText={setLinkQuery}
                style={{ flex: 1, color: colors.inputText, paddingVertical: 2 }}
              />
              <GoAtletaIcon name="search" size={18} color={colors.muted} />
            </View>
            {loadingLinks ? (
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "700" }}>
                Carregando links...
              </Text>
            ) : linksError ? (
              <Text style={{ color: colors.dangerText, fontSize: 14, fontWeight: "800" }}>
                {linksError}
              </Text>
            ) : filteredLinks.length ? (
              <View
                style={{
                  flexDirection: useGridCards ? "row" : "column",
                  flexWrap: useGridCards ? "wrap" : "nowrap",
                  gap: 8,
                }}
              >
                {filteredLinks.map((exercise) => (
                  <LinkCard
                    key={exercise.id}
                    exercise={exercise}
                    grid={useGridCards}
                    metadata={getMetadataForExercise(linkPreviews, exercise)}
                    onAdd={onAddExerciseLink}
                  />
                ))}
              </View>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "700" }}>
                Nenhum link encontrado.
              </Text>
            )}
          </View>
        )}
      </ModalDialogFrame>

      <ActivityCatalogFilterSheet
        visible={showFilters}
        filters={filters}
        options={options}
        onApply={setFilters}
        onClose={() => setShowFilters(false)}
      />
      <ActivityCatalogVideoDetailSheet
        item={selectedCatalogItem}
        onClose={() => setSelectedCatalogItem(null)}
        onAddToLesson={addCatalogItem}
      />
    </>
  );
}

function PlanningCatalogControls({
  filters,
  options,
  resultCount,
  onChange,
  onOpenFilters,
}: {
  filters: CatalogFilterState;
  options: CatalogFilterOptions;
  resultCount: number;
  onChange: (filters: CatalogFilterState) => void;
  onOpenFilters: () => void;
}) {
  const { colors } = useAppTheme();
  const active = hasActiveCatalogFilters(filters);

  return (
    <View
      style={{
        gap: 8,
        padding: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            flex: 1,
            minHeight: 38,
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 11,
            borderRadius: 12,
            backgroundColor: colors.inputBg,
          }}
        >
          <TextInput
            testID="planning-catalog-search-input"
            placeholder="Buscar..."
            placeholderTextColor={colors.placeholder}
            value={filters.query}
            onChangeText={(query) => onChange({ ...filters, query })}
            style={{
              flex: 1,
              color: colors.inputText,
              paddingVertical: 0,
              minHeight: 34,
              fontSize: 14,
            }}
          />
          <GoAtletaIcon name="search" size={17} color={colors.muted} />
        </View>
        <Pressable
          testID="planning-catalog-open-filters"
          onPress={onOpenFilters}
          style={{
            minHeight: 38,
            minWidth: 42,
            paddingHorizontal: 11,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 6,
            backgroundColor: active ? colors.infoBg : colors.secondaryBg,
          }}
        >
          <GoAtletaIcon
            name={active ? "options" : "options"}
            size={17}
            color={active ? colors.infoText : colors.secondaryText}
          />
          <Text
            style={{
              color: active ? colors.infoText : colors.secondaryText,
              fontSize: 12,
              fontWeight: "900",
            }}
          >
            {resultCount}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 7, paddingRight: 4 }}
      >
        <QuickSkillChip
          label="Todos"
          active={!filters.skill}
          testID="planning-catalog-skill-all"
          onPress={() => onChange({ ...filters, skill: "" })}
        />
        {options.skills.map((skill) => (
          <QuickSkillChip
            key={skill}
            label={skillLabels[skill]}
            active={filters.skill === skill}
            testID={`planning-catalog-skill-${skill}`}
            onPress={() =>
              onChange({ ...filters, skill: filters.skill === skill ? "" : skill })
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

function QuickSkillChip({
  label,
  active,
  testID,
  onPress,
}: {
  label: string;
  active: boolean;
  testID: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        minHeight: 30,
        paddingHorizontal: 11,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.successBorder : colors.border,
        backgroundColor: active ? colors.successBg : colors.secondaryBg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color: active ? colors.successText : colors.text,
          fontSize: 12,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PlanningCatalogCompactCard({
  item,
  grid,
  onView,
  onAdd,
}: {
  item: ActivityCatalogListItem;
  grid: boolean;
  onView: (item: ActivityCatalogListItem) => void;
  onAdd: (item: ActivityCatalogListItem) => void;
}) {
  const { colors } = useAppTheme();
  const badge = getCatalogActivityPrimaryBadge(item);
  const chips = getActivityCatalogCardChips(item).slice(0, 2);

  return (
    <View
      testID={`planning-catalog-card-${item.id}`}
      style={{
        width: grid ? "49%" : "100%",
        padding: 9,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <View
        style={{
          gap: 9,
        }}
      >
        <Pressable
          testID={`planning-catalog-preview-${item.id}`}
          onPress={() => onView(item)}
          style={{
            width: "100%",
          }}
        >
          <ActivityCatalogThumbnail
            item={item}
            badge={badge}
            footerLabel={item.variant.name}
          />
        </Pressable>

        <View style={{ gap: 7 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: colors.muted, fontSize: 12, fontWeight: "800" }}
            >
              {item.familyLabel}
            </Text>
            {chips.slice(0, 1).map((chip) => (
              <View
                key={chip}
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: colors.secondaryBg,
                }}
              >
                <Text style={{ color: colors.secondaryText, fontSize: 10, fontWeight: "900" }}>
                  {chip}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 7 }}>
            <Pressable
              testID={`planning-catalog-view-${item.id}`}
              onPress={() => onView(item)}
              style={{
                flex: 1,
                minHeight: 34,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 5,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <GoAtletaIcon name="view" size={16} color={colors.secondaryText} />
              <Text style={{ color: colors.secondaryText, fontSize: 12, fontWeight: "900" }}>
                Ver
              </Text>
            </Pressable>
            <Pressable
              testID={`planning-catalog-add-${item.id}`}
              onPress={() => onAdd(item)}
              style={{
                flex: 1,
                minHeight: 34,
                borderRadius: 11,
                paddingHorizontal: 10,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 5,
                backgroundColor: colors.primaryBg,
              }}
            >
              <GoAtletaIcon name="add" size={17} color={colors.primaryText} />
              <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "900" }}>
                Adicionar
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function LinkCard({
  exercise,
  grid,
  metadata,
  onAdd,
}: {
  exercise: Exercise;
  grid: boolean;
  metadata?: LinkMetadata | null;
  onAdd: (exercise: Exercise) => void;
}) {
  const { colors } = useAppTheme();
  const presentation = getExerciseLinkPresentation(buildExerciseLinkInput(exercise, metadata));
  const { title, description, sourceLabel, tags } = presentation;
  const sourceDisplayLabel = getExerciseLinkSourceDisplayLabel(sourceLabel);
  const linkBadges = getExerciseLinkBadges(tags, sourceDisplayLabel);
  const exerciseForBlock = buildExerciseForPlanningBlock(exercise, metadata);
  const previewImage = metadata?.image?.trim();
  const openLink = () => {
    const url = exercise.videoUrl?.trim();
    if (!url) return;
    void Linking.openURL(url).catch(() => undefined);
  };

  return (
    <View
      testID={`planning-link-card-${exercise.id}`}
      style={{
        width: grid ? "49%" : "100%",
        padding: 9,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <View style={{ gap: 9 }}>
        <Pressable
          testID={`planning-open-link-preview-${exercise.id}`}
          onPress={openLink}
          style={{
            width: "100%",
            aspectRatio: 16 / 9,
            borderRadius: 12,
            overflow: "hidden",
            backgroundColor: colors.secondaryBg,
          }}
        >
          {previewImage ? (
            <ImageBackground
              source={{ uri: previewImage }}
              resizeMode="cover"
              style={{ flex: 1, justifyContent: "space-between", padding: 10 }}
            >
              <View
                style={{
                  ...StyleSheet.absoluteFill,
                  backgroundColor: "rgba(2, 6, 23, 0.28)",
                }}
              />
              <LinkPreviewOverlay badgeLabel={linkBadges.primary} title={title} />
            </ImageBackground>
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: "space-between",
                padding: 10,
                backgroundColor: colors.infoBg,
              }}
            >
              <LinkPreviewOverlay badgeLabel={linkBadges.primary} title={title} />
            </View>
          )}
        </Pressable>

        <View style={{ gap: 7 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: colors.muted, fontSize: 12, fontWeight: "800" }}
            >
              {sourceDisplayLabel}
            </Text>
            <View
              style={{
                paddingHorizontal: 7,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
                minHeight: 24,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                numberOfLines={1}
                style={{ color: colors.secondaryText, fontSize: 10, fontWeight: "900", textAlign: "center" }}
              >
                {linkBadges.secondary}
              </Text>
            </View>
          </View>
          <Text
            numberOfLines={2}
            style={{
              color: colors.text,
              fontSize: 14,
              fontWeight: "900",
              lineHeight: 18,
            }}
          >
            {title}
          </Text>
          {description ? (
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
              {description}
            </Text>
          ) : null}

          <View style={{ flexDirection: "row", gap: 7 }}>
            <Pressable
              testID={`planning-open-link-${exercise.id}`}
              onPress={openLink}
              style={{
                flex: 1,
                minHeight: 34,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 5,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <GoAtletaIcon name="open" size={15} color={colors.secondaryText} />
              <Text style={{ color: colors.secondaryText, fontSize: 12, fontWeight: "900" }}>
                Abrir
              </Text>
            </Pressable>
            <Pressable
              testID={`planning-add-link-${exercise.id}`}
              onPress={() => onAdd(exerciseForBlock)}
              style={{
                flex: 1,
                minHeight: 34,
                borderRadius: 11,
                paddingHorizontal: 10,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 5,
                backgroundColor: colors.primaryBg,
              }}
            >
              <GoAtletaIcon name="add" size={17} color={colors.primaryText} />
              <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "900" }}>
                Adicionar
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function LinkPreviewOverlay({
  badgeLabel,
  title,
}: {
  badgeLabel: string;
  title: string;
}) {
  const { colors } = useAppTheme();

  return (
    <>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <View
          style={{
            maxWidth: "72%",
            minHeight: 30,
            paddingHorizontal: 9,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: "rgba(2, 6, 23, 0.86)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            numberOfLines={1}
            style={{ color: colors.text, fontSize: 11, fontWeight: "900", textAlign: "center" }}
          >
            {badgeLabel}
          </Text>
        </View>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(2, 6, 23, 0.86)",
          }}
        >
          <GoAtletaIcon name="play" size={17} color={colors.text} />
        </View>
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: colors.text,
          fontSize: 12,
          fontWeight: "900",
          textShadowColor: "rgba(2, 6, 23, 0.65)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
        }}
      >
        {title}
      </Text>
    </>
  );
}
