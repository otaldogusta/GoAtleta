import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";
import { getSectionCardStyle } from "../../../ui/section-styles";
import { ModalSheet } from "../../../ui/ModalSheet";
import type { VolumeLevel } from "../../../core/periodization-basics";

type WeekPlan = {
  title: string;
  focus: string;
  volume: VolumeLevel;
  notes: string[];
  source: "AUTO" | "MANUAL";
};

type DayItem = {
  label: string;
};

type ClassGroup = {
  id: string;
  name: string;
  unit?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  modalCardStyle: object;
  colors: ThemeColors;
  selectedDay: DayItem | null | undefined;
  isSelectedDayRest: boolean;
  selectedClass: ClassGroup | null | undefined;
  selectedDayDate: Date | null | undefined;
  activeWeek: WeekPlan;
  formatDisplayDate: (iso: string) => string;
  formatIsoDate: (value: Date) => string;
  getVolumePalette: (level: VolumeLevel, colors: ThemeColors) => { bg: string; text: string };
  volumeToPSE: Record<VolumeLevel, string>;
  normalizeText: (value: string) => string;
};

export function DayModal({
  visible,
  onClose,
  modalCardStyle,
  colors,
  selectedDay,
  isSelectedDayRest,
  selectedClass,
  selectedDayDate,
  activeWeek,
  formatDisplayDate,
  formatIsoDate,
  getVolumePalette,
  volumeToPSE,
  normalizeText,
}: Props) {
  const router = useRouter();

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      cardStyle={[modalCardStyle, { paddingBottom: 12 }]}
      position="center"
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
          {selectedDay
            ? isSelectedDayRest
              ? normalizeText(`Descanso de ${selectedDay.label}`)
              : normalizeText(`Sessão de ${selectedDay.label}`)
            : normalizeText("Sessão")}
        </Text>

        <Pressable
          onPress={onClose}
          style={{
            height: 32,
            paddingHorizontal: 12,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.secondaryBg,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
            Fechar
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
        style={{ maxHeight: "92%" }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        <View style={getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16 })}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Turma</Text>
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            {normalizeText(selectedClass?.name ?? "Selecione uma turma")}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {normalizeText(selectedClass?.unit ?? "Sem unidade")}
          </Text>
          {selectedDayDate ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {"Data sugerida: " + formatDisplayDate(formatIsoDate(selectedDayDate))}
            </Text>
          ) : null}
        </View>

        <View style={getSectionCardStyle(colors, "info", { padding: 12, radius: 16 })}>
          {isSelectedDayRest ? (
            <>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {normalizeText("Dia de descanso")}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {normalizeText("Sem sessão planejada para este dia.")}
              </Text>
            </>
          ) : (
            <>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {normalizeText(activeWeek.title)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {normalizeText(`Foco: ${activeWeek.focus}`)}
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                {(() => {
                  const palette = getVolumePalette(activeWeek.volume, colors);
                  const sourcePalette =
                    activeWeek.source === "MANUAL"
                      ? { bg: colors.warningBg, text: colors.warningText }
                      : { bg: colors.secondaryBg, text: colors.text };

                  return (
                    <>
                      <View
                        style={{
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                          borderRadius: 999,
                          backgroundColor: palette.bg,
                        }}
                      >
                        <Text style={{ color: palette.text, fontSize: 11 }}>
                          {normalizeText(`Volume: ${activeWeek.volume}`)}
                        </Text>
                      </View>

                      <View
                        style={{
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                          borderRadius: 999,
                          backgroundColor: sourcePalette.bg,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: sourcePalette.text, fontSize: 11, fontWeight: "700" }}>
                          {activeWeek.source}
                        </Text>
                      </View>
                    </>
                  );
                })()}

                <View
                  style={{
                    paddingVertical: 3,
                    paddingHorizontal: 8,
                    borderRadius: 999,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 11 }}>
                    {normalizeText(volumeToPSE[activeWeek.volume])}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 4, marginTop: 8 }}>
                {activeWeek.notes.map((note) => (
                  <Text key={note} style={{ color: colors.muted, fontSize: 12 }}>
                    {normalizeText(`- ${note}`)}
                  </Text>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />

        <Pressable
          onPress={() => {
            if (!selectedClass || !selectedDayDate || isSelectedDayRest) return;
            router.push({
              pathname: "/prof/planning",
              params: {
                targetClassId: selectedClass.id,
                targetDate: formatIsoDate(selectedDayDate),
                openForm: "1",
              },
            });
            onClose();
          }}
          style={{
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor:
              selectedClass && !isSelectedDayRest ? colors.primaryBg : colors.primaryDisabledBg,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color:
                selectedClass && !isSelectedDayRest
                  ? colors.primaryText
                  : colors.secondaryText,
              fontWeight: "700",
            }}
          >
            {isSelectedDayRest ? "Dia de descanso" : "Criar plano de aula"}
          </Text>
        </Pressable>
      </ScrollView>
    </ModalSheet>
  );
}
