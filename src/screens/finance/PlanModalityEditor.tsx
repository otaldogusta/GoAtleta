import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { setPlanModality } from "../../api/athlete-modalities";
import { CLASS_MODALITY_OPTIONS, type ClassModality } from "../../core/class-modality";
import { PositionPicker } from "../../ui/PositionPicker";
import { Button } from "../../ui/Button";
import { useAppTheme } from "../../ui/app-theme";
import { useSaveToast } from "../../ui/save-toast";

export function PlanModalityEditor({ organizationId, planId, initial }: { organizationId: string; planId: string; initial: ClassModality | null }) {
  const { colors } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const [value, setValue] = useState<ClassModality[]>(initial ? [initial] : []);
  const [baseline, setBaseline] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const save = async () => {
    if (busy) return;
    const next = value[0] ?? null;
    setBusy(true); setMessage("");
    try {
      await setPlanModality(organizationId, planId, next);
      if (mounted.current) { setBaseline(next); showSaveToast({ message: "Modalidade salva.", variant: "success" }); }
    } catch { if (mounted.current) setMessage("Não foi possível salvar. Tente novamente."); }
    finally { if (mounted.current) setBusy(false); }
  };
  return <View style={{ gap: 8, marginTop: 8 }}>
    <PositionPicker value={value} options={CLASS_MODALITY_OPTIONS} maxSelections={1} onChange={setValue} searchLabel="Modalidade do plano" />
    {(value[0] ?? null) !== baseline ? <Button label="Salvar modalidade" disabled={busy} onPress={() => void save()} /> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>{message}</Text> : null}
  </View>;
}
