import { useEffect, useMemo, useState } from "react";
import {
    ScrollView,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "../../src/ui/Pressable";

import type { ClassGroup, Student } from "../../src/core/models";
import { getClasses, getStudents } from "../../src/db/seed";
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

const formatShortDate = (value?: string) => {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

const parseIsoDate = (value?: string) => {
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

const unitLabel = (value?: string) =>
  value && value.trim() ? value.trim() : "Sem unidade";

export default function BirthdaysScreen() {
  const { colors } = useAppTheme();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [unitFilter, setUnitFilter] = useState("Todas");

  useEffect(() => {
    let alive = true;
    (async () => {
      const [classList, studentList] = await Promise.all([
        getClasses(),
        getStudents(),
      ]);
      if (!alive) return;
      setClasses(classList);
      setStudents(studentList);
    })();
    return () => {
      alive = false;
    };
  }, []);

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
      return unitLabel(cls?.unit) === unitFilter;
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

  const monthGroups = useMemo(() => {
    const byMonth = new Map();
    filteredStudents.forEach((student) => {
      if (!student.birthDate) return;
      const date = parseIsoDate(student.birthDate);
      if (!date) return;
      const month = date.getMonth();
      const cls = classes.find((item) => item.id === student.classId);
      const unitName = unitLabel(cls?.unit);
      if (!byMonth.has(month)) byMonth.set(month, new Map());
      const monthMap = byMonth.get(month);
      if (!monthMap.has(unitName)) monthMap.set(unitName, []);
      monthMap.get(unitName).push({ student, date, unitName });
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
    ]);
  }, [classes, filteredStudents, today]);

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24, gap: 16 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
            Aniversários
          </Text>
          <Text style={{ color: colors.muted }}>
            Organizado por mês e unidade
          </Text>
        </View>

        {birthdayToday.length ? (
          <View
            style={{
              padding: 16,
              borderRadius: 20,
              backgroundColor: colors.successBg,
              borderWidth: 1,
              borderColor: colors.successBg,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
              elevation: 4,
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.successText }}>
              Hoje e dia de aniversário
            </Text>
            {birthdayToday.map((student) => (
              <View
                key={student.id}
                style={{
                  padding: 10,
                  borderRadius: 14,
                  backgroundColor: "rgba(255,255,255,0.14)",
                }}
              >
                <Text style={{ color: colors.successText, fontWeight: "700" }}>
                  {student.name}
                </Text>
                <Text style={{ color: colors.successText, marginTop: 4 }}>
                  {formatShortDate(student.birthDate)} -{" "}
                  {(() => {
                    const cls = classes.find((item) => item.id === student.classId);
                    const unitName = unitLabel(cls?.unit);
                    const className = cls?.name ?? "Turma";
                    return `${unitName} | ${className}`;
                  })()}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View
          style={{
            padding: 12,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOpacity: 0.05,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
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
            {unitOptions.map((unit) => {
              const active = unitFilter === unit;
              return (
                <Pressable
                  key={unit}
                  onPress={() => setUnitFilter(unit)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: active ? colors.primaryText : colors.text }}>
                    {unit}
                  </Text>
                </Pressable>
              );
            })}
          </FadeHorizontalScroll>
        </View>

        {monthGroups.length ? (
          monthGroups.map(([month, unitGroups]) => {
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
                  shadowColor: "#000",
                  shadowOpacity: 0.04,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 2,
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
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                    {monthNames[month]}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: colors.muted }}>{totalCount}</Text>
                  </View>
                </View>

                {unitGroups.map(([unitName, entries]) => {
                  const unitKey = `m-${month}-u-${unitName}`;
                  return (
                    <View key={unitKey} style={{ gap: 6 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          paddingVertical: 6,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: "700" }}>
                            {unitName}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 12 }}>
                            {entries.length === 1
                              ? "1 aluno"
                              : `${entries.length} alunos`}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={{
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: colors.border,
                          padding: 10,
                          gap: 8,
                          backgroundColor: colors.secondaryBg,
                        }}
                      >
                        {entries
                          .sort((a, b) => a.date.getDate() - b.date.getDate())
                          .map(({ student, date }) => (
                            <View
                              key={student.id}
                              style={{
                                padding: 10,
                                borderRadius: 14,
                                backgroundColor: colors.card,
                                borderWidth: 1,
                                borderColor: colors.border,
                              }}
                            >
                              <Text style={{ color: colors.text, fontWeight: "700" }}>
                                {String(date.getDate()).padStart(2, "0")} - {student.name}
                              </Text>
                              <Text style={{ color: colors.muted, marginTop: 4 }}>
                                {formatShortDate(student.birthDate)}
                              </Text>
                            </View>
                          ))}
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
      </ScrollView>
    </SafeAreaView>
  );
}
