import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo, type Dispatch, type SetStateAction } from "react";
import { Animated, Text, TextInput, View } from "react-native";
import type { ClassGroup, Student } from "../../core/models";
import type { ThemeColors } from "../../ui/app-theme";
import { FadeHorizontalScroll } from "../../ui/FadeHorizontalScroll";
import { Pressable } from "../../ui/Pressable";
import { getUnitPalette } from "../../ui/unit-colors";

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type BirthdayEntry = { student: Student; date: Date; unitName: string };
type BirthdayUnitGroup = [string, BirthdayEntry[]];
type BirthdayMonthGroup = [number, BirthdayUnitGroup[]];

type UpcomingBirthday = { student: Student; date: Date; daysLeft: number };

type BirthdaysTabProps = {
  colors: ThemeColors;
  birthdayMonthFilter: "Todas" | number;
  setBirthdayMonthFilter: (value: "Todas" | number) => void;
  birthdaySearch: string;
  setBirthdaySearch: (value: string) => void;
  birthdayToday: Student[];
  upcomingBirthdays: UpcomingBirthday[];
  showAllBirthdays: boolean;
  setShowAllBirthdays: Dispatch<SetStateAction<boolean>>;
  showAllBirthdaysContent: boolean;
  allBirthdaysAnimStyle: object;
  birthdayUnitOptions: string[];
  birthdayUnitFilter: string;
  setBirthdayUnitFilter: (value: string) => void;
  birthdayMonthGroups: BirthdayMonthGroup[];
  classById: Map<string, ClassGroup>;
  unitLabel: (value: string) => string;
  calculateAge: (iso: string) => number | null;
  formatShortDate: (value: string) => string;
};

export const BirthdaysTab = memo(function BirthdaysTab({
  colors,
  birthdayMonthFilter,
  setBirthdayMonthFilter,
  birthdaySearch,
  setBirthdaySearch,
  birthdayToday,
  upcomingBirthdays,
  showAllBirthdays,
  setShowAllBirthdays,
  showAllBirthdaysContent,
  allBirthdaysAnimStyle,
  birthdayUnitOptions,
  birthdayUnitFilter,
  setBirthdayUnitFilter,
  birthdayMonthGroups,
  classById,
  unitLabel,
  calculateAge,
  formatShortDate,
}: BirthdaysTabProps) {
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted }}>
          Mês
        </Text>
        <FadeHorizontalScroll
          fadeColor={colors.background}
          contentContainerStyle={{ flexDirection: "row", gap: 8 }}
        >
          {["Todas", ...monthNames].map((label, index) => {
            const value = label === "Todas" ? "Todas" : index - 1;
            const active = birthdayMonthFilter === value;
            return (
              <Pressable
                key={`${label}-${index}`}
                onPress={() => setBirthdayMonthFilter(value)}
                onContextMenu={(event: any) => event.preventDefault()}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: active ? "transparent" : colors.border,
                }}
              >
                <Text
                  style={{
                    color: active ? colors.primaryText : colors.text,
                    fontWeight: active ? "700" : "500",
                    fontSize: 12,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </FadeHorizontalScroll>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 14,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
                <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          placeholder="Buscar nomes, datas e meses"
          placeholderTextColor={colors.placeholder}
          value={birthdaySearch}
          onChangeText={setBirthdaySearch}
          style={{ flex: 1, color: colors.inputText, fontSize: 13 }}
        />
        <Pressable
          onPress={() => setBirthdaySearch("")}
          onContextMenu={(event: any) => event.preventDefault()}
          disabled={!birthdaySearch}
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: colors.secondaryBg,
            alignItems: "center",
            justifyContent: "center",
            opacity: birthdaySearch ? 1 : 0,
          }}
        >
          <Ionicons name="close" size={14} color={colors.muted} />
        </Pressable>
      </View>

      <View
        style={{
          borderRadius: 24,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          overflow: "hidden",
        }}
      >
        <LinearGradient
          colors={[colors.secondaryBg, colors.card]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          }}
        />
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="gift" size={18} color={colors.text} />
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
              Aniversário de hoje 🎉
            </Text>
          </View>
          {birthdayToday.length ? (
            birthdayToday.map((student) => {
              const cls = classById.get(student.classId) ?? null;
              const unitName = unitLabel(cls?.unit ?? "");
              const age = calculateAge(student.birthDate);
              return (
                <View
                  key={student.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: 10,
                    borderRadius: 14,
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {student.photoUrl ? (
                    <Image
                      source={{ uri: student.photoUrl }}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: colors.secondaryBg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="person" size={20} color={colors.muted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
                      {student.name}
                    </Text>
                      <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>
                      {age ? `${age} anos` : "Idade não informada"} - {unitName}
                    </Text>
                  </View>
                  <Ionicons name="balloon" size={18} color={colors.primaryText} />
                </View>
              );
            })
          ) : (
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              Sem aniversariantes hoje.
            </Text>
          )}
        </View>
      </View>

      {upcomingBirthdays.length ? (
        <View style={{ gap: 10 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
              Próximos aniversários
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {upcomingBirthdays.length} próximos
            </Text>
          </View>
          <FadeHorizontalScroll
            fadeColor={colors.background}
            contentContainerStyle={{ flexDirection: "row", gap: 12 }}
          >
            {upcomingBirthdays.map(({ student, date, daysLeft }) => {
              const age = calculateAge(student.birthDate);
              return (
                <View
                  key={`upcoming-${student.id}`}
                  style={{
                    width: 170,
                    padding: 14,
                    borderRadius: 20,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    minHeight: 220,
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ gap: 10, alignItems: "center" }}>
                    {student.photoUrl ? (
                      <Image
                        source={{ uri: student.photoUrl }}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          backgroundColor: colors.secondaryBg,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="person" size={26} color={colors.muted} />
                      </View>
                    )}
                    <View
                      style={{
                        gap: 4,
                        minHeight: 64,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        numberOfLines={2}
                        style={{
                          color: colors.text,
                          fontWeight: "700",
                          fontSize: 13,
                          textAlign: "center",
                        }}
                      >
                        {student.name}
                      </Text>
                      <Text
                        style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}
                      >
                        {monthNames[date.getMonth()]} {date.getDate()}
                      </Text>
                      {age ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                          }}
                        >
                          <Ionicons
                            name="gift-outline"
                            size={12}
                            color={colors.primaryText}
                          />
                          <Text
                            style={{
                              color: colors.primaryText,
                              fontSize: 12,
                              fontWeight: "600",
                            }}
                          >
                            {age} anos
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 12,
                      backgroundColor: colors.primaryBg,
                      minHeight: 32,
                      justifyContent: "center",
                    }}
                  >
                      <Text
                        style={{
                          color: colors.primaryText,
                          fontSize: 12,
                          fontWeight: "700",
                          textAlign: "center",
                        }}
                      >
                      {daysLeft === 1 ? "Amanhã" : `${daysLeft} dias`}
                      </Text>
                  </View>
                </View>
              );
            })}
          </FadeHorizontalScroll>
        </View>
      ) : (
        <View
          style={{
            padding: 14,
            borderRadius: 16,
            backgroundColor: colors.secondaryBg,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Sem próximos aniversários
          </Text>
          <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
            Ajuste o mês ou a busca para ver mais resultados.
          </Text>
        </View>
      )}

      <View style={{ gap: 10 }}>
        <Pressable
          onPress={() => setShowAllBirthdays((prev) => !prev)}
          onContextMenu={(event: any) => event.preventDefault()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Todos os aniversários
          </Text>
          <Ionicons
            name={showAllBirthdays ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.muted}
          />
        </Pressable>
        { showAllBirthdaysContent ? (
          <Animated.View style={[allBirthdaysAnimStyle, { gap: 12 }] }>
            <View
              style={{
                padding: 12,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                Unidade
              </Text>
              <FadeHorizontalScroll
                fadeColor={colors.card}
                contentContainerStyle={{ flexDirection: "row", gap: 8 }}
              >
                {birthdayUnitOptions.map((unit) => {
                  const active = birthdayUnitFilter === unit;
                  const palette = unit === "Todas" ? null : getUnitPalette(unit, colors);
                  const chipBg = active
                    ? palette?.bg ?? colors.primaryBg
                    : colors.secondaryBg;
                  const chipText = active
                    ? palette?.text ?? colors.primaryText
                    : colors.text;
                  return (
                    <Pressable
                      key={unit}
                      onPress={() => setBirthdayUnitFilter(unit)}
                      onContextMenu={(event: any) => event.preventDefault()}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: chipBg,
                      }}
                    >
                      <Text
                        style={{
                          color: chipText,
                          fontWeight: active ? "700" : "500",
                        }}
                      >
                        {unit}
                      </Text>
                    </Pressable>
                  );
                })}
              </FadeHorizontalScroll>
            </View>

            {birthdayMonthGroups.length ? (
              birthdayMonthGroups.map(([month, unitGroups]) => {
                const monthKey = `m-${month}`;
                const totalCount = unitGroups.reduce(
                  (sum, [, entries]) => sum + entries.length,
                  0
                );
                return (
                  <View
                    key={monthKey}
                    style={{
                      padding: 14,
                      borderRadius: 18,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                        {monthNames[month]}
                      </Text>
                      <View
                        style={{
                          paddingVertical: 4,
                          paddingHorizontal: 8,
                          borderRadius: 8,
                          backgroundColor: colors.secondaryBg,
                        }}
                      >
                        <Text
                          style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}
                        >
                          {totalCount}
                        </Text>
                      </View>
                    </View>

                    {unitGroups.map(([unitName, entries]) => {
                      const unitKey = `m-${month}-u-${unitName}`;
                      const palette =
                        getUnitPalette(unitName, colors) ?? {
                          bg: colors.primaryBg,
                          text: colors.primaryText,
                        };
                      return (
                        <View key={unitKey} style={{ gap: 6 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <View
                              style={{
                                paddingVertical: 4,
                                paddingHorizontal: 10,
                                borderRadius: 999,
                                backgroundColor: palette.bg,
                              }}
                            >
                              <Text
                                style={{
                                  color: palette.text,
                                  fontWeight: "700",
                                  fontSize: 12,
                                }}
                              >
                                {unitName}
                              </Text>
                            </View>
                            <Text style={{ color: colors.muted, fontSize: 12 }}>
                              {entries.length === 1
                                ? "1 aluno"
                                : `${entries.length} alunos`}
                            </Text>
                          </View>
                          <View style={{ gap: 8 }}>
                            {entries
                              .sort((a, b) => a.date.getDate() - b.date.getDate())
                              .map(({ student, date }) => {
                                const cls = classById.get(student.classId) ?? null;
                                const className = cls?.name ?? "Turma";
                                return (
                                  <View
                                    key={student.id}
                                    style={{
                                      padding: 12,
                                      borderRadius: 14,
                                      backgroundColor: colors.background,
                                      borderWidth: 1,
                                      borderColor: colors.border,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: colors.text,
                                        fontWeight: "700",
                                        fontSize: 13,
                                      }}
                                    >
                                      {String(date.getDate()).padStart(2, "0")} - {student.name}
                                    </Text>
                                    <Text
                                      style={{
                                        color: colors.muted,
                                        marginTop: 4,
                                        fontSize: 12,
                                      }}
                                    >
                                      {formatShortDate(student.birthDate)} | {className}
                                    </Text>
                                  </View>
                                );
                              })}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })
            ) : (
              <View
                style={{
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Sem aniversários
                </Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>
                  Nenhum aluno com data de nascimento.
                </Text>
              </View>
            )}
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
});

