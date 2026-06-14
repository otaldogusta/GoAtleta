import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { ActivityCatalogCard } from "./ActivityCatalogCard";
import { ActivityCatalogDetailModal } from "./ActivityCatalogDetailModal";
import { ActivityCatalogFilters } from "./ActivityCatalogFilters";
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
  const [detailItem, setDetailItem] = useState<ActivityCatalogListItem | null>(null);
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
          padding: 12,
          borderRadius: 8,
          backgroundColor: colors.infoBg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ color: colors.infoText, fontSize: 12, fontWeight: "700" }}>
          Mostrando catalogo geral. Para recomendacoes contextualizadas, abra o catalogo a partir de uma turma ou aula.
        </Text>
      </View>

      <ActivityCatalogFilters
        filters={filters}
        options={options}
        resultCount={filteredItems.length}
        onChange={setFilters}
      />

      <View style={{ gap: 10 }}>
        {filteredItems.map((item) => (
          <ActivityCatalogCard
            key={item.id}
            item={item}
            onPress={setDetailItem}
          />
        ))}
        {!filteredItems.length ? (
          <View
            testID="activity-catalog-empty-state"
            style={{
              padding: 14,
              borderRadius: 8,
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

      <ActivityCatalogDetailModal
        item={detailItem}
        selectedActivity={selectedActivity}
        onClose={() => setDetailItem(null)}
        onUseInPlan={setSelectedActivity}
      />
    </View>
  );
}
