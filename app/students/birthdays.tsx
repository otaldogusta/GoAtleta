import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "../../src/ui/Pressable";

import { Image } from "expo-image";
import type { ClassGroup, Student } from "../../src/core/models";
import { getClasses, getStudents } from "../../src/db/seed";
import { useOrganization } from "../../src/providers/OrganizationProvider";
import { useAppTheme } from "../../src/ui/app-theme";
import { FadeHorizontalScroll } from "../../src/ui/FadeHorizontalScroll";

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Marco",
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

const formatShortDate = (value: string) => {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

const parseIsoDate = (value: string) => {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const local = new Date(year, month - 1, day);
    return Number.isNaN(local.getTime()) ? null : local;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const calculateAge = (iso: string) => {
  const date = parseIsoDate(iso);
  if (!date) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
};

const unitLabel = (value: string) =>
  value && value.trim() ? value.trim() : "Sem unidade";

const getDaysUntilBirthday = (birthDate: Date, today: Date) => {
  const thisYear = today.getFullYear();
  const nextBirthday = new Date(thisYear, birthDate.getMonth(), birthDate.getDate());
  
  // Se já passou este ano, considera o próximo ano
  if (nextBirthday < today) {
    nextBirthday.setFullYear(thisYear + 1);
  }
  
  const diffTime = nextBirthday.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

const hasBirthdayPassed = (birthDate: Date, today: Date) => {
  const birthMonth = birthDate.getMonth();
  const birthDay = birthDate.getDate();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();
  
  if (birthMonth < todayMonth) return true;
  if (birthMonth === todayMonth && birthDay < todayDay) return true;
  return false;
};

export default function BirthdaysScreen() {
  const { colors } = useAppTheme();
  const { activeOrganization } = useOrganization();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [unitFilter, setUnitFilter] = useState("Todas");

  useEffect(() => {
    let alive = true;
    (async () => {
      const [classList, studentList] = await Promise.all([
        getClasses({ organizationId: activeOrganization?.id }),
        getStudents({ organizationId: activeOrganization?.id }),
      ]);
      if (!alive) return;
      setClasses(classList);
      setStudents(studentList);
    })();
    return () => {
      alive = false;
    };
  }, [activeOrganization?.id]);

  const today = useMemo(() => new Date(), []);
  const unitOptions = useMemo(() => {
    const units = new Set<string>();
    classes.forEach((cls) => units.add(unitLabel(cls.unit)));
    return ["Todas", ...Array.from(units).sort((a, b) => a.localeCompare(b))];
  }, [classes]);

  const filteredStudents = useMemo(() => {
    if (unitFilter === "Todas") return students;
    return students.filter((student) => {
      const cls = classes.find((item) => item.id === student.classId);
      return unitLabel(cls?.unit ?? "") === unitFilter;
    });
  }, [classes, students, unitFilter]);

  const birthdayToday = useMemo(() => {
    return filteredStudents.filter((student) => {
      if (!student.birthDate) return false;
      const date = parseIsoDate(student.birthDate);
      if (!date) return false;
      return (
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    });
  }, [filteredStudents, today]);

  const upcomingBirthdays = useMemo(() => {
    const withDates = filteredStudents
      .filter((student) => {
        if (!student.birthDate) return false;
        const date = parseIsoDate(student.birthDate);
        if (!date) return false;
        return !hasBirthdayPassed(date, today) && getDaysUntilBirthday(date, today) > 0;
      })
      .map((student) => {
        const date = parseIsoDate(student.birthDate)!;
        const daysLeft = getDaysUntilBirthday(date, today);
        return { student, date, daysLeft };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
    
    return withDates.slice(0, 10); // Primeiros 10
  }, [filteredStudents, today]);
  const monthGroups = useMemo(() => {
    const byMonth = new Map<number, Map<string, Array<{ student: Student; date: Date; unitName: string }>>>();
    filteredStudents.forEach((student) => {
      if (!student.birthDate) return;
      const date = parseIsoDate(student.birthDate);
      if (!date) return;
      const month = date.getMonth();
      const cls = classes.find((item) => item.id === student.classId);
      const unitName = unitLabel(cls?.unit ?? "");
      if (!byMonth.has(month)) byMonth.set(month, new Map());
      const monthMap = byMonth.get(month)!;
      if (!monthMap.has(unitName)) monthMap.set(unitName, []);
      monthMap.get(unitName)!.push({ student, date, unitName });
    });
    const currentMonth = today.getMonth();
    const sortedMonths = Array.from(byMonth.entries()).sort((a, b) => {
      const aOffset = (a[0] - currentMonth + 12) % 12;
      const bOffset = (b[0] - currentMonth + 12) % 12;
      return aOffset - bOffset;
    });
    return sortedMonths.map(([month, unitMap]) => [
      month,
      Array.from(unitMap.entries()).sort((a, b) => a[0].localeCompare(b[0])),
    ] as const);
  }, [classes, filteredStudents, today]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24, gap: 20, paddingTop: 16 }}>
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>
            Aniversários
          </Text>
          {birthdayToday.length > 0 && (
            <Text style={{ color: colors.muted, fontSize: 15 }}>
              {birthdayToday.length === 1 ? "1 aniversariante hoje! 🎉" : `${birthdayToday.length} aniversariantes hoje! 🎉`}
            </Text>
          )}
        </View>

        {birthdayToday.length > 0 && (
          <View style={{ paddingHorizontal: 16 }}>
            <View
              style={{
                padding: 18,
                borderRadius: 24,
                backgroundColor: colors.successBg,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.1,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: 6,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="gift" size={20} color={colors.successText} />
                <Text style={{ fontSize: 17, fontWeight: "800", color: colors.successText }}>
                  Aniversário de hoje
                </Text>
              </View>
              {birthdayToday.map((student) => {
                const cls = classes.find((item) => item.id === student.classId);
                const age = calculateAge(student.birthDate);
                return (
                  <View
                    key={student.id}
                    style={{
                      padding: 12,
                      borderRadius: 16,
                      backgroundColor: "rgba(255,255,255,0.16)",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    {student.photoUrl ? (
                      <Image
                        source={{ uri: student.photoUrl }}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: "rgba(255,255,255,0.2)",
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: "rgba(255,255,255,0.2)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="person" size={24} color={colors.successText} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.successText, fontWeight: "700", fontSize: 15 }}>
                        {student.name}
                      </Text>
                      <Text style={{ color: colors.successText, marginTop: 2, fontSize: 13, opacity: 0.9 }}>
                        {age ? `${age} anos` : ""} • {unitLabel(cls?.unit ?? "")}
                      </Text>
                    </View>
                    <Ionicons name="balloon" size={28} color={colors.successText} />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {upcomingBirthdays.length > 0 && (
          <View style={{ gap: 12 }}>
            <View style={{ paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
                Próximos aniversários
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                {upcomingBirthdays.length} próximos
              </Text>
            </View>
            <FadeHorizontalScroll
              fadeColor={colors.background}
              containerStyle={{}}
              scrollStyle={{}}
              fadeWidth={40}
              contentContainerStyle={{
                flexDirection: "row",
                gap: 12,
                paddingHorizontal: 16,
              }}
            >
              {upcomingBirthdays.map(({ student, date, daysLeft }) => {
                const cls = classes.find((item) => item.id === student.classId);
                const age = calculateAge(student.birthDate);
                return (
                  <View
                    key={student.id}
                    style={{
                      width: 160,
                      padding: 14,
                      borderRadius: 20,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      shadowColor: "#000",
                      shadowOpacity: 0.06,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 3,
                      gap: 10,
                    }}
                  >
                    {student.photoUrl ? (
                      <Image
                        source={{ uri: student.photoUrl }}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          backgroundColor: colors.secondaryBg,
                          alignSelf: "center",
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
                          alignSelf: "center",
                        }}
                      >
                        <Ionicons name="person" size={28} color={colors.muted} />
                      </View>
                    )}
                    <View style={{ gap: 4 }}>
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: "700",
                          fontSize: 14,
                          textAlign: "center",
                        }}
                        numberOfLines={2}
                      >
                        {student.name}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
                        {monthNames[date.getMonth()]} {date.getDate()}
                      </Text>
                      {age && (
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          <Ionicons name="gift-outline" size={12} color={colors.primaryText} />
                          <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "600" }}>
                            {age} anos
                          </Text>
                        </View>
                      )}
                    </View>
                    <View
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 12,
                        backgroundColor: colors.primaryBg,
                        marginTop: 4,
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
        )}

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
            Filtrar por unidade
          </Text>
          <View
            style={{
              padding: 12,
              borderRadius: 16,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <FadeHorizontalScroll
              fadeColor={colors.card}
              containerStyle={{}}
              scrollStyle={{}}
              fadeWidth={40}
              contentContainerStyle={{ flexDirection: "row", gap: 8 }}
            >
              {unitOptions.map((unit) => {
                const active = unitFilter === unit;
                return (
                  <Pressable
                    key={unit}
                    onPress={() => setUnitFilter(unit)}
                    onContextMenu={(e: any) => e.preventDefault()}
                    style={{
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? colors.primaryText : colors.text,
                        fontSize: 13,
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
        </View>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
            Todos os aniversários
          </Text>
          {monthGroups.length > 0 ? (
            <View style={{ gap: 12 }}>
              {monthGroups.map(([month, unitGroups]) => {
                const monthKey = `m-${month}`;
                const totalCount = unitGroups.reduce(
                  (sum, [, entries]) => sum + entries.length,
                  0
                );
                return (
                  <View
                    key={monthKey}
                    style={{
                      padding: 16,
                      borderRadius: 18,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      shadowColor: "#000",
                      shadowOpacity: 0.04,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 2,
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
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
                        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>
                          {totalCount}
                        </Text>
                      </View>
                    </View>

                    {unitGroups.map(([unitName, entries]) => {
                      const unitKey = `m-${month}-u-${unitName}`;
                      return (
                        <View key={unitKey} style={{ gap: 8 }}>
                          <View style={{ paddingBottom: 4 }}>
                            <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>
                              {unitName}
                            </Text>
                            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                              {entries.length === 1 ? "1 aluno" : `${entries.length} alunos`}
                            </Text>
                          </View>
                          <View style={{ gap: 6 }}>
                            {entries
                              .sort((a, b) => a.date.getDate() - b.date.getDate())
                              .map(({ student, date }) => {
                                const isPast = hasBirthdayPassed(date, today);
                                const age = calculateAge(student.birthDate);
                                return (
                                  <View
                                    key={student.id}
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      padding: 12,
                                      borderRadius: 14,
                                      backgroundColor: colors.secondaryBg,
                                      borderWidth: 1,
                                      borderColor: colors.border,
                                      opacity: isPast ? 0.4 : 1,
                                      gap: 12,
                                    }}
                                  >
                                    {student.photoUrl ? (
                                      <Image
                                        source={{ uri: student.photoUrl }}
                                        style={{
                                          width: 40,
                                          height: 40,
                                          borderRadius: 20,
                                          backgroundColor: colors.background,
                                        }}
                                      />
                                    ) : (
                                      <View
                                        style={{
                                          width: 40,
                                          height: 40,
                                          borderRadius: 20,
                                          backgroundColor: colors.background,
                                          alignItems: "center",
                                          justifyContent: "center",
                                        }}
                                      >
                                        <Ionicons name="person" size={20} color={colors.muted} />
                                      </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                      <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>
                                        {student.name}
                                      </Text>
                                      <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>
                                        {String(date.getDate()).padStart(2, "0")} de {monthNames[date.getMonth()]}
                                        {age ? ` • ${age} anos` : ""}
                                      </Text>
                                    </View>
                                    <Ionicons
                                      name={isPast ? "checkmark-circle" : "gift-outline"}
                                      size={20}
                                      color={isPast ? colors.muted : colors.primaryText}
                                    />
                                  </View>
                                );
                              })}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          ) : (
            <View
              style={{
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons name="calendar-outline" size={32} color={colors.muted} />
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>
                Sem aniversários
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
                Nenhum aluno com data de nascimento cadastrada
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
