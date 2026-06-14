import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import {
  ageStageLabels,
  complexityLabels,
  environmentLabels,
  formatLabels,
  phaseLabels,
  skillLabels,
} from "./activity-catalog-labels";
import {
  EMPTY_CATALOG_FILTERS,
  hasActiveCatalogFilters,
  type CatalogFilterOptions,
  type CatalogFilterState,
} from "./activity-catalog-view-model";

type Props = {
  filters: CatalogFilterState;
  options: CatalogFilterOptions;
  resultCount: number;
  onChange: (filters: CatalogFilterState) => void;
};

type ChipProps<T extends string> = {
  label: string;
  value: T | "";
  activeValue: T | "";
  testID?: string;
  onSelect: (value: T | "") => void;
};

function FilterChip<T extends string>({
  label,
  value,
  activeValue,
  testID,
  onSelect,
}: ChipProps<T>) {
  const { colors } = useAppTheme();
  const active = value === activeValue;
  return (
    <Pressable
      testID={testID}
      onPress={() => onSelect(active ? "" : value)}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.successBorder : colors.border,
        backgroundColor: active ? colors.successBg : colors.card,
        minHeight: 30,
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: active ? colors.successText : colors.text,
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type ChipRowProps<T extends string> = {
  title: string;
  values: T[];
  activeValue: T | "";
  labels: Record<T, string>;
  testPrefix: string;
  onSelect: (value: T | "") => void;
};

function ChipRow<T extends string>({
  title,
  values,
  activeValue,
  labels,
  testPrefix,
  onSelect,
}: ChipRowProps<T>) {
  const { colors } = useAppTheme();
  if (!values.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
      >
        <FilterChip
          label="Todos"
          value=""
          activeValue={activeValue}
          testID={`${testPrefix}-all`}
          onSelect={onSelect}
        />
        {values.map((value) => (
          <FilterChip
            key={value}
            label={labels[value]}
            value={value}
            activeValue={activeValue}
            testID={`${testPrefix}-${value}`}
            onSelect={onSelect}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function ActivityCatalogFilters({
  filters,
  options,
  resultCount,
  onChange,
}: Props) {
  const { colors } = useAppTheme();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const active = hasActiveCatalogFilters(filters);
  const hasAdvancedFilter =
    Boolean(
      filters.familyId ||
        filters.ageStage ||
        filters.complexity ||
        filters.recommendedPhase ||
        filters.format ||
        filters.environment
    );
  const advancedLabel =
    showAdvancedFilters || hasAdvancedFilter ? "Menos filtros" : "Mais filtros";
  return (
    <View
      style={{
        gap: 10,
        padding: 10,
        borderRadius: 14,
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
          paddingVertical: 5,
          paddingHorizontal: 10,
          borderRadius: 12,
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
        <Ionicons name="search-outline" size={18} color={colors.muted} />
      </View>

      <ChipRow
        title="Fundamento"
        values={options.skills}
        activeValue={filters.skill}
        labels={skillLabels}
        testPrefix="catalog-skill-filter"
        onSelect={(skill) => onChange({ ...filters, skill })}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ flex: 1, color: colors.muted, fontSize: 13 }}>
          {resultCount} atividades
        </Text>
        <Pressable
          testID="catalog-toggle-advanced-filters"
          onPress={() => setShowAdvancedFilters((current) => !current)}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderRadius: 10,
            backgroundColor:
              showAdvancedFilters || hasAdvancedFilter
                ? colors.infoBg
                : colors.secondaryBg,
          }}
        >
          <Text
            style={{
              color:
                showAdvancedFilters || hasAdvancedFilter
                  ? colors.infoText
                  : colors.secondaryText,
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            {advancedLabel}
          </Text>
        </Pressable>
        {active ? (
          <Pressable
            testID="catalog-clear-filters"
            onPress={() => {
              onChange(EMPTY_CATALOG_FILTERS);
              setShowAdvancedFilters(false);
            }}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 10,
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Text
              style={{
                color: colors.secondaryText,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              Limpar filtros
            </Text>
          </Pressable>
        ) : null}
      </View>

      {showAdvancedFilters || hasAdvancedFilter ? (
        <View style={{ gap: 10 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
              Família
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            >
              <FilterChip
                label="Todas"
                value=""
                activeValue={filters.familyId}
                testID="catalog-family-filter-all"
                onSelect={(familyId) => onChange({ ...filters, familyId })}
              />
              {options.families.map((family) => (
                <FilterChip
                  key={family.id}
                  label={family.label}
                  value={family.id}
                  activeValue={filters.familyId}
                  testID={`catalog-family-filter-${family.id}`}
                  onSelect={(familyId) => onChange({ ...filters, familyId })}
                />
              ))}
            </ScrollView>
          </View>
          <ChipRow
            title="Idade/estágio"
            values={options.ageStages}
            activeValue={filters.ageStage}
            labels={ageStageLabels}
            testPrefix="catalog-age-filter"
            onSelect={(ageStage) => onChange({ ...filters, ageStage })}
          />
          <ChipRow
            title="Dificuldade"
            values={options.complexities}
            activeValue={filters.complexity}
            labels={complexityLabels}
            testPrefix="catalog-complexity-filter"
            onSelect={(complexity) => onChange({ ...filters, complexity })}
          />
          <ChipRow
            title="Fase recomendada"
            values={options.recommendedPhases}
            activeValue={filters.recommendedPhase}
            labels={phaseLabels}
            testPrefix="catalog-phase-filter"
            onSelect={(recommendedPhase) => onChange({ ...filters, recommendedPhase })}
          />
          <ChipRow
            title="Formato"
            values={options.formats}
            activeValue={filters.format}
            labels={formatLabels}
            testPrefix="catalog-format-filter"
            onSelect={(format) => onChange({ ...filters, format })}
          />
          <ChipRow
            title="Ambiente"
            values={options.environments}
            activeValue={filters.environment}
            labels={environmentLabels}
            testPrefix="catalog-environment-filter"
            onSelect={(environment) => onChange({ ...filters, environment })}
          />
        </View>
      ) : null}
    </View>
  );
}
