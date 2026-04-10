import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type {
  LessonPlanDraft,
  PedagogicalObjective,
  PedagogicalPlanBlock,
  PedagogicalPlanBlockName,
  PedagogicalPlanPackage,
} from "../../../core/pedagogical-planning";
import { Button } from "../../../ui/Button";
import { ModalSheet } from "../../../ui/ModalSheet";
import { useAppTheme } from "../../../ui/app-theme";

const objectiveLabelMap: Record<PedagogicalObjective, string> = {
  controle_bola: "Controle de bola",
  passe: "Passe",
  resistencia: "Resistência",
  jogo_reduzido: "Jogo reduzido",
};

const blockTitleMap: Record<PedagogicalPlanBlockName, string> = {
  aquecimento: "Aquecimento",
  principal: "Parte principal",
  volta_calma: "Volta à calma",
};

const constraintLabelMap: Record<string, string> = {
  evitar_impacto: "Evitar impacto",
  evitar_corrida: "Evitar corrida",
  limitacao_membro_inferior: "Limitação de membro inferior",
  sem_quadra: "Sem quadra",
  tempo_reduzido: "Tempo reduzido",
  espaco_limitado: "Espaço limitado",
};

const cleanUiText = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/^\s*\d+\s*min(?:utos?)?\s*[-•:]?\s*/i, "")
    .replace(/\b[a-z]{2,}_[a-z0-9_]{3,}\b/gi, "")
    .replace(/\bnivel\b/gi, "nível")
    .replace(/\bvariacoes\b/gi, "variações")
    .replace(/\borganizacao\b/gi, "organização")
    .replace(/\bacao\b/gi, "ação")
    .replace(/\s{2,}/g, " ")
    .replace(/^[-•\s]+|[-•\s]+$/g, "")
    .trim();

const compactAttentionText = (value: string) => {
  const text = cleanUiText(value);
  return text
    .replace(/^Nivel baixo:\s*/i, "")
    .replace(/^Turma heterogenea:\s*/i, "")
    .replace(/nivel real dos subgrupos/gi, "subgrupos por nível")
    .replace(/\.$/, "");
};

const isTechnicalActivityKey = (value: string | null | undefined) => {
  const text = String(value ?? "").trim();
  if (!text) return false;
  return /^[a-z0-9]+(?:_[a-z0-9]+){2,}$/i.test(text) || /(?:^|_)vwv(?:_|$)/i.test(text);
};

const getActivityDisplayText = (activity: { name?: string | null; description?: string | null }) => {
  const description = cleanUiText(activity?.description);
  const name = cleanUiText(activity?.name);
  const technical = isTechnicalActivityKey(activity?.name);
  if (technical) {
    return description || "Atividade planejada";
  }
  return description || name || "Atividade planejada";
};

const getActivityEditableText = (activity: { name?: string | null; description?: string | null }) => {
  const raw = String(activity?.description ?? activity?.name ?? "");
  if (isTechnicalActivityKey(raw)) {
    return "";
  }
  return cleanUiText(raw);
};

type PreviewModalProps = {
  visible: boolean;
  planPackage: PedagogicalPlanPackage | null;
  onClose: () => void;
  onConfirm: (editedDraft?: LessonPlanDraft) => void;
  onRegenerate: (variationSeed: number) => void;
  saving?: boolean;
  regenerating?: boolean;
};

export function PedagogicalPlanPreviewModal({
  visible,
  planPackage,
  onClose,
  onConfirm,
  onRegenerate,
  saving,
  regenerating,
}: PreviewModalProps) {
  const { colors } = useAppTheme();
  const [showLogicDetails, setShowLogicDetails] = useState(false);
  const [editingDraft, setEditingDraft] = useState<LessonPlanDraft | null>(null);
  const [selectedBlockName, setSelectedBlockName] = useState<PedagogicalPlanBlockName | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const analysis = planPackage?.analysis;
  const sourceDraft = planPackage?.final ?? planPackage?.generated ?? null;
  const classGroup = planPackage?.input.classGroup;

  useEffect(() => {
    if (!visible || !sourceDraft) return;
    setSelectedBlockName(null);
    setHasChanges(false);
    // Isolated editable state to avoid mutating generated/final payloads directly.
    setEditingDraft(JSON.parse(JSON.stringify(sourceDraft)) as LessonPlanDraft);
  }, [visible, sourceDraft]);

  const draft = editingDraft ?? sourceDraft;

  const objectiveKey = planPackage?.input.objective as PedagogicalObjective | undefined;
  const objectiveLabel = objectiveKey ? objectiveLabelMap[objectiveKey] : "";
  const hardConstraintLabels =
    analysis?.hardConstraints.map((item) => constraintLabelMap[item] ?? item) ?? [];
  const softConstraintLabels =
    analysis?.softConstraints.map((item) => constraintLabelMap[item] ?? item) ?? [];
  const summaryLine = [
    classGroup?.name,
    analysis?.level ? `Nível ${analysis.level}` : null,
    analysis?.heterogeneity ? `Heterogeneidade ${analysis.heterogeneity}` : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const contextWarning = [
    ...hardConstraintLabels,
    ...softConstraintLabels,
    ...(analysis?.constraintsImpact ?? []),
  ][0];

  const updateBlock = (blockName: PedagogicalPlanBlockName, updater: (block: PedagogicalPlanBlock) => PedagogicalPlanBlock) => {
    setEditingDraft((current) => {
      if (!current) return current;
      const block = current[blockName === "aquecimento" ? "warmup" : blockName === "principal" ? "main" : "cooldown"];
      const updated = updater(block);
      if (blockName === "aquecimento") {
        return { ...current, warmup: updated };
      }
      if (blockName === "principal") {
        return { ...current, main: updated };
      }
      return { ...current, cooldown: updated };
    });
  };

  const updateActivityText = (
    blockName: PedagogicalPlanBlockName,
    activityId: string,
    nextText: string
  ) => {
    const text = String(nextText ?? "");
    setHasChanges(true);
    updateBlock(blockName, (block) => ({
      ...block,
      activities: block.activities.map((activity) =>
        activity.id === activityId
          ? { ...activity, name: text, description: text }
          : activity
      ),
    }));
  };

  const updateDurationText = (blockName: PedagogicalPlanBlockName, value: string) => {
    const sanitized = String(value ?? "").replace(/[^0-9]/g, "");
    if (!sanitized) return;
    const numeric = Number.parseInt(sanitized, 10);
    if (!Number.isFinite(numeric)) return;
    const next = Math.max(1, numeric);
    setHasChanges(true);
    updateBlock(blockName, (current) => ({
      ...current,
      duration: next,
    }));
  };

  const getBlockLeadText = (block: PedagogicalPlanBlock) => {
    if (block.summary) {
      return cleanUiText(block.summary) || block.summary;
    }
    if (block.activities[0]?.name) {
      return getActivityDisplayText(block.activities[0]);
    }
    return block.name === "principal"
      ? objectiveLabel || "Controle de bola"
      : block.name === "aquecimento"
        ? "Ativação e preparação"
        : "Autoavaliação + feedback";
  };

  const selectedBlock =
    draft && selectedBlockName
      ? selectedBlockName === "aquecimento"
        ? draft.warmup
        : selectedBlockName === "principal"
          ? draft.main
          : draft.cooldown
      : null;

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      position="center"
      overlayZIndex={32000}
      backdropOpacity={0.72}
      cardStyle={{
        width: "100%",
        maxWidth: 980,
        maxHeight: "90%",
        borderRadius: 24,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>
              Prévia pedagógica
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{summaryLine || "Plano da sessão"}</Text>
          </View>
          <Pressable
            onPress={onClose}
            style={{
              height: 32,
              width: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </View>
        {contextWarning ? (
          <Text style={{ color: colors.warningText, fontSize: 12 }}>⚠ {cleanUiText(contextWarning)}</Text>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
        showsVerticalScrollIndicator={true}
        persistentScrollbar={true}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => setSelectedBlockName(null)}
      >
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
          Plano da aula
        </Text>

        {objectiveLabel ? (
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
            {objectiveLabel}
          </Text>
        ) : null}

        {draft ? (
          <View style={{ gap: 10 }}>
            {([draft.warmup, draft.main, draft.cooldown] as const).map((block) => {
              const leadText = getBlockLeadText(block);
              return (
                <Pressable
                  key={block.name}
                  onPress={() => setSelectedBlockName(block.name)}
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
                      {blockTitleMap[block.name]}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
                        {block.duration} min
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                    </View>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>
                    {leadText}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {(planPackage?.draft.manualReviewFlags.length || planPackage?.draft.adaptations.length || planPackage?.draft.explanations.length) ? (
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 6 }}>
            Sugestões do sistema (não entram no plano)
          </Text>
        ) : null}

        {planPackage?.draft.manualReviewFlags.length ? (
          <View
            style={{
              padding: 14,
              borderRadius: 18,
              backgroundColor: colors.warningBg,
              borderWidth: 1,
              borderColor: colors.warningBg,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.warningText, fontSize: 16, fontWeight: "800" }}>
              Atenções do professor
            </Text>
            {planPackage.draft.manualReviewFlags.map((flag, index) => (
              <Text key={`${flag}_${index}`} style={{ color: colors.warningText, fontSize: 12 }}>
                • {compactAttentionText(flag)}
              </Text>
            ))}
          </View>
        ) : null}

        <View
          style={{
            padding: 14,
            borderRadius: 18,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
          }}
        >
          <Pressable
            onPress={() => setShowLogicDetails((current) => !current)}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
              Ver lógica pedagógica →
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {showLogicDetails ? "Ocultar" : ""}
            </Text>
          </Pressable>

          {showLogicDetails ? (
            <View style={{ gap: 8 }}>
              {planPackage?.draft.adaptations.length ? (
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                    Adaptações aplicadas
                  </Text>
                  {planPackage.draft.adaptations.map((adaptation, index) => (
                    <Text
                      key={`${adaptation.target}_${index}`}
                      style={{ color: colors.muted, fontSize: 12 }}
                    >
                      • {cleanUiText(adaptation.action)}
                    </Text>
                  ))}
                </View>
              ) : null}

              {planPackage?.draft.explanations.length ? (
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                    Justificativas do motor
                  </Text>
                  {planPackage.draft.explanations.map((item, index) => (
                    <Text key={`${item.source}_${index}`} style={{ color: colors.muted, fontSize: 12 }}>
                      • {cleanUiText(item.message)}
                    </Text>
                  ))}
                </View>
              ) : null}

              {hardConstraintLabels.length || softConstraintLabels.length ? (
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                    Restrições consideradas
                  </Text>
                  {[...hardConstraintLabels, ...softConstraintLabels].map((item, index) => (
                    <Text key={`${item}_${index}`} style={{ color: colors.muted, fontSize: 12 }}>
                      • {cleanUiText(item)}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {selectedBlock ? (
        <ModalSheet
          visible={true}
          onClose={() => setSelectedBlockName(null)}
          position="center"
          overlayZIndex={33000}
          backdropOpacity={0.72}
          cardStyle={{
            width: "100%",
            maxWidth: 760,
            maxHeight: "85%",
            borderRadius: 22,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              {blockTitleMap[selectedBlock.name]}
            </Text>
            <Pressable
              onPress={() => setSelectedBlockName(null)}
              style={{
                height: 30,
                width: 30,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="close" size={16} color={colors.text} />
            </Pressable>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
              Duração (min)
            </Text>
            <TextInput
              value={String(selectedBlock.duration)}
              keyboardType="number-pad"
              onChangeText={(text) => updateDurationText(selectedBlock.name, text)}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
                fontSize: 15,
                fontWeight: "600",
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
              Resumo
            </Text>
            <TextInput
              value={selectedBlock.summary ?? getBlockLeadText(selectedBlock)}
              multiline
              textAlignVertical="top"
              onChangeText={(nextText) => {
                setHasChanges(true);
                updateBlock(selectedBlock.name, (current) => ({
                  ...current,
                  summary: String(nextText ?? ""),
                }));
              }}
              placeholder="Resumo do bloco"
              placeholderTextColor={colors.muted}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
                fontSize: 14,
                minHeight: 72,
              }}
            />
          </View>

          <View style={{ gap: 8, flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
              Atividades
            </Text>
            <ScrollView
              style={{ maxHeight: 280 }}
              contentContainerStyle={{ gap: 8 }}
              showsVerticalScrollIndicator={true}
            >
              {selectedBlock.activities.length ? (
                selectedBlock.activities.map((activity) => (
                  <TextInput
                    key={activity.id}
                    value={getActivityEditableText(activity)}
                    multiline
                    textAlignVertical="top"
                    onChangeText={(nextText) => updateActivityText(selectedBlock.name, activity.id, nextText)}
                    placeholder="Descreva atividade"
                    placeholderTextColor={colors.muted}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      backgroundColor: colors.inputBg,
                      color: colors.inputText,
                      fontSize: 14,
                      minHeight: 64,
                    }}
                  />
                ))
              ) : (
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  Sem atividades sugeridas.
                </Text>
              )}
            </ScrollView>
          </View>
        </ModalSheet>
      ) : null}

      <View style={{ gap: 8, paddingTop: 4 }}>
        {hasChanges ? (
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
            Alterações serão salvas no plano
          </Text>
        ) : null}
        <Button
          label={regenerating ? "Gerando..." : "Gerar nova variação"}
          variant="secondary"
          onPress={() => onRegenerate(Date.now())}
          disabled={!planPackage || saving || regenerating}
          loading={regenerating}
        />
        <Button
          label="Salvar plano de aula"
          onPress={() => onConfirm(editingDraft && hasChanges ? editingDraft : undefined)}
          loading={saving}
          disabled={!planPackage || saving || regenerating}
        />
      </View>
    </ModalSheet>
  );
}
