import { Text, TextInput, View } from "react-native";

import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { skillLabels } from "./activity-catalog-labels";
import {
  hasActiveCatalogFilters,
  type CatalogFilterOptions,
  type CatalogFilterState,
} from "./activity-catalog-view-model";

type Props = {
  filters: CatalogFilterState;
  options: CatalogFilterOptions;
  resultCount: number;
  onChange: (filters: CatalogFilterState) => void;
  onOpenFilters: () => void;
};

export function ActivityCatalogFilters({
  filters,
  options,
  resultCount,
  onChange,
  onOpenFilters,
}: Props) {
  const { colors } = useAppTheme();
  const active = hasActiveCatalogFilters(filters);

  return (
    <View
      style={{
        gap: 12,
        padding: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
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
          testID="catalog-search-input"
          placeholder="Buscar atividade..."
          placeholderTextColor={colors.placeholder}
          value={filters.query}
          onChangeText={(query) => onChange({ ...filters, query })}
          style={{ flex: 1, paddingVertical: 2, color: colors.inputText }}
        />
        <GoAtletaIcon name="search" size={18} color={colors.muted} />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
          Fundamento
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <QuickFilterChip
            label="Todos"
            active={!filters.skill}
            testID="catalog-skill-filter-all"
            onPress={() => onChange({ ...filters, skill: "" })}
          />
          {options.skills.map((skill) => (
            <QuickFilterChip
              key={skill}
              label={skillLabels[skill]}
              active={filters.skill === skill}
              testID={`catalog-skill-filter-${skill}`}
              onPress={() =>
                onChange({ ...filters, skill: filters.skill === skill ? "" : skill })
              }
            />
          ))}
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ flex: 1, color: colors.muted, fontSize: 14, fontWeight: "700" }}>
          {resultCount} atividades
        </Text>
        <Pressable
          testID="catalog-open-filters"
          onPress={onOpenFilters}
          style={{
            minHeight: 40,
            paddingHorizontal: 14,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: active ? colors.infoBg : colors.secondaryBg,
          }}
        >
          <Text
            style={{
              color: active ? colors.infoText : colors.secondaryText,
              fontSize: 13,
              fontWeight: "900",
            }}
          >
            Filtros
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function QuickFilterChip({
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
        minHeight: 34,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.successBorder : colors.border,
        backgroundColor: active ? colors.successBg : colors.secondaryBg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: active ? colors.successText : colors.text,
          fontSize: 13,
          fontWeight: "800",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
