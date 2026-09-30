// perf-check: ignore-inline-row-style - bounded monthly preview, styles depend on selection and theme.
import { useLayoutEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useAppTheme } from "../../../ui/app-theme";
import { Button } from "../../../ui/Button";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { radius, spacing } from "../../../theme/tokens";
import { previewProfilePlans, applyProfilePlanPreview, type ProfilePlanPreview } from "../../planning/application/review-profile-plans";

type Props = Parameters<typeof previewProfilePlans>[0] & { onApplied: () => void };
const describePlan = (plan: ProfilePlanPreview["before"]) => [plan.title,
  `Aquecimento · ${plan.warmupTime}`, ...plan.warmup,
  `Parte principal · ${plan.mainTime}`, ...plan.main,
  `Volta à calma · ${plan.cooldownTime}`, ...plan.cooldown,
].filter(Boolean).join("\n");
export function ProfilePlanReview(props: Props) {
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ProfilePlanPreview[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [applied, setApplied] = useState(0);
  const scope = `${props.classGroup.organizationId}:${props.classGroup.id}`;
  const scopeRef = useRef(scope);
  useLayoutEffect(() => { scopeRef.current = scope; }, [scope]);
  const load = async () => {
    setVisible(true); setBusy(true); setError(""); setRows([]); setSelected([]); setApplied(0);
    try { const previews = await previewProfilePlans(props); if (scopeRef.current === scope) setRows(previews); }
    catch { if (scopeRef.current === scope) setError("Não foi possível carregar a prévia. Verifique a conexão e tente novamente."); }
    finally { if (scopeRef.current === scope) setBusy(false); }
  };
  const apply = async () => {
    setBusy(true); setError("");
    let count = 0;
    try {
      for (const row of rows.filter(item => selected.includes(item.before.id))) {
        if (scopeRef.current !== scope) return;
        await applyProfilePlanPreview(props.classGroup, row);
        count++;
        setRows(previous => previous.filter(item => item.before.id !== row.before.id));
        setSelected(previous => previous.filter(id => id !== row.before.id));
        setApplied(previous => previous + 1);
      }
    } catch { if (scopeRef.current === scope) setError("A aplicação foi interrompida. Planos alterados ou realizados ficam protegidos. Tente novamente ou recarregue a prévia."); }
    finally { if (scopeRef.current === scope) { setBusy(false); if (count) props.onApplied(); } }
  };
  return <>
    <Button label={`Perfil v${props.classGroup.pedagogicalProfile?.version} · Revisar planos futuros`} variant="ghost" onPress={() => void load()} />
    <ModalSheet visible={visible} onClose={() => !busy && setVisible(false)} position="center" cardStyle={{ width: "100%", maxWidth: 720, maxHeight: "88%", padding: spacing.md, borderRadius: radius.container, backgroundColor: colors.background, gap: spacing.sm }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>Planos futuros deste mês</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>Selecione as aulas que deseja ajustar. Originais, aulas realizadas e edições manuais são preservados.</Text>
      {busy ? <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>Processando…</Text> : null}
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: colors.dangerText }}>{error}</Text> : null}
      {applied ? <Text style={{ color: colors.text }}>{applied} plano(s) ajustado(s).</Text> : null}
      {!busy && !error && !rows.length ? <Text style={{ color: colors.muted }}>Nenhum plano automático pendente de ajuste neste mês.</Text> : null}
      <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
        {rows.map(row => <View key={row.before.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.internal, padding: 12, gap: 8 }}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(row.before.id), disabled: busy }} disabled={busy} onPress={() => setSelected(previous => previous.includes(row.before.id) ? previous.filter(id => id !== row.before.id) : [...previous, row.before.id])} style={{ minHeight: 40, justifyContent: "center" }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{selected.includes(row.before.id) ? "☑" : "☐"} {row.before.applyDate} · {row.before.title}</Text>
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Atual</Text>
          <Text style={{ color: colors.text, fontSize: 13 }}>{describePlan(row.before)}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Prévia · Perfil v{row.version}</Text>
          <Text style={{ color: colors.text, fontSize: 13 }}>{describePlan(row.after)}</Text>
        </View>)}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 8 }}>
        <Button label="Fechar" variant="ghost" disabled={busy} onPress={() => setVisible(false)} />
        {error ? <Button label="Recarregar prévia" variant="ghost" disabled={busy} onPress={() => void load()} /> : null}
        <Button label={`Aplicar em ${selected.length} aula(s)`} disabled={busy || !selected.length} onPress={() => void apply()} />
      </View>
    </ModalSheet>
  </>;
}
