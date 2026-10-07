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
  const distribution = options.map(option => ({ ...option,
    count: selected.filter(c => c.result_key === option.key).reduce((total, c) => total + c.count, 0),
    color: option.level === 0 ? colors.danger : option.level === 1 ? colors.warning : option.level === 2 ? colors.info : colors.success,
  }));
  return <View style={{ gap: 18 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{captureFundamentals.map(f => <Choice compact key={f} label={skillLabel(f)} selected={skill === f} onPress={() => setSkill(f)} />)}</View>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
      <Text style={{ fontSize: 30, fontWeight: "700", color: colors.text }}>{metric.value == null ? "—" : `${metric.value}%`}</Text>
      <View style={{ flex: 1, gap: 4 }}><Copy>{skill === "ataque" ? "eficiência de ataque" : skill === "saque" ? "saques que dificultaram ou pontuaram" : skill === "recepcao" ? "recepções boas ou completas" : "resultados de nível 2 ou 3"}</Copy>
        <Copy muted>{skill === "ataque" ? `(${metric.points} pontos − ${metric.errors} erros) ÷ ${metric.denominator} ataques classificados` : `${metric.numerator} de ${metric.denominator} ações observadas`}</Copy>
      </View>
    </View>
    <View accessible={false} style={{ flexDirection: "row", backgroundColor: colors.border, height: 10, borderRadius: 5, overflow: "hidden" }}>{distribution.map(option => <View key={option.key} style={{ width: `${metric.total ? option.count / metric.total * 100 : 0}%`, height: 10, backgroundColor: option.color }} />)}</View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>{distribution.map(option => <View key={option.key} style={{ flex: 1, minWidth: 100, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: option.color }} /><View style={{ flex: 1 }}><Copy muted>{option.label}</Copy></View><Copy>{option.count}</Copy>
    </View>)}</View>
    {old.length ? <Copy muted>{amount(old.reduce((n, c) => n + c.count, 0), "ação antiga", "ações antigas")} com classificação preservada. Bloqueios sem desfecho conhecido ficam fora da eficiência.</Copy> : null}
    <Copy muted>{metric.total ? `${amount(metric.total, "ação observada", "ações observadas")}. Amostra parcial; não representa todos os contatos da equipe.` : "Sem ações deste fundamento no recorte."}</Copy>
  </View>;
}
