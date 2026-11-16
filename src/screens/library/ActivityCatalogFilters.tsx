import { TextInput, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { Pressable } from "../../ui/Pressable";
import { CompactSelect } from "../../ui/CompactSelect";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { skillLabels } from "./activity-catalog-labels";
import { type CatalogFilterOptions, type CatalogFilterState } from "./activity-catalog-view-model";

type Props = {
  filters: CatalogFilterState;
  options: CatalogFilterOptions;
  resultCount: number;
  onChange: (filters: CatalogFilterState) => void;
  onOpenFilters: () => void;
};

export function ActivityCatalogFilters({ filters, options, resultCount, onChange, onOpenFilters }: Props) {
  const { colors } = useAppTheme();
  const extraCount = Object.entries(filters).filter(([key, value]) => key !== "query" && key !== "skill" && Boolean(value)).length;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10,
        borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.inputBg }}>
        <GoAtletaIcon name="search" size={16} color={colors.muted} />
        <TextInput testID="catalog-search-input" accessibilityLabel="Buscar atividade no catálogo"
          placeholder="Buscar atividade" placeholderTextColor={colors.placeholder} value={filters.query}
          onChangeText={(query) => onChange({ ...filters, query })}
          style={{ flex: 1, minWidth: 0, paddingVertical: 10, borderRadius: 0, color: colors.inputText }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <CompactSelect label="Fundamento" value={filters.skill}
          options={[{ value: "", label: "Todos" }, ...options.skills.map((skill) => ({ value: skill, label: skillLabels[skill] }))]}
          onChange={(skill) => onChange({ ...filters, skill: skill as CatalogFilterState["skill"] })} />
        <Pressable testID="catalog-open-filters" accessibilityRole="button" aria-haspopup="dialog" onPress={onOpenFilters}
          accessibilityLabel={extraCount ? `Mais filtros, ${extraCount} ativos` : "Mais filtros"} suppressWebHoverFeedback
          style={{ minHeight: 44, paddingHorizontal: 4, flexDirection: "row", gap: 6, alignItems: "center", borderRadius: 8 }}>
          <GoAtletaIcon name="options" size={16} color={colors.muted} />
          <Text style={{ color: colors.text, fontSize: 12 }}>Filtros{extraCount ? ` · ${extraCount}` : ""}</Text>
        </Pressable>
      </View>
      <Text accessibilityLiveRegion="polite" role="status" style={{ color: colors.muted, fontSize: 11, paddingBottom: 8 }}>
        {resultCount === 1 ? "1 atividade" : `${resultCount} atividades`}
      </Text>
    </View>
  );
}
