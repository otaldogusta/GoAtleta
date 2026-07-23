import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { ModalDialogFrame } from "../../ui/ModalDialogFrame";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import {
  ageStageLabels,
  complexityLabels,
  environmentLabels,
  formatLabels,
  phaseLabels,
} from "./activity-catalog-labels";
import {
  EMPTY_CATALOG_FILTERS,
  type CatalogFilterOptions,
  type CatalogFilterState,
} from "./activity-catalog-view-model";

type Props = {
  visible: boolean;
  filters: CatalogFilterState;
  options: CatalogFilterOptions;
  onApply: (filters: CatalogFilterState) => void;
  onClose: () => void;
};

export function ActivityCatalogFilterSheet({
  visible,
  filters,
  options,
  onApply,
  onClose,
}: Props) {
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState<CatalogFilterState>(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [filters, visible]);

  const apply = () => {
    onApply(draft);
    onClose();
  };

  const clear = () => {
    const next = { ...EMPTY_CATALOG_FILTERS, query: filters.query, skill: filters.skill };
    setDraft(next);
    onApply(next);
    onClose();
  };

  return (
    <ModalDialogFrame
      visible={visible}
      onClose={onClose}
      colors={colors}
      title="Filtros do catálogo"
      subtitle="Refine a vitrine sem abrir todos os metadados na tela principal."
      position="bottom"
      cardStyle={{ width: "100%", maxWidth: 720, maxHeight: "86%" }}
      contentContainerStyle={{ gap: 14, paddingTop: 14, paddingBottom: 18 }}
      footer={
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            testID="catalog-filter-clear"
            onPress={clear}
            style={{
              flex: 1,
              minHeight: 42,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Text style={{ color: colors.secondaryText, fontWeight: "900" }}>
              Limpar filtros
            </Text>
          </Pressable>
          <Pressable
            testID="catalog-filter-apply"
            onPress={apply}
            style={{
              flex: 1,
              minHeight: 42,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primaryBg,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "900" }}>
              Aplicar filtros
            </Text>
          </Pressable>
        </View>
      }
    >
      <FilterRow
        title="Família"
        values={[
          { value: "", label: "Todas" },
          ...options.families.map((family) => ({
            value: family.id,
            label: family.label,
          })),
        ]}
        activeValue={draft.familyId}
        testPrefix="catalog-family-filter"
        onSelect={(familyId) => setDraft({ ...draft, familyId })}
      />
      <FilterRow
        title="Idade/estágio"
        values={[
          { value: "", label: "Todos" },
          ...options.ageStages.map((value) => ({
            value,
            label: ageStageLabels[value],
          })),
        ]}
        activeValue={draft.ageStage}
        testPrefix="catalog-age-filter"
        onSelect={(ageStage) => setDraft({ ...draft, ageStage: ageStage as CatalogFilterState["ageStage"] })}
      />
      <FilterRow
        title="Dificuldade"
        values={[
          { value: "", label: "Todas" },
          ...options.complexities.map((value) => ({
            value,
            label: complexityLabels[value],
          })),
        ]}
        activeValue={draft.complexity}
        testPrefix="catalog-complexity-filter"
        onSelect={(complexity) =>
          setDraft({ ...draft, complexity: complexity as CatalogFilterState["complexity"] })
        }
      />
      <FilterRow
        title="Fase recomendada"
        values={[
          { value: "", label: "Todas" },
          ...options.recommendedPhases.map((value) => ({
            value,
            label: phaseLabels[value],
          })),
        ]}
        activeValue={draft.recommendedPhase}
        testPrefix="catalog-phase-filter"
        onSelect={(recommendedPhase) =>
          setDraft({
            ...draft,
            recommendedPhase: recommendedPhase as CatalogFilterState["recommendedPhase"],
          })
        }
      />
      <FilterRow
        title="Formato"
        values={[
          { value: "", label: "Todos" },
          ...options.formats.map((value) => ({
            value,
            label: formatLabels[value],
          })),
        ]}
        activeValue={draft.format}
        testPrefix="catalog-format-filter"
        onSelect={(format) => setDraft({ ...draft, format: format as CatalogFilterState["format"] })}
      />
      <FilterRow
        title="Ambiente"
        values={[
          { value: "", label: "Todos" },
          ...options.environments.map((value) => ({
            value,
            label: environmentLabels[value],
          })),
        ]}
        activeValue={draft.environment}
        testPrefix="catalog-environment-filter"
        onSelect={(environment) =>
          setDraft({ ...draft, environment: environment as CatalogFilterState["environment"] })
        }
      />
      <Pressable
        testID="catalog-filter-close"
        onPress={onClose}
        style={{
          minHeight: 38,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.secondaryBg,
        }}
      >
        <Text style={{ color: colors.secondaryText, fontWeight: "900" }}>
          Fechar
        </Text>
      </Pressable>
    </ModalDialogFrame>
  );
}

function FilterRow({
  title,
  values,
  activeValue,
  testPrefix,
  onSelect,
}: {
  title: string;
  values: { value: string; label: string }[];
  activeValue: string;
  testPrefix: string;
  onSelect: (value: string) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
      >
        {values.map((item) => {
          const active = item.value === activeValue;
          const idSuffix = item.value || "all";
          return (
            <Pressable
              key={idSuffix}
              testID={`${testPrefix}-${idSuffix}`}
              onPress={() => onSelect(active ? "" : item.value)}
              style={{
                minHeight: 34,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? colors.successBorder : colors.border,
                backgroundColor: active ? colors.successBg : colors.card,
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
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
