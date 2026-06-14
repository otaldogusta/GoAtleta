import { Text, View } from "react-native";

import { ModalDialogFrame } from "../../ui/ModalDialogFrame";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
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
  toSelectedCatalogActivity,
  type ActivityCatalogListItem,
  type SelectedCatalogActivity,
} from "./activity-catalog-view-model";

type Props = {
  item: ActivityCatalogListItem | null;
  selectedActivity: SelectedCatalogActivity | null;
  onClose: () => void;
  onUseInPlan: (activity: SelectedCatalogActivity) => void;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function BodyText({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18 }}>
      {children}
    </Text>
  );
}

function BulletList({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <View style={{ gap: 4 }}>
      {items.map((item) => (
        <BodyText key={item}>- {item}</BodyText>
      ))}
    </View>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingBottom: 6,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
        {label}
      </Text>
      <Text
        style={{
          color: colors.text,
          fontSize: 12,
          fontWeight: "700",
          flex: 1.3,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function ActivityCatalogDetailModal({
  item,
  selectedActivity,
  onClose,
  onUseInPlan,
}: Props) {
  const { colors } = useAppTheme();
  if (!item) return null;

  const { variant } = item;
  const taxonomy = variant.taxonomy;
  const isSelected = selectedActivity?.variantId === variant.id;
  const metadata = [
    ["Fundamento", skillLabels[taxonomy.skill]],
    ["Fase do jogo", gamePhaseLabels[taxonomy.gamePhase]],
    ["Intencao pedagogica", pedagogicalIntentLabels[taxonomy.pedagogicalIntent]],
    ["Dificuldade", complexityLabels[taxonomy.complexity]],
    ["Idade/estagio", taxonomy.ageRange.map((ageStage) => ageStageLabels[ageStage]).join(", ")],
    ["Formato", formatLabels[taxonomy.format]],
    ["Ambiente", environmentLabels[taxonomy.environment]],
    ["Demanda cognitiva", demandLabels[taxonomy.cognitiveDemand]],
    ["Demanda fisica", demandLabels[taxonomy.physicalDemand]],
    ["Fase recomendada", phaseLabels[taxonomy.recommendedPhase]],
    [
      "Periodizacao",
      taxonomy.periodizationCompatibility.map((phase) => phaseIntentLabels[phase]).join(", "),
    ],
    [
      "Progressao",
      taxonomy.progressionCompatibility.map((progression) => progressionLabels[progression]).join(", "),
    ],
    ["Carga", taxonomy.loadCompatibility.map((load) => loadLabels[load]).join(", ")],
  ];

  return (
    <ModalDialogFrame
      visible
      onClose={onClose}
      colors={colors}
      title={variant.name}
      subtitle={item.familyTitle}
      cardStyle={{ width: "100%", maxWidth: 720, maxHeight: "88%" }}
      contentContainerStyle={{ gap: 14, paddingBottom: 18, paddingTop: 14 }}
      footer={
        <Pressable
          testID="activity-catalog-use-in-plan"
          onPress={() => onUseInPlan(toSelectedCatalogActivity(item))}
          style={{
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: colors.primaryBg,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
            Usar no plano
          </Text>
        </Pressable>
      }
    >
      {isSelected ? (
        <View
          testID="activity-catalog-local-selection"
          style={{
            padding: 10,
            borderRadius: 8,
            backgroundColor: colors.infoBg,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.infoText, fontSize: 12, fontWeight: "700" }}>
            A atividade foi marcada como sugestao local. O plano nao foi alterado.
          </Text>
        </View>
      ) : null}

      <Section title="Sugerido porque">
        <BodyText>
          Mostrando catalogo geral. Para recomendacoes contextualizadas, abra o catalogo a partir de uma turma ou aula.
        </BodyText>
      </Section>

      <Section title="Objetivo pedagogico">
        <BodyText>{item.purpose}</BodyText>
      </Section>
      <Section title="Organizacao">
        <BodyText>{variant.players}</BodyText>
        <BodyText>{variant.setup}</BodyText>
      </Section>
      <Section title="Como funciona">
        <BodyText>{variant.starter}</BodyText>
        <BodyText>{variant.action}</BodyText>
      </Section>
      <Section title="Rotacao">
        <BodyText>{variant.rotation}</BodyText>
      </Section>
      {variant.constraint ? (
        <Section title="Restricao">
          <BodyText>{variant.constraint}</BodyText>
        </Section>
      ) : null}
      {variant.scoring ? (
        <Section title="Pontuacao">
          <BodyText>{variant.scoring}</BodyText>
        </Section>
      ) : null}
      {variant.progression ? (
        <Section title="Progressao">
          <BodyText>{variant.progression}</BodyText>
        </Section>
      ) : null}
      <Section title="Adaptacoes">
        <BulletList items={variant.adaptations} />
      </Section>
      <Section title="Cuidados">
        <BulletList items={variant.commonMistakes} />
        <BulletList items={variant.avoid} />
      </Section>
      <Section title="Materiais e espaco">
        <BodyText>Materiais: {variant.materials.join(", ") || "Sem material obrigatorio"}</BodyText>
        <BodyText>Espaco: {variant.space}</BodyText>
      </Section>
      <Section title="Metadados">
        <View style={{ gap: 6 }}>
          {metadata.map(([label, value]) => (
            <MetadataRow key={label} label={label} value={value} />
          ))}
        </View>
      </Section>
    </ModalDialogFrame>
  );
}
