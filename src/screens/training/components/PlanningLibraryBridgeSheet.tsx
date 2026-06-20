import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";

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

const defaultPhaseByBlock: Record<TrainingPlanBlockKey, ActivityPatternStage> = {
  warmup: "warmup",
  main: "drill",
  cooldown: "cooldown",
};

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
  const { height, width } = useWindowDimensions();
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
          <Ionicons name="search-outline" size={17} color={colors.muted} />
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
          <Ionicons
            name={active ? "options" : "options-outline"}
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
              <Ionicons name="eye-outline" size={16} color={colors.secondaryText} />
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
              <Ionicons name="add" size={17} color={colors.primaryText} />
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
