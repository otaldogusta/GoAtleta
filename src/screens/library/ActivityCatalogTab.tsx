import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { ActivityCatalogFilterSheet } from "./ActivityCatalogFilterSheet";
import { ActivityCatalogFilters } from "./ActivityCatalogFilters";
import { ActivityCatalogSuggestionConfirmModal } from "./ActivityCatalogSuggestionConfirmModal";
import { ActivityCatalogVideoCard } from "./ActivityCatalogVideoCard";
import { ActivityCatalogVideoDetailSheet } from "./ActivityCatalogVideoDetailSheet";
import {
  EMPTY_CATALOG_FILTERS,
  buildActivityCatalogListItems,
  filterActivityCatalogItems,
  getCatalogFilterOptions,
  type ActivityCatalogListItem,
  type CatalogFilterState,
  type SelectedCatalogActivity,
} from "./activity-catalog-view-model";

export function ActivityCatalogTab() {
  const { colors } = useAppTheme();
  const [filters, setFilters] = useState<CatalogFilterState>(EMPTY_CATALOG_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [detailItem, setDetailItem] = useState<ActivityCatalogListItem | null>(null);
  const [pendingSuggestion, setPendingSuggestion] =
    useState<SelectedCatalogActivity | null>(null);
  const [selectedActivity, setSelectedActivity] =
    useState<SelectedCatalogActivity | null>(null);

  const items = useMemo(() => buildActivityCatalogListItems(), []);
  const options = useMemo(() => getCatalogFilterOptions(items), [items]);
  const filteredItems = useMemo(
    () => filterActivityCatalogItems(items, filters),
    [filters, items]
  );

  return (
    <View testID="activity-catalog-tab" style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: colors.secondaryBg,
        }}
      >
        <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", flex: 1 }}>
          Catálogo geral. Abra a partir de uma turma ou aula para ver sugestões contextualizadas.
        </Text>
      </View>

      <ActivityCatalogFilters
        filters={filters}
        options={options}
        resultCount={filteredItems.length}
        onChange={setFilters}
        onOpenFilters={() => setShowFilters(true)}
      />

      {selectedActivity ? (
        <View
          testID="activity-catalog-local-selection"
          style={{
            padding: 12,
            borderRadius: 14,
            backgroundColor: colors.infoBg,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.infoText, fontSize: 13, fontWeight: "800" }}>
            Sugestão preparada: {selectedActivity.variantName}. O plano não foi alterado.
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {filteredItems.map((item) => (
          <View key={item.id} style={{ flexGrow: 1, flexBasis: 280, maxWidth: 420 }}>
            <ActivityCatalogVideoCard
              item={item}
              onView={setDetailItem}
              onSuggest={setPendingSuggestion}
            />
          </View>
        ))}
        {!filteredItems.length ? (
          <View
            testID="activity-catalog-empty-state"
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <Text style={{ color: colors.muted }}>
              Nenhuma atividade encontrada para os filtros selecionados.
            </Text>
          </View>
        ) : null}
      </View>

      <ActivityCatalogFilterSheet
        visible={showFilters}
        filters={filters}
        options={options}
        onApply={setFilters}
        onClose={() => setShowFilters(false)}
      />

      <ActivityCatalogVideoDetailSheet
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onSuggest={setPendingSuggestion}
      />

      <ActivityCatalogSuggestionConfirmModal
        activity={pendingSuggestion}
        onCancel={() => setPendingSuggestion(null)}
        onConfirm={(activity) => {
          setSelectedActivity(activity);
          setPendingSuggestion(null);
        }}
      />
    </View>
  );
}
