import { useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const fallback = new Date();
  return match ? { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) } : { year: fallback.getFullYear(), month: fallback.getMonth(), day: fallback.getDate() };
}

type Props = {
  visible: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
};

export function CalendarMonthPicker(props: Props) {
  return props.visible ? <CalendarMonthPickerContent key={props.value} {...props} /> : null;
}

function CalendarMonthPickerContent({ visible, value, onChange, onClose }: Props) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const selected = parseDate(value);
  const [year, setYear] = useState(selected.year);
  const [choosingYear, setChoosingYear] = useState(false);
  const [yearPage, setYearPage] = useState(Math.max(1, Math.floor(selected.year / 12) * 12));

  const selectMonth = (month: number) => {
    const lastDay = new Date(0);
    lastDay.setFullYear(year, month + 1, 0);
    const day = Math.min(selected.day, lastDay.getDate());
    onChange(`${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    onClose();
  };
  const years = Array.from({ length: 12 }, (_, index) => yearPage + index);

  return <ModalSheet visible={visible} onClose={onClose} position={width < 600 ? "bottom" : "center"} cardStyle={[styles.card, { backgroundColor: colors.card }]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={choosingYear ? "Anos anteriores" : "Ano anterior"} onPress={() => choosingYear ? setYearPage(current => Math.max(1, current - 12)) : setYear(current => Math.max(1, current - 1))} style={styles.control}>
        <GoAtletaIcon name="chevronBack" size={18} color={colors.text} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={choosingYear ? "Escolher mês" : "Escolher ano"} onPress={() => { setYearPage(Math.max(1, Math.floor(year / 12) * 12)); setChoosingYear(current => !current); }} style={styles.year}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>{choosingYear ? `${years[0]}–${years[11]}` : year}</Text>
        <GoAtletaIcon name={choosingYear ? "chevronUp" : "chevronDown"} size={14} color={colors.muted} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={choosingYear ? "Próximos anos" : "Próximo ano"} onPress={() => choosingYear ? setYearPage(current => Math.min(9988, current + 12)) : setYear(current => Math.min(9999, current + 1))} style={styles.control}>
        <GoAtletaIcon name="chevronForward" size={18} color={colors.text} />
      </Pressable>
    </View>
    <View style={styles.grid}>
      {(choosingYear ? years : MONTHS).map((item, index) => {
        const active = choosingYear ? item === year : index === selected.month && year === selected.year;
        return <View key={item} style={styles.cell}>
          <Pressable accessibilityRole="button" accessibilityLabel={choosingYear ? `Selecionar ano ${item}` : `Selecionar mês ${item} de ${year}`} accessibilityState={{ selected: active }} onPress={() => {
            if (choosingYear) { setYear(Number(item)); setChoosingYear(false); }
            else selectMonth(index);
          }} style={[styles.circle, { backgroundColor: active ? colors.primaryBg : "transparent", borderWidth: 1, borderColor: active ? colors.primaryBg : colors.border }]}>
            <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 14, fontWeight: active ? "700" : "500" }}>{choosingYear ? item : MONTH_LABELS[index]}</Text>
          </Pressable>
        </View>;
      })}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Cancelar seleção de mês" onPress={onClose} style={styles.cancel}><Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Cancelar</Text></Pressable>
  </ModalSheet>;
}

const styles = StyleSheet.create({
  card: { width: "100%", maxWidth: 360, alignSelf: "center", borderRadius: 24, padding: 12, gap: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 4 },
  control: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  year: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 22 },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  cell: { width: "25%", alignItems: "center" },
  circle: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  cancel: { minHeight: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
