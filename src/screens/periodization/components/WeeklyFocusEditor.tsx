import { useLayoutEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import type { ClassPlan, PlanningCycle } from "../../../core/models";
import { spacing, radius } from "../../../theme/tokens";
import { Button } from "../../../ui/Button";
import { ModalSheet } from "../../../ui/ModalSheet";
import { OperationalText as Text } from "../../../ui/OperationalText";
import type { ThemeColors } from "../../../ui/app-theme";
import { useSaveToast } from "../../../ui/save-toast";
import { updateClassPlanFocus } from "../../../db/periodization";

export function WeeklyFocusEditor({ colors, plan, cycle, onClose, onSaved }: {
  colors: ThemeColors;
  plan: ClassPlan;
  cycle: PlanningCycle;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [initialFocus] = useState(() => (plan.theme || plan.technicalFocus).trim());
  const originalRevision = useRef(plan.updatedAt);
  const [focus, setFocus] = useState(initialFocus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const { showSaveToast } = useSaveToast();
  const label = `Editar foco da semana ${plan.weekNumber}`;

  async function save() {
    const value = focus.trim();
    if (!value || value === initialFocus || savingRef.current) return;
    if (cycle.status !== "active" || plan.cycleId !== cycle.id || plan.updatedAt !== originalRevision.current) {
      setError("A semana mudou. Feche e reabra a edição.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await updateClassPlanFocus({
        classId: cycle.classId,
        cycleId: cycle.id,
        organizationId: cycle.organizationId,
        planId: plan.id,
        updatedAt: plan.updatedAt ?? plan.createdAt,
      }, value);
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error && failure.message.startsWith("A semana mudou.")
        ? failure.message
        : "Não foi possível salvar o foco. Tente novamente.");
      return;
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
    if (!mounted.current) return;
    showSaveToast({ variant: "success", message: "Foco da semana salvo." });
    onSaved();
  }

  return (
    <ModalSheet
      visible
      dialogLabel={label}
      position="center"
      onClose={() => { if (!savingRef.current) onClose(); }}
      cardStyle={{ width: "100%", maxWidth: 440, backgroundColor: colors.background, padding: spacing.md, borderRadius: radius.container, gap: spacing.sm }}
    >
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>O foco vale para a semana inteira, mesmo quando ela começa em outro mês.</Text>
      <View style={{ minHeight: 50, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.inputBg }}>
        <TextInput
          accessibilityLabel="Foco semanal"
          value={focus}
          onChangeText={setFocus}
          editable={!saving}
          multiline
          style={{ minHeight: 50, borderRadius: 0, paddingVertical: 12, color: colors.text, fontSize: 14 }}
        />
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: colors.dangerText }}>{error}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: spacing.sm }}>
        <Button label="Cancelar" variant="ghost" disabled={saving} onPress={onClose} />
        <Button label={saving ? "Salvando" : "Salvar foco"} disabled={saving || !focus.trim() || focus.trim() === initialFocus} onPress={() => void save()} />
      </View>
    </ModalSheet>
  );
}
