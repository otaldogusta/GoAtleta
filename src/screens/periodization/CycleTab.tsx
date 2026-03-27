import { Ionicons } from "@expo/vector-icons";
import { Animated, FlatList, Text, TextInput, View } from "react-native";

import type { ClassGroup } from "../../core/models";
import { type VolumeLevel, volumeOrder } from "../../core/periodization-basics";
import { type ThemeColors } from "../../ui/app-theme";
import { getSectionCardStyle } from "../../ui/section-styles";
import { Pressable } from "../../ui/Pressable";
import { CyclePlanTable, type WeekPlan, type CyclePlanTableProps } from "./CyclePlanTable";

// ── Local helpers ─────────────────────────────────────────────────────────────

const normalizeText = (value: string): string => {
  if (!value) return value;
  let current = String(value);
  for (let i = 0; i < 2; i += 1) {
    current = current.replace(/\\\\u/gi, "\\u").replace(/\\\\U/gi, "\\U");
  }
  for (let i = 0; i < 3; i += 1) {
    const decoded = decodeUnicodeEscapes(tryJsonDecode(current));
    if (decoded === current) break;
    current = decoded;
  }
  if (/\\u[0-9a-fA-F]{4}/.test(current) || /\\U[0-9a-fA-F]{8}/.test(current)) {
    current = decodeUnicodeEscapes(current);
  }
  if (!/[\uFFFD?]/.test(current)) return current;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      current = decodeURIComponent(escape(current));
    } catch {
      break;
    }
    if (!/[\uFFFD?]/.test(current)) return current;
  }
  return current;
};

const tryJsonDecode = (value: string): string => {
  try {
    const parsed = JSON.parse(`"${value}"`);
    return typeof parsed === "string" ? parsed : value;
  } catch {
    return value;
  }
};

const decodeUnicodeEscapes = (value: string): string =>
  value.replace(/\\u([0-9a-fA-F]{4})/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

const getVolumePalette = (level: VolumeLevel, colors: ThemeColors) => {
  if (level === "baixo") {
    return { bg: colors.successBg, text: colors.successText, border: colors.successBg };
  }
  if (level === "médio") {
    return { bg: colors.warningBg, text: colors.warningText, border: colors.warningBg };
  }
  return { bg: colors.dangerBg, text: colors.dangerText, border: colors.dangerBorder };
};

// ── Types ─────────────────────────────────────────────────────────────────────

type SectionOpenState = {
  load: boolean;
  guides: boolean;
  cycle: boolean;
  week: boolean;
};

export type CycleTabProps = {
  // theme
  colors: ThemeColors;

  // CyclePlanTable props (forwarded verbatim)
  cyclePanelCellWidth: number;
  cyclePanelCellGap: number;
  cyclePanelLabelWidth: number;
  cyclePanelRowHeight: number;
  cyclePanelRowGap: number;
  cyclePanelScrollRef: CyclePlanTableProps["cyclePanelScrollRef"];
  isEditingCycleTitle: boolean;
  cycleTitleDraft: string;
  setCycleTitleDraft: (value: string) => void;
  saveCycleTitleEditor: () => void;
  cancelCycleTitleEditor: () => void;
  openCycleTitleEditor: () => void;
  cyclePanelTitle: string;
  hasWeekPlans: boolean;
  weekPlans: WeekPlan[];
  currentWeek: number;
  mesoWeekNumbers: number[];
  monthSegments: Array<{ label: string; length: number }>;
  macroSegments: Array<{ label: string; length: number }>;
  mesoSegments: Array<{ label: string; length: number }>;
  dominantBlockSegments: Array<{ label: string; length: number }>;
  weeklySessions: number;
  periodizationModel: CyclePlanTableProps["periodizationModel"];
  sportProfile: CyclePlanTableProps["sportProfile"];
  openWeekEditor: (week: number) => void;

  // Carga semanal section
  sectionOpen: SectionOpenState;
  toggleSection: (key: "load" | "guides" | "cycle" | "week") => void;
  showLoadContent: boolean;
  loadAnimStyle: any;
  progressBars: number[];
  acwrLimits: { high: string; low: string };
  setAcwrLimits: (v: { high: string; low: string }) => void;
  acwrLimitError: string;
  acwrMessage: string;
  volumeToPSE: Record<VolumeLevel, string>;
  sessionsPerWeek: number;

  // Guias section
  showGuideContent: boolean;
  guideAnimStyle: any;
  summary: string[];

  // Ciclo section
  showCycleContent: boolean;
  cycleAnimStyle: any;
  cycleFilter: "all" | "manual" | "auto";
  setCycleFilter: (value: "all" | "manual" | "auto") => void;
  selectedClass: ClassGroup | null;
  filteredWeekPlans: WeekPlan[];
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CycleTab({
  colors,
  cyclePanelCellWidth,
  cyclePanelCellGap,
  cyclePanelLabelWidth,
  cyclePanelRowHeight,
  cyclePanelRowGap,
  cyclePanelScrollRef,
  isEditingCycleTitle,
  cycleTitleDraft,
  setCycleTitleDraft,
  saveCycleTitleEditor,
  cancelCycleTitleEditor,
  openCycleTitleEditor,
  cyclePanelTitle,
  hasWeekPlans,
  weekPlans,
  currentWeek,
  mesoWeekNumbers,
  monthSegments,
  macroSegments,
  mesoSegments,
  dominantBlockSegments,
  weeklySessions,
  periodizationModel,
  sportProfile,
  openWeekEditor,
  sectionOpen,
  toggleSection,
  showLoadContent,
  loadAnimStyle,
  progressBars,
  acwrLimits,
  setAcwrLimits,
  acwrLimitError,
  acwrMessage,
  volumeToPSE,
  sessionsPerWeek,
  showGuideContent,
  guideAnimStyle,
  summary,
  showCycleContent,
  cycleAnimStyle,
  cycleFilter,
  setCycleFilter,
  selectedClass,
  filteredWeekPlans,
}: CycleTabProps) {
  return (
    <>

      <CyclePlanTable
        colors={colors}
        cyclePanelCellWidth={cyclePanelCellWidth}
        cyclePanelCellGap={cyclePanelCellGap}
        cyclePanelLabelWidth={cyclePanelLabelWidth}
        cyclePanelRowHeight={cyclePanelRowHeight}
        cyclePanelRowGap={cyclePanelRowGap}
        cyclePanelScrollRef={cyclePanelScrollRef}
        isEditingCycleTitle={isEditingCycleTitle}
        cycleTitleDraft={cycleTitleDraft}
        setCycleTitleDraft={setCycleTitleDraft}
        saveCycleTitleEditor={saveCycleTitleEditor}
        cancelCycleTitleEditor={cancelCycleTitleEditor}
        openCycleTitleEditor={openCycleTitleEditor}
        cyclePanelTitle={cyclePanelTitle}
        hasWeekPlans={hasWeekPlans}
        weekPlans={weekPlans}
        currentWeek={currentWeek}
        mesoWeekNumbers={mesoWeekNumbers}
        monthSegments={monthSegments}
        macroSegments={macroSegments}
        mesoSegments={mesoSegments}
        dominantBlockSegments={dominantBlockSegments}
        weeklySessions={weeklySessions}
        periodizationModel={periodizationModel}
        sportProfile={sportProfile}
        openWeekEditor={openWeekEditor}
      />

        <View
          style={[
            getSectionCardStyle(colors, "primary"),
            { borderLeftWidth: 1, borderLeftColor: colors.border },
          ]}
        >

        <Pressable

          onPress={() => toggleSection("load")}

          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}

        >

          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>

            {normalizeText("Carga semanal")}

          </Text>

          <Ionicons

            name={sectionOpen.load ? "chevron-up" : "chevron-down"}

            size={18}

            color={colors.muted}

          />

        </Pressable>

        <Text style={{ color: colors.muted, fontSize: 12 }}>

          {normalizeText("Distribuição de intensidade ao longo do ciclo")}

        </Text>

        { showLoadContent ? (

          <Animated.View style={[{ gap: 12 }, loadAnimStyle]}>

            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>

          {progressBars.map((ratio, index) => {

            const level = weekPlans[index]?.volume ?? "médio";

            const isActive = index + 1 === currentWeek;

            const palette = getVolumePalette(level, colors);

            return (

              <View key={String(index)} style={{ alignItems: "center", gap: 6 }}>

                <View

                  style={{

                    width: 22,

                    height: 120 * ratio + 16,

                    borderRadius: 10,

                    backgroundColor: palette.bg,

                    opacity: isActive ? 1 : 0.55,

                  }}

                />

                <Text style={{ color: colors.muted, fontSize: 11 }}>

                  S{index + 1}

                </Text>

              </View>

            );

            })}

        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>

          {volumeOrder.map((level) => {

            const palette = getVolumePalette(level, colors);

            return (

              <View

                key={level}

                style={{

                  paddingVertical: 3,

                  paddingHorizontal: 8,

                  borderRadius: 999,

                  backgroundColor: palette.bg,

                }}

              >

                <Text style={{ color: palette.text, fontSize: 11 }}>

                  {normalizeText(`${level} - ${volumeToPSE[level]}`)}

                </Text>

              </View>

              );

            })}

        </View>

        <View style={{ gap: 10 }}>

          <Text style={{ color: colors.muted, fontSize: 12 }}>

            Limites de alerta (ACWR)

          </Text>

          <View style={{ flexDirection: "row", gap: 12 }}>

            <View style={{ flex: 1, gap: 6 }}>

              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>

                Alto

              </Text>

              <TextInput

                value={acwrLimits.high}

                onChangeText={(value) =>
                  setAcwrLimits({ ...acwrLimits, high: value.replace(",", ".") })
                }

                keyboardType="numeric"

                placeholder="1.3"

                placeholderTextColor={colors.placeholder}

                style={{

                  borderWidth: 1,

                  borderColor: colors.border,

                  padding: 10,

                  borderRadius: 10,

                  backgroundColor: colors.inputBg,

                  color: colors.inputText,

                }}

              />

            </View>

            <View style={{ flex: 1, gap: 6 }}>

              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>

                Baixo

              </Text>

              <TextInput

                value={acwrLimits.low}

                onChangeText={(value) =>
                  setAcwrLimits({ ...acwrLimits, low: value.replace(",", ".") })
                }

                keyboardType="numeric"

                placeholder="0.8"

                placeholderTextColor={colors.placeholder}

                style={{

                  borderWidth: 1,

                  borderColor: colors.border,

                  padding: 10,

                  borderRadius: 10,

                  backgroundColor: colors.inputBg,

                  color: colors.inputText,

                }}

              />

            </View>

          </View>

          { acwrLimitError ? (

            <Text style={{ color: colors.dangerText, fontSize: 12 }}>

              {acwrLimitError}

            </Text>

          ) : null}

          { !acwrLimitError && acwrMessage ? (

            <Text style={{ color: colors.muted, fontSize: 12 }}>

              {acwrMessage}

            </Text>

          ) : null}

        </View>

          </Animated.View>

        ) : null}

        </View>


      <Pressable

        onPress={() => toggleSection("guides")}

        style={[

          getSectionCardStyle(colors, "neutral"),

          {

            flexDirection: "row",

            alignItems: "center",

            gap: 10,

            paddingVertical: 10,

          },

        ]}

      >

        <View

          style={{

            width: 26,

            height: 26,

            borderRadius: 13,

            alignItems: "center",

            justifyContent: "center",

            backgroundColor: colors.secondaryBg,

          }}

        >

          <Ionicons name="information" size={16} color={colors.text} />

        </View>

        <View style={{ flex: 1 }}>

          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>

            Diretrizes da faixa

          </Text>

          <Text style={{ color: colors.muted, fontSize: 12 }}>

            {normalizeText("Toque para ver as recomendações")}

          </Text>

        </View>

        <Ionicons

          name={sectionOpen.guides ? "chevron-up" : "chevron-down"}

          size={18}

          color={colors.muted}

        />

      </Pressable>

      { showGuideContent ? (

        <Animated.View style={[{ gap: 6 }, guideAnimStyle]}>

          {summary.map((item) => (

            <Text key={item} style={{ color: colors.muted, fontSize: 12 }}>

              {"- " + item}

            </Text>

          ))}

        </Animated.View>

      ) : null}


        <View
          style={[
            getSectionCardStyle(colors, "primary"),
            { borderLeftWidth: 1, borderLeftColor: colors.border },
          ]}
        >

        <Pressable

          onPress={() => toggleSection("cycle")}

          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}

        >

          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>

            {normalizeText("Agenda do ciclo")}

          </Text>

          <Ionicons

            name={sectionOpen.cycle ? "chevron-up" : "chevron-down"}

            size={18}

            color={colors.muted}

          />

        </Pressable>

        <Text style={{ color: colors.muted, fontSize: 12 }}>

          {normalizeText("Semanas com foco e volume definido")}

        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>

          {([

            { id: "all", label: "Todas" },

            { id: "auto", label: "Automáticas" },

            { id: "manual", label: "Ajustadas" },

          ] as const).map((item) => {

            const active = cycleFilter === item.id;

            return (

              <Pressable

                key={item.id}

                onPress={() => setCycleFilter(item.id)}

                style={{

                  paddingVertical: 8,

                  paddingHorizontal: 12,

                  borderRadius: 999,

                  backgroundColor: active ? colors.primaryBg : colors.background,

                  borderWidth: 1,

                  borderColor: active ? colors.primaryBg : colors.border,

                }}

              >

                <Text

                  style={{

                    color: active ? colors.primaryText : colors.text,

                    fontSize: 12,

                    fontWeight: active ? "700" : "500",

                  }}

                >

                  {item.label}

                </Text>

              </Pressable>

            );

          })}

        </View>

        { showCycleContent ? (

          <Animated.View style={[{ gap: 10 }, cycleAnimStyle]}>

          { !selectedClass ? (

            <View

              style={{

                padding: 12,

                borderRadius: 14,

                backgroundColor: colors.inputBg,

                borderWidth: 1,

                borderColor: colors.border,

              }}

            >

              <Text style={{ color: colors.muted, fontSize: 12 }}>

                {normalizeText("Selecione uma turma para editar o ciclo.")}

              </Text>

            </View>

          ) : filteredWeekPlans.length ? (

            <FlatList
              data={filteredWeekPlans}
              keyExtractor={(week, index) => `${week.week}-${index}`}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 10 }}
              renderItem={({ item: week }) => {
                const palette = getVolumePalette(week.volume, colors);
                return (
                  <Pressable
                    onPress={() => openWeekEditor(week.week)}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 10,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>
                        {normalizeText("Semana " + week.week + " - " + week.title)}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                        <View
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 999,
                            backgroundColor: palette.bg,
                          }}
                        >
                          <Text style={{ color: palette.text, fontSize: 11, fontWeight: "700" }}>
                            {normalizeText(week.volume)}
                          </Text>
                        </View>
                        <View
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 10,
                            backgroundColor: colors.background,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                            Abrir editor
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {normalizeText("Foco: " + week.focus)}
                    </Text>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <View
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 999,
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 11 }}>
                          {sessionsPerWeek + " dias"}
                        </Text>
                      </View>

                      <View
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 999,
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 11 }}>
                          {normalizeText(volumeToPSE[week.volume])}
                        </Text>
                      </View>

                      <View
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 999,
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 11 }}>
                          {normalizeText(`PSE alvo: ${week.PSETarget}`)}
                        </Text>
                      </View>

                      <View
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 999,
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 11 }}>
                          {normalizeText("Saltos: " + week.jumpTarget)}
                        </Text>
                      </View>
                    </View>

                    <View style={{ gap: 4 }}>
                      {week.notes.map((note) => (
                        <Text key={note} style={{ color: colors.muted, fontSize: 12 }}>
                          {normalizeText("- " + note)}
                        </Text>
                      ))}
                    </View>
                  </Pressable>
                );
              }}
            />

          ) : (

            <View

              style={{

                padding: 12,

                borderRadius: 14,

                backgroundColor: colors.inputBg,

                borderWidth: 1,

                borderColor: colors.border,

              }}

            >

              <Text style={{ color: colors.muted, fontSize: 12 }}>

                {normalizeText("Nenhuma semana encontrada para esse filtro.")}

              </Text>

            </View>

          )}

          </Animated.View>

        ) : null}

      </View>

    </>
  );
}
