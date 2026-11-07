import { View, type ViewStyle } from "react-native";
import Svg, { Line, Polygon, Rect } from "react-native-svg";
import type { Student } from "../../core/models";
import { brandPalette, radius } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { OperationalText as Text } from "../../ui/OperationalText";
import { Pressable } from "../../ui/Pressable";
import { benchCourtZones, type ScoutingLineup } from "./scouting-bench";

type Props = {
  students: Student[];
  jerseys?: ReadonlyMap<string, string>;
  lineup: ScoutingLineup;
  collapsed?: boolean;
  disabled?: boolean;
  athleteChosen?: boolean;
  studentId?: string | null;
  onStudent?: (id: string) => void;
  onEmpty?: () => void;
  readOnly?: boolean;
};

/** The same six explicit lineup slots, viewed from behind the baseline. */
function CourtSurface() {
  return <Svg width="100%" height="100%" viewBox="0 0 340 210">
    <Rect width={340} height={210} fill="#194451" />
    <Polygon points="34,42 306,42 330,198 10,198" fill="#ad6a39" stroke={brandPalette.areia} strokeWidth={2} />
    <Polygon points="34,42 306,42 317.7,118 22.3,118" fill="#bc7a47" />
    <Line x1={22.3} y1={118} x2={317.7} y2={118} stroke={brandPalette.areia} strokeWidth={1.6} />
    <Polygon points="34,42 306,42 330,198 10,198" fill="none" stroke={brandPalette.areia} strokeWidth={2} />
    <Rect x={34} y={20} width={272} height={22} fill={brandPalette.navyDeep} fillOpacity={.28} />
    {Array.from({ length: 33 }, (_, index) => <Line key={`v${index}`} x1={34 + index * 8.5} y1={20} x2={34 + index * 8.5} y2={42} stroke={brandPalette.areia} strokeOpacity={.48} strokeWidth={.65} />)}
    {[25.5, 31, 36.5].map(y => <Line key={y} x1={34} y1={y} x2={306} y2={y} stroke={brandPalette.areia} strokeOpacity={.48} strokeWidth={.65} />)}
    <Line x1={34} y1={20} x2={306} y2={20} stroke={brandPalette.areia} strokeWidth={2.5} />
    <Line x1={34} y1={42} x2={306} y2={42} stroke={brandPalette.areia} strokeWidth={1.5} />
    <Line x1={34} y1={16} x2={34} y2={46} stroke={brandPalette.areia} strokeWidth={2} />
    <Line x1={306} y1={16} x2={306} y2={46} stroke={brandPalette.areia} strokeWidth={2} />
  </Svg>;
}

/** Presentation only; persistence and selection remain explicit caller actions. */
export function ScoutingLineupCourt({ students, jerseys, lineup, collapsed = false, disabled = false, athleteChosen = false, studentId, onStudent, onEmpty, readOnly = false }: Props) {
  const { colors } = useAppTheme();
  const onCourt = lineup.map(id => students.find(student => student.id === id)).filter((student): student is Student => !!student);
  return <View testID="scouting-lineup-court" style={{ height: collapsed ? 64 : undefined, aspectRatio: collapsed ? undefined : 340 / 210, width: "100%", maxWidth: collapsed ? undefined : 340, alignSelf: "center", overflow: "hidden", borderRadius: radius.internal, backgroundColor: colors.backgroundSubtle }}>
    {!collapsed ? <View pointerEvents="none" accessible={false} accessibilityElementsHidden style={{ position: "absolute", inset: 0 }}><CourtSurface /></View> : null}
    <View testID="scouting-lineup-targets" style={{ position: "absolute", left: collapsed ? 0 : "6%", right: collapsed ? 0 : "6%", top: collapsed ? 0 : "24%", bottom: collapsed ? 0 : "5%", minWidth: collapsed ? 264 : undefined, flexDirection: "row", flexWrap: collapsed ? "nowrap" : "wrap" }}>{benchCourtZones.map((zone, index) => {
      const student = students.find(value => value.id === lineup[index]);
      const nameParts = student?.name.trim().split(/\s+/) ?? [];
      const homonym = !!student && !jerseys?.get(student.id) && onCourt.some(other => other.id !== student.id && !jerseys?.get(other.id) && other.name.trim().split(/\s+/)[0].localeCompare(nameParts[0], 'pt-BR', { sensitivity: 'base' }) === 0);
      const initialCollision = homonym && onCourt.some(other => {
        const parts = other.name.trim().split(/\s+/);
        return other.id !== student?.id && !jerseys?.get(other.id) && parts[0].localeCompare(nameParts[0], 'pt-BR', { sensitivity: 'base' }) === 0 && parts.at(-1)!.charAt(0).localeCompare(nameParts.at(-1)!.charAt(0), 'pt-BR', { sensitivity: 'base' }) === 0;
      });
      const displayName = student ? homonym && nameParts.length > 1 ? `${nameParts[0]} ${initialCollision ? nameParts.at(-1) : `${nameParts.at(-1)!.charAt(0)}.`}` : nameParts[0] : `Z${zone}`;
      const actionable = !readOnly && (student ? !!onStudent : !!onEmpty);
      const selected = !readOnly && !!student && athleteChosen && studentId === student.id;
      const label = student ? `Zona ${zone}, ${jerseys?.get(student.id) ? `camisa ${jerseys.get(student.id)}, ` : ""}${student.name}` : actionable ? `Definir atleta na zona ${zone}` : `Zona ${zone}, sem atleta`;
      const style: ViewStyle = { width: collapsed ? "16.666%" : "33.333%", minWidth: 44, minHeight: 44, height: collapsed ? "100%" : "50%", alignItems: "center", justifyContent: "center", gap: 3, opacity: !readOnly && disabled ? .55 : 1 };
      const content = <>
        <View style={{ height: 32, width: 32, borderRadius: 16, borderWidth: 1.5, borderColor: brandPalette.areia, backgroundColor: selected ? colors.primaryBg : colors.background, alignItems: "center", justifyContent: "center" }}>{student ? jerseys?.get(student.id) ? <Text style={{ fontSize: 16, lineHeight: 20, fontWeight: "700", color: selected ? colors.primaryText : colors.text }}>{jerseys.get(student.id)}</Text> : <GoAtletaIcon name="profile" size={16} color={colors.text} /> : actionable ? <GoAtletaIcon name="add" size={16} color={colors.text} /> : <Text style={{ fontSize: 16, lineHeight: 20, color: colors.muted }}>—</Text>}</View>
        <Text numberOfLines={1} ellipsizeMode="tail" style={{ maxWidth: "100%", color: collapsed ? colors.text : brandPalette.white, fontSize: 13, lineHeight: 18, fontWeight: "600" }}>{displayName}</Text>
      </>;
      return actionable ? <Pressable key={zone} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => { if (student) onStudent?.(student.id); else onEmpty?.(); }} style={style}>{content}</Pressable>
        : <View key={zone} accessible accessibilityLabel={label} style={style}>{content}</View>;
    })}</View>
  </View>;
}
