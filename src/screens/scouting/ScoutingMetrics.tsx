import { useState } from "react";
import { View, Text } from "react-native";
import type { ScoutingActionFundamental } from "../../core/models";
import { captureFundamentals, getCaptureResultOptions, scoutingWeightedMetric } from "../../core/scouting-rallies";
import type { ScoutingCount } from "../../db/scouting-collection";
import { useAppTheme } from "../../ui/app-theme";
import { amount, Copy, Choice, skillLabel } from "./ScoutingUI";

export function ScoutingMetrics({ counts }: { counts: ScoutingCount[] }) {
  const [skill, setSkill] = useState<ScoutingActionFundamental>("recepcao");
  const { colors } = useAppTheme();
  const metric = scoutingWeightedMetric(counts, skill);
  const options = getCaptureResultOptions(skill);
  const selected = counts.filter(c => c.fundamental === skill);
  const old = selected.filter(c => !options.some(o => o.key === c.result_key));
  return <View style={{ gap: 18 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{captureFundamentals.map(f => <Choice compact key={f} label={skillLabel(f)} selected={skill === f} onPress={() => setSkill(f)} />)}</View>
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
      <Text style={{ fontSize: 30, fontWeight: "700", color: colors.text }}>{metric.value == null ? "—" : `${metric.value}%`}</Text>
      <Copy muted>{skill === "ataque" ? "eficiência de ataque" : skill === "saque" ? "dificultaram ou foram ace" : skill === "recepcao" ? "boas ou completas" : "resultados de nível 2 ou 3"} · {amount(metric.denominator, "ação", "ações")}</Copy>
    </View>
    {options.map(option => {
      const n = selected.filter(c => c.result_key === option.key).reduce((total, c) => total + c.count, 0);
      const color = option.level === 0 ? colors.danger : option.level === 1 ? colors.warning : option.level === 2 ? colors.info : colors.primaryBg;
      return <View key={option.key} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 105 }}><Copy>{option.label}</Copy></View>
        <View style={{ flex: 1, backgroundColor: colors.border, height: 6, borderRadius: 3 }}><View style={{ width: `${metric.total ? n / metric.total * 100 : 0}%`, height: 6, borderRadius: 3, backgroundColor: color }} /></View>
        <View style={{ width: 72, alignItems: "flex-end" }}><Copy muted>{n} · {metric.total ? Math.round(n / metric.total * 100) : 0}%</Copy></View>
      </View>;
    })}
    {old.length ? <Copy muted>{amount(old.reduce((n, c) => n + c.count, 0), "ação antiga", "ações antigas")} com classificação preservada. Bloqueios sem desfecho conhecido ficam fora da eficiência.</Copy> : null}
    <Copy muted>{metric.total ? `${amount(metric.total, "ação observada", "ações observadas")}. Amostra parcial; não representa todos os contatos da equipe.` : "Sem ações deste fundamento no recorte."}</Copy>
  </View>;
}
