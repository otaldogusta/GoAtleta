import { useState } from "react";
import { TextInput, View, useWindowDimensions } from "react-native";
import type { ScoutingSide, Student } from "../../core/models";
import { compactUiMetrics as metrics, radius, spacing } from "../../theme/tokens";
import { OperationalText as Text } from "../../ui/OperationalText";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useAppTheme } from "../../ui/app-theme";
import { Choice, Copy, Input, Link } from "./ScoutingUI";
import { CollectorHelp } from "./ScoutingCollectionParts";
import { ScoutingLineupCourt } from "./ScoutingLineupCourt";
import type { ScoutingLineup } from "./scouting-bench";

type Props = {
  setNumber: number; initialSet: string; onInitialSet: (value: string) => void; nextSet: boolean;
  scoreUs: string; scoreThem: string; onScoreUs: (value: string) => void; onScoreThem: (value: string) => void;
  teamName: string; opponent: string; serve: ScoutingSide; onServe: (value: ScoutingSide) => void;
  rotation: number | null; onRotation: (value: number | null) => void; courtEnabled: boolean;
  students: Student[]; jerseys: ReadonlyMap<string, string>; lineup: ScoutingLineup;
  disabled: boolean; onEditRoster: () => void;
};

/** Draft-only preparation; the parent retains the explicit start_set command. */
export function ScoutingBenchSetup(props: Props) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [options, setOptions] = useState(false), [expandedCourt, setExpandedCourt] = useState(false);
  const collapsedCourt = width < 768 && !expandedCourt;
  const titleStyle = { color: colors.text, fontSize: metrics.titleFontSize, lineHeight: metrics.titleLineHeight, fontWeight: "700" as const };
  const divider = { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.xs };
  return <View testID="scouting-bench-setup" style={{ gap: spacing.xs }}>
    <View style={divider}>
      <View style={{ minHeight: metrics.touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={titleStyle}>Set {Number.isFinite(props.setNumber) ? props.setNumber : "—"}</Text>
        <CollectorHelp label="Preparar coleta"><Copy>Confira o placar e quem saca. Em Opções do set, ajuste o set e a posição inicial do levantador. A coleta começa somente ao confirmar.</Copy></CollectorHelp>
      </View>
      {([ [props.teamName, props.scoreUs, props.onScoreUs, colors.primaryBg], [props.opponent, props.scoreThem, props.onScoreThem, colors.info] ] as const).map(([name, value, onChangeText, tone], index) => <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 54 }}>
        <View style={{ width: 3, height: 18, borderRadius: 1, backgroundColor: tone }} />
        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20, fontWeight: "600", color: colors.text }}>{name}</Text>
        <View style={{ width: 76, minHeight: 50, borderRadius: radius.internal, paddingHorizontal: 14, justifyContent: "center", backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border }}>
          <TextInput accessibilityLabel={index === 0 ? "Placar da nossa equipe" : "Placar do adversário"} value={value} onChangeText={onChangeText} editable={!props.disabled} keyboardType="number-pad" maxLength={3} selectTextOnFocus style={{ minHeight: 48, borderRadius: 0, color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "700", textAlign: "right", fontVariant: ["tabular-nums"] }} />
        </View>
      </View>)}
    </View>
    {props.courtEnabled ? <View style={divider}>
      <View style={{ minHeight: metrics.touchTarget, flexDirection: "row", alignItems: "center" }}>
        {width < 768 ? <Pressable accessibilityRole="button" accessibilityLabel={collapsedCourt ? "Expandir quadra" : "Recolher quadra"} accessibilityState={{ expanded: !collapsedCourt }} onPress={() => setExpandedCourt(value => !value)} style={{ minHeight: metrics.touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.xs }}><Text style={titleStyle}>Em quadra</Text><GoAtletaIcon name={collapsedCourt ? "chevronDown" : "chevronUp"} size={metrics.secondaryIconSize} color={colors.muted} /></Pressable> : <Text style={titleStyle}>Em quadra</Text>}
      </View>
      <ScoutingLineupCourt students={props.students} jerseys={props.jerseys} lineup={props.lineup} collapsed={collapsedCourt} readOnly />
      <Link icon="students" label={`Elenco · ${props.students.length}`} disabled={props.disabled} onPress={props.onEditRoster} />
    </View> : <Link icon="students" label={`Elenco · ${props.students.length}`} disabled={props.disabled} onPress={props.onEditRoster} />}
    <View style={{ gap: spacing.xs, paddingVertical: spacing.xs }}>
      <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: "600", color: colors.text }}>Saque inicial</Text>
      <View style={{ flexDirection: "row", gap: spacing.xs }}><Choice label="Nosso time" accessibilityLabel="Nossa equipe saca" selected={props.serve === "us"} disabled={props.disabled} onPress={() => props.onServe("us")} /><Choice label="Adversário" accessibilityLabel="Adversário saca" selected={props.serve === "them"} disabled={props.disabled} onPress={() => props.onServe("them")} /></View>
    </View>
    {!props.nextSet || props.courtEnabled ? <>
      <Pressable accessibilityRole="button" accessibilityLabel="Opções do set" accessibilityState={{ expanded: options, disabled: props.disabled }} disabled={props.disabled} onPress={() => setOptions(value => !value)} style={{ minHeight: metrics.touchTarget, flexDirection: "row", gap: spacing.xs, alignItems: "center" }}><GoAtletaIcon name="options" size={metrics.iconSize} color={colors.muted} /><Text style={{ flex: 1, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight, color: colors.muted }}>Opções do set</Text><GoAtletaIcon name={options ? "chevronUp" : "chevronDown"} size={metrics.secondaryIconSize} color={colors.muted} /></Pressable>
      {options ? <View style={{ gap: spacing.sm, paddingBottom: spacing.xs }}>
        {!props.nextSet ? <Input label="Set inicial" value={props.initialSet} onChangeText={props.onInitialSet} keyboardType="number-pad" maxLength={2} editable={!props.disabled} /> : null}
        {props.courtEnabled ? <><Copy>Posição do levantador · opcional</Copy><View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>{[1, 6, 5, 4, 3, 2].map(n => <Choice key={n} label={`P${n}`} selected={props.rotation === n} disabled={props.disabled} onPress={() => props.onRotation(props.rotation === n ? null : n)} />)}</View></> : null}
      </View> : null}
    </> : null}
  </View>;
}
