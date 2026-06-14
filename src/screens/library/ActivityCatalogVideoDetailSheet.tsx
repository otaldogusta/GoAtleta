import { useEffect, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";

import { ModalDialogFrame } from "../../ui/ModalDialogFrame";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { ActivityCatalogThumbnail } from "./ActivityCatalogThumbnail";
import {
  ageStageLabels,
  complexityLabels,
  demandLabels,
  environmentLabels,
  formatLabels,
  gamePhaseLabels,
  loadLabels,
  pedagogicalIntentLabels,
  phaseIntentLabels,
  phaseLabels,
  progressionLabels,
  skillLabels,
} from "./activity-catalog-labels";
import {
  getActivityCatalogCardChips,
  getCatalogActivityDetailSections,
  getCatalogActivityPrimaryBadge,
  getCatalogActivityShortFamilyLabel,
  type ActivityCatalogListItem,
} from "./activity-catalog-view-model";

type Props = {
  item: ActivityCatalogListItem | null;
  onClose: () => void;
  onAddToLesson: (item: ActivityCatalogListItem) => void;
};

export function ActivityCatalogVideoDetailSheet({
  item,
  onClose,
  onAddToLesson,
}: Props) {
  const { colors } = useAppTheme();
  const dimensions = useWindowDimensions();
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  useEffect(() => {
    setShowTechnicalDetails(false);
  }, [item?.id]);

  if (!item) return null;

  const { variant } = item;
  const taxonomy = variant.taxonomy;
  const chips = getActivityCatalogCardChips(item);
  const modalHeight = Math.min(dimensions.height * 0.9, 760);
  const technicalRows = [
    ["Fundamento", skillLabels[taxonomy.skill]],
    ["Fase do jogo", gamePhaseLabels[taxonomy.gamePhase]],
    ["Intenção pedagógica", pedagogicalIntentLabels[taxonomy.pedagogicalIntent]],
    ["Dificuldade", complexityLabels[taxonomy.complexity]],
    ["Idade/estágio", taxonomy.ageRange.map((ageStage) => ageStageLabels[ageStage]).join(", ")],
    ["Formato", formatLabels[taxonomy.format]],
    ["Ambiente", environmentLabels[taxonomy.environment]],
    ["Demanda cognitiva", demandLabels[taxonomy.cognitiveDemand]],
    ["Demanda física", demandLabels[taxonomy.physicalDemand]],
    ["Fase recomendada", phaseLabels[taxonomy.recommendedPhase]],
    [
      "Periodização",
      taxonomy.periodizationCompatibility.map((phase) => phaseIntentLabels[phase]).join(", "),
    ],
    [
      "Progressão",
      taxonomy.progressionCompatibility
        .map((progression) => progressionLabels[progression])
        .join(", "),
    ],
    ["Carga", taxonomy.loadCompatibility.map((load) => loadLabels[load]).join(", ")],
  ];

  return (
    <ModalDialogFrame
      visible
      onClose={onClose}
      colors={colors}
      title={variant.name}
      subtitle={getCatalogActivityShortFamilyLabel(item)}
      position="center"
      cardStyle={{ width: "100%", maxWidth: 760, height: modalHeight }}
      contentContainerStyle={{ gap: 16, paddingBottom: 20, paddingTop: 14 }}
      footer={
        <Pressable
          testID="activity-catalog-use-in-plan"
          onPress={() => onAddToLesson(item)}
          style={{
            minHeight: 46,
            borderRadius: 14,
            backgroundColor: colors.primaryBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "900" }}>
            Adicionar à aula
          </Text>
        </Pressable>
      }
    >
      <ActivityCatalogThumbnail
        item={item}
        badge={getCatalogActivityPrimaryBadge(item)}
        size="detail"
      />

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>
          {variant.name}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "800" }}>
          {getCatalogActivityShortFamilyLabel(item)}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {chips.map((chip) => (
            <View
              key={chip}
              testID="activity-catalog-detail-chip"
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ color: colors.secondaryText, fontSize: 12, fontWeight: "800" }}>
                {chip}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {getCatalogActivityDetailSections(item).map((section) => (
        <View key={section.title} style={{ gap: 7 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>
            {section.title}
          </Text>
          {section.lines.map((line) => (
            <Text
              key={line}
              style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}
            >
              {line}
            </Text>
          ))}
        </View>
      ))}

      <View style={{ gap: 8 }}>
        <Pressable
          testID="activity-catalog-toggle-technical-details"
          onPress={() => setShowTechnicalDetails((current) => !current)}
          style={{
            minHeight: 42,
            borderRadius: 12,
            paddingHorizontal: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.secondaryBg,
          }}
        >
          <Text style={{ color: colors.secondaryText, fontWeight: "900" }}>
            Detalhes técnicos
          </Text>
        </Pressable>
        {showTechnicalDetails ? (
          <View testID="activity-catalog-technical-details" style={{ gap: 8 }}>
            {technicalRows.map(([label, value]) => (
              <View
                key={label}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  paddingBottom: 7,
                }}
              >
                <Text style={{ flex: 1, color: colors.muted, fontSize: 12 }}>
                  {label}
                </Text>
                <Text
                  style={{
                    flex: 1.4,
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: "800",
                    textAlign: "right",
                  }}
                >
                  {value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </ModalDialogFrame>
  );
}
