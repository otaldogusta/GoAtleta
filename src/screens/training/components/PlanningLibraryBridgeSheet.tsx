import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";

import type { Exercise } from "../../../core/models";
import type { TrainingPlanBlockKey } from "../../../core/training-plan-blocks";
import { getExercises } from "../../../db/seed";
import { AnimatedSegmentedTabs } from "../../../ui/AnimatedSegmentedTabs";
import { ModalDialogFrame } from "../../../ui/ModalDialogFrame";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { ActivityCatalogFilterSheet } from "../../library/ActivityCatalogFilterSheet";
import { ActivityCatalogFilters } from "../../library/ActivityCatalogFilters";
import { ActivityCatalogVideoCard } from "../../library/ActivityCatalogVideoCard";
import { ActivityCatalogVideoDetailSheet } from "../../library/ActivityCatalogVideoDetailSheet";
import {
  buildActivityCatalogListItems,
  EMPTY_CATALOG_FILTERS,
  filterActivityCatalogItems,
  getCatalogFilterOptions,
  type ActivityCatalogListItem,
  type CatalogFilterState,
} from "../../library/activity-catalog-view-model";
import { getPlanningBlockLabel } from "../application/planning-library-bridge";

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
] satisfies ReadonlyArray<{ id: LibraryTab; label: string }>;

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function PlanningLibraryBridgeSheet({
  visible,
  blockKey,
  onClose,
  onAddCatalogActivity,
  onAddExerciseLink,
}: Props) {
  const { colors } = useAppTheme();
  const [activeTab, setActiveTab] = useState<LibraryTab>("catalog");
  const [filters, setFilters] = useState<CatalogFilterState>(EMPTY_CATALOG_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] =
    useState<ActivityCatalogListItem | null>(null);
  const [linkQuery, setLinkQuery] = useState("");
  const [links, setLinks] = useState<Exercise[]>([]);
  const [linksError, setLinksError] = useState("");
  const [loadingLinks, setLoadingLinks] = useState(false);

  const catalogItems = useMemo(() => buildActivityCatalogListItems(), []);
  const options = useMemo(() => getCatalogFilterOptions(catalogItems), [catalogItems]);
  const filteredCatalogItems = useMemo(
    () => filterActivityCatalogItems(catalogItems, filters),
    [catalogItems, filters]
  );
  const filteredLinks = useMemo(() => {
    const query = normalize(linkQuery.trim());
    if (!query) return links;
    return links.filter((exercise) =>
      normalize(
        [
          exercise.title,
          exercise.description,
          exercise.notes,
          exercise.source,
          exercise.tags.join(" "),
          exercise.videoUrl,
        ].join(" ")
      ).includes(query)
    );
  }, [linkQuery, links]);

  useEffect(() => {
    if (!visible) {
      setSelectedCatalogItem(null);
      setShowFilters(false);
      return;
    }
    setActiveTab("catalog");
  }, [visible]);

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

  if (!visible || !blockKey) return null;

  const addCatalogItem = (item: ActivityCatalogListItem) => {
    onAddCatalogActivity(item);
    setSelectedCatalogItem(null);
  };

  return (
    <>
      <ModalDialogFrame
        visible={visible}
        onClose={onClose}
        colors={colors}
        title="Adicionar atividade"
        subtitle={`Destino: ${getPlanningBlockLabel(blockKey)}`}
        position="center"
        cardStyle={{ width: "100%", maxWidth: 920, height: "88%" }}
        contentContainerStyle={{ gap: 14, paddingBottom: 18, paddingTop: 14 }}
      >
        <AnimatedSegmentedTabs<LibraryTab>
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          itemMinHeight={38}
        />

        {activeTab === "catalog" ? (
          <View style={{ gap: 12 }}>
            <ActivityCatalogFilters
              filters={filters}
              options={options}
              resultCount={filteredCatalogItems.length}
              onChange={setFilters}
              onOpenFilters={() => setShowFilters(true)}
            />
            {filteredCatalogItems.length ? (
              <View style={{ gap: 12 }}>
                {filteredCatalogItems.map((item) => (
                  <ActivityCatalogVideoCard
                    key={item.id}
                    item={item}
                    onView={setSelectedCatalogItem}
                    onAddToLesson={addCatalogItem}
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
              <Ionicons name="search-outline" size={18} color={colors.muted} />
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
              <View style={{ gap: 10 }}>
                {filteredLinks.map((exercise) => (
                  <LinkCard
                    key={exercise.id}
                    exercise={exercise}
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

function LinkCard({
  exercise,
  onAdd,
}: {
  exercise: Exercise;
  onAdd: (exercise: Exercise) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      testID={`planning-link-card-${exercise.id}`}
      style={{
        gap: 8,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>
            {exercise.title || "Vídeo/link"}
          </Text>
          {exercise.description ? (
            <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12 }}>
              {exercise.description}
            </Text>
          ) : null}
          {exercise.source ? (
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>
              {exercise.source}
            </Text>
          ) : null}
        </View>
        <View
          style={{
            paddingHorizontal: 9,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: colors.infoBg,
          }}
        >
          <Text style={{ color: colors.infoText, fontSize: 11, fontWeight: "900" }}>
            Vídeo/link
          </Text>
        </View>
      </View>
      <Pressable
        testID={`planning-add-link-${exercise.id}`}
        onPress={() => onAdd(exercise)}
        style={{
          minHeight: 38,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 6,
          backgroundColor: colors.primaryBg,
        }}
      >
        <Ionicons name="add" size={18} color={colors.primaryText} />
        <Text style={{ color: colors.primaryText, fontSize: 13, fontWeight: "900" }}>
          Adicionar ao bloco
        </Text>
      </Pressable>
    </View>
  );
}
