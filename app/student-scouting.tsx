import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRole } from "../src/auth/role";
import type { ClassGroup } from "../src/core/models";
import {
    createEmptyCounts,
    getSkillMetrics,
    scoutingSkills,
    studentScoutingLimits,
} from "../src/core/scouting";
import { getClasses, getStudentScoutingByDate, saveStudentScoutingLog } from "../src/db/seed";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

const formatIsoDate = (value: Date) => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseTime = (value: string) => {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
};

export default function StudentScouting() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { student } = useRole();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [counts, setCounts] = useState(createEmptyCounts());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const cls = await getClasses();
      if (!alive) return;
      setClasses(cls);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const currentClass = useMemo(() => {
    if (!student) return null;
    return classes.find((c) => c.id === student.classId) ?? null;
  }, [classes, student]);

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatIsoDate(today), [today]);

  const sessionWindow = useMemo(() => {
    if (!currentClass) return null;
    const now = new Date();
    const dayIndex = now.getDay();
    if (!currentClass.daysOfWeek.includes(dayIndex)) return null;
    const time = parseTime(currentClass.startTime);
    if (!time) return null;
    const start = new Date();
    start.setHours(time.hour, time.minute, 0, 0);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    return { start, end, now };
  }, [currentClass]);

  const canEdit = useMemo(() => {
    if (!sessionWindow) return false;
    return sessionWindow.now >= sessionWindow.start && sessionWindow.now <= sessionWindow.end;
  }, [sessionWindow]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!student || !currentClass) {
        setLoading(false);
        return;
      }
      const existing = await getStudentScoutingByDate(student.id, currentClass.id, todayKey);
      if (!alive) return;
      if (existing) {
        setCounts({
          serve: { 0: existing.serve0, 1: existing.serve1, 2: existing.serve2 },
          receive: { 0: existing.receive0, 1: existing.receive1, 2: existing.receive2 },
          set: { 0: existing.set0, 1: existing.set1, 2: existing.set2 },
          attack_send: { 0: existing.attackSend0, 1: existing.attackSend1, 2: existing.attackSend2 },
        });
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [student, currentClass, todayKey]);

  const updateCount = (skillId: keyof typeof counts, score: 0 | 1 | 2, delta: number) => {
    setCounts((prev) => {
      const next = { ...prev, [skillId]: { ...prev[skillId] } };
      const total = next[skillId][0] + next[skillId][1] + next[skillId][2];
      const limit = studentScoutingLimits[skillId];
      if (delta > 0 && total >= limit) return prev;
      next[skillId][score] = Math.max(0, next[skillId][score] + delta);
      return next;
    });
  };

  const handleSave = async () => {
    if (!student || !currentClass) return;
    if (!canEdit) return;
    setSaving(true);
    try {
      await saveStudentScoutingLog({
        id: "",
        studentId: student.id,
        classId: currentClass.id,
        date: todayKey,
        serve0: counts.serve[0],
        serve1: counts.serve[1],
        serve2: counts.serve[2],
        receive0: counts.receive[0],
        receive1: counts.receive[1],
        receive2: counts.receive[2],
        set0: counts.set[0],
        set1: counts.set[1],
        set2: counts.set[2],
        attackSend0: counts.attack_send[0],
        attackSend1: counts.attack_send[1],
        attackSend2: counts.attack_send[2],
        createdAt: new Date().toISOString(),
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.text }}>‹</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
            Meu scouting
          </Text>
        </View>

        <View style={{ padding: 16, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>Turma</Text>
          <Text style={{ color: colors.text }}>{currentClass?.name ?? "-"}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {sessionWindow
              ? `Disponível até ${sessionWindow.end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : "Scouting liberado apenas no dia do treino"}
          </Text>
        </View>

        {loading ? (
          <Text style={{ color: colors.muted }}>Carregando...</Text>
        ) : (
          scoutingSkills.map((skill) => {
            const metrics = getSkillMetrics(counts[skill.id]);
            const total = metrics.total;
            const limit = studentScoutingLimits[skill.id];
            return (
              <View
                key={skill.id}
                style={{
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{skill.label}</Text>
                  <Text style={{ color: colors.muted }}>{total}/{limit}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[0, 1, 2].map((score) => (
                    <View key={score} style={{ flex: 1, gap: 6 }}>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {score}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Pressable
                          onPress={() => updateCount(skill.id, score as 0 | 1 | 2, -1)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: colors.secondaryBg,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ color: colors.text }}>-</Text>
                        </Pressable>
                        <Text style={{ color: colors.text, fontWeight: "700" }}>
                          {counts[skill.id][score as 0 | 1 | 2]}
                        </Text>
                        <Pressable
                          onPress={() => updateCount(skill.id, score as 0 | 1 | 2, 1)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: colors.secondaryBg,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ color: colors.text }}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        )}

        <Pressable
          onPress={handleSave}
          disabled={!canEdit || saving}
          style={{
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: !canEdit || saving ? colors.secondaryBg : colors.primaryBg,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
            {saving ? "Salvando..." : "Salvar scouting"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
