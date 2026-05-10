import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import type { ClassGroup } from "../../../../src/core/models";
import type { ScoutingSession } from "../../../../src/core/scouting-session";
import {
  getDominantStrengths,
  getDominantWeaknesses,
  summarizeScoutingActions,
  summarizeScoutingActionsByAthlete,
  summarizeScoutingActionsBySkill,
  type ScoutingAction,
} from "../../../../src/core/scouting-action";
import { getCachedClassById, getClassById } from "../../../../src/db/classes";
import { getStudentsByClass } from "../../../../src/db/students";
import { getScoutingSession } from "../../../../src/screens/scouting/scouting-session-actions";
import {
  createScoutingActionForSession,
  deleteScoutingAction,
  listScoutingActionsBySession,
} from "../../../../src/screens/scouting/scouting-action-actions";
import {
  formatScoutingActionTypeLabel,
  formatScoutingSkillLabel,
  getDefaultQualityOptionForSkill,
  getScoutingQualityOptionsForSkill,
  resolveScoutingQualityOption,
} from "../../../../src/screens/scouting/scouting-action-labels";
import { buildLegacyScoutingRoute } from "../../../../src/screens/scouting/scouting-session-navigation";
import { ScreenLoadingState } from "../../../../src/components/ui/ScreenLoadingState";
import { useAppTheme } from "../../../../src/ui/app-theme";
import { Button } from "../../../../src/ui/Button";
import { getClassPalette } from "../../../../src/ui/class-colors";
import { ClassGenderBadge } from "../../../../src/ui/ClassGenderBadge";
import { LocationBadge } from "../../../../src/ui/LocationBadge";
import { Pressable } from "../../../../src/ui/Pressable";
import { getSectionCardStyle } from "../../../../src/ui/section-styles";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );

const typeLabelMap: Record<ScoutingSession["type"], string> = {
  training: "Treino",
  friendly: "Amistoso",
  official_match: "Jogo oficial",
};

const statusLabelMap: Record<ScoutingSession["status"], string> = {
  draft: "Rascunho",
  in_progress: "Em andamento",
  completed: "Concluído",
  archived: "Arquivado",
};

export default function ScoutingSessionRoute() {
  const { id, scoutingSessionId } = useLocalSearchParams<{ id: string; scoutingSessionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const classId = typeof id === "string" ? id : "";
  const sessionId = typeof scoutingSessionId === "string" ? scoutingSessionId : "";
  const isDesktop = width >= 1040;
  const [isLoading, setIsLoading] = useState(true);
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [session, setSession] = useState<ScoutingSession | null>(null);
  const [actions, setActions] = useState<ScoutingAction[]>([]);
  const [quickAthletes, setQuickAthletes] = useState<string[]>([]);
  const [athleteName, setAthleteName] = useState("");
  const [skill, setSkill] = useState("receive");
  const [qualityOptionId, setQualityOptionId] = useState(getDefaultQualityOptionForSkill("receive").id);
  const [gamePhase, setGamePhase] = useState<"serve" | "sideout" | "transition" | "freeball" | "out_of_system">("sideout");
  const [notes, setNotes] = useState("");
  const [isSavingAction, setIsSavingAction] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cached = await getCachedClassById(classId);
        if (alive && cached) setCls(cached);
        const [classData, sessionData, sessionActions, students] = await Promise.all([
          getClassById(classId),
          getScoutingSession(sessionId),
          listScoutingActionsBySession(sessionId),
          getStudentsByClass(classId),
        ]);
        if (!alive) return;
        setCls(classData);
        setSession(sessionData);
        setActions(sessionActions);
        setQuickAthletes(students.map((student) => student.name).filter(Boolean).slice(0, 5));
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [classId, sessionId]);

  const classPalette = getClassPalette(cls?.colorKey ?? null, colors, cls?.unit ?? "");
  const legacyRoute = useMemo(
    () => (session ? buildLegacyScoutingRoute({ classId, session }) : null),
    [classId, session]
  );
  const actionsSummary = useMemo(() => summarizeScoutingActions(actions), [actions]);
  const byAthlete = useMemo(() => summarizeScoutingActionsByAthlete(actions), [actions]);
  const bySkill = useMemo(() => summarizeScoutingActionsBySkill(actions), [actions]);
  const qualityOptions = useMemo(() => getScoutingQualityOptionsForSkill(skill), [skill]);
  const topAthletes = useMemo(() => {
    const names = Array.from(
      new Set([
        ...quickAthletes,
        ...byAthlete.map((item) => item.athleteName).filter((name) => name !== "Equipe"),
      ])
    );
    return names.slice(0, 5);
  }, [byAthlete, quickAthletes]);

  useEffect(() => {
    const nextOptions = getScoutingQualityOptionsForSkill(skill);
    if (!nextOptions.some((item) => item.id === qualityOptionId)) {
      setQualityOptionId(nextOptions[0]?.id ?? getDefaultQualityOptionForSkill("receive").id);
    }
  }, [qualityOptionId, skill]);

  const handleRegisterAction = async () => {
    if (!session) return;
    try {
      setIsSavingAction(true);
      const selectedOption = resolveScoutingQualityOption(skill, qualityOptionId);
      const created = await createScoutingActionForSession({
        scoutingSessionId: session.id,
        classId,
        athleteName: athleteName.trim() || undefined,
        skill,
        actionType: selectedOption.actionType,
        quality: selectedOption.quality,
        score: selectedOption.score,
        label: selectedOption.label,
        gamePhase,
        notes: notes.trim() || undefined,
      });
      const nextActions = [created, ...actions];
      setActions(nextActions);
      setAthleteName("");
      setNotes("");
      setQualityOptionId(getDefaultQualityOptionForSkill("receive").id);
      setSkill("receive");
      setGamePhase("sideout");
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleRemoveAction = async (actionId: string) => {
    const ok = await deleteScoutingAction(actionId);
    if (!ok) return;
    setActions((current) => current.filter((item) => item.id !== actionId));
  };

  const handleCompleteSession = async () => {
    if (!session) return;
    try {
      setIsCompleting(true);
      const { completeScoutingSessionById } = await import("../../../../src/screens/scouting/scouting-session-actions");
      const next = await completeScoutingSessionById(session.id);
      if (next) setSession(next);
    } finally {
      setIsCompleting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenLoadingState />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{
            gap: 18,
            paddingHorizontal: isDesktop ? 24 : 16,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom + 40, 56),
            width: "100%",
            maxWidth: 980,
            alignSelf: "center",
          }}
        >
          <View style={getSectionCardStyle(colors, "warning", { radius: 18 })}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
              Sessão de scouting não encontrada
            </Text>
            <Text style={{ color: colors.muted }}>
              A análise pode ter sido removida do cache local ou ainda não foi criada corretamente.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          gap: 18,
          paddingHorizontal: isDesktop ? 24 : 16,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom + 40, 56),
          width: "100%",
          maxWidth: 980,
          alignSelf: "center",
        }}
      >
        <View
          style={{
            flexDirection: isDesktop ? "row" : "column",
            justifyContent: "space-between",
            alignItems: isDesktop ? "flex-start" : "stretch",
            gap: 12,
          }}
        >
          <View style={{ gap: 6, flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={() =>
                  router.replace({
                    pathname: "/class/[id]/scouting",
                    params: { id: classId },
                  })
                }
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
              <Text style={{ color: colors.text, fontSize: isDesktop ? 30 : 26, fontWeight: "800" }}>
                Scouting
              </Text>
            </View>
            <Text style={{ color: colors.text, fontSize: isDesktop ? 22 : 20, fontWeight: "800", marginLeft: 42 }}>
              {session.title}
            </Text>
            <Text style={{ color: colors.muted, marginLeft: 42 }}>
              {typeLabelMap[session.type]} · {formatDate(session.date)} · {statusLabelMap[session.status]}
            </Text>
          </View>
          <Button
            label="Finalizar análise"
            onPress={handleCompleteSession}
            loading={isCompleting}
            disabled={isCompleting || session.status === "completed" || session.status === "archived"}
          />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
            {cls?.name ?? "Turma"}
          </Text>
          <ClassGenderBadge gender={cls?.gender ?? "misto"} size="md" />
          <LocationBadge location={cls?.unit ?? "Unidade"} palette={classPalette} size="sm" showIcon />
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <MetaCard colors={colors} label="Data" value={formatDate(session.date)} />
          <MetaCard colors={colors} label="Tipo" value={typeLabelMap[session.type]} />
          <MetaCard colors={colors} label="Status" value={statusLabelMap[session.status]} />
          {session.opponent ? <MetaCard colors={colors} label="Adversário" value={session.opponent} /> : null}
        </View>

        <View
          style={{
            flexDirection: isDesktop ? "row" : "column",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <View style={{ flex: isDesktop ? 1.8 : undefined, width: "100%", gap: 16 }}>
            <View style={getSectionCardStyle(colors, "neutral", { radius: 18 })}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                Registro rápido
              </Text>
              <Text style={{ color: colors.muted }}>
                Marque uma ação em poucos toques. Depois refine se precisar.
              </Text>

              {topAthletes.length ? (
                <PickerPills
                  label="Atalhos de atleta"
                  value={athleteName}
                  onChange={setAthleteName}
                  options={topAthletes.map((name) => ({ value: name, label: name }))}
                  colors={colors}
                  allowClearChip
                />
              ) : null}

              <View
                style={{
                  flexDirection: isDesktop ? "row" : "column",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <FormField
                    label="Atleta ou nome"
                    value={athleteName}
                    onChangeText={setAthleteName}
                    placeholder="Ex.: Maria"
                    colors={colors}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PickerPills
                    label="Fase do jogo"
                    value={gamePhase}
                    onChange={(value) => setGamePhase(value as typeof gamePhase)}
                    options={[
                      { value: "serve", label: "Saque" },
                      { value: "sideout", label: "Side-out" },
                      { value: "transition", label: "Transição" },
                      { value: "freeball", label: "Freeball" },
                      { value: "out_of_system", label: "Fora do sistema" },
                    ]}
                    colors={colors}
                  />
                </View>
              </View>

              <FormField
                label="Observação rápida"
                value={notes}
                onChangeText={setNotes}
                placeholder="Contexto rápido da ação"
                colors={colors}
              />

              <PickerPills
                label="Fundamento"
                value={skill}
                    onChange={setSkill}
                    options={[
                      { value: "serve", label: "Saque" },
                      { value: "receive", label: "Recepção" },
                      { value: "set", label: "Levantamento" },
                      { value: "attack", label: "Ataque" },
                      { value: "block", label: "Bloqueio" },
                      { value: "defense", label: "Defesa" },
                      { value: "coverage", label: "Cobertura" },
                      { value: "transition", label: "Transição" },
                      { value: "communication", label: "Comunicação" },
                    ]}
                    colors={colors}
                  />

              <PickerPills
                label="Qualidade"
                value={qualityOptionId}
                onChange={setQualityOptionId}
                options={qualityOptions.map((item) => ({ value: item.id, label: item.label }))}
                colors={colors}
              />

              <View style={{ alignSelf: isDesktop ? "flex-end" : "stretch", width: isDesktop ? 180 : "100%" }}>
                <Button
                  label="Registrar"
                  onPress={handleRegisterAction}
                  loading={isSavingAction}
                  disabled={isSavingAction}
                />
              </View>
            </View>

            <View style={getSectionCardStyle(colors, "neutral", { radius: 18 })}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                Últimas ações
              </Text>
              <Text style={{ color: colors.muted }}>
                Linha do tempo da análise.
              </Text>
              {!actions.length ? (
                <Text style={{ color: colors.muted }}>
                  Nenhuma ação registrada ainda.
                </Text>
              ) : (
                actions.slice(0, 8).map((action, index) => (
                  <View
                    key={action.id}
                    style={{
                      paddingVertical: 12,
                      borderBottomWidth: index === Math.min(actions.length, 8) - 1 ? 0 : 1,
                      borderBottomColor: colors.border,
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: isDesktop ? "row" : "column",
                        justifyContent: "space-between",
                        alignItems: isDesktop ? "center" : "flex-start",
                        gap: 8,
                      }}
                    >
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                          {String(index + 1).padStart(2, "0")}
                        </Text>
                        <Text style={{ color: colors.text, fontWeight: "800" }}>
                          {action.athleteName || "Equipe"}
                        </Text>
                        <Text style={{ color: colors.muted }}>{formatScoutingSkillLabel(action.skill)}</Text>
                        <TimelineBadge
                          label={action.label || formatScoutingActionTypeLabel(action.skill, action.actionType)}
                          colors={colors}
                          tone={timelineTone(action.quality)}
                        />
                        <Text style={{ color: colors.muted }}>{phaseLabel(action.gamePhase)}</Text>
                      </View>
                      <Pressable
                        onPress={() => handleRemoveAction(action.id)}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                          Desfazer
                        </Text>
                      </Pressable>
                    </View>
                    {action.notes ? (
                        <Text style={{ color: colors.muted, fontSize: 12 }}>{action.notes}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={{ flex: isDesktop ? 0.9 : undefined, width: "100%", gap: 16 }}>
            <View style={getSectionCardStyle(colors, "neutral", { radius: 18 })}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                Resumo da análise
              </Text>
              <SummaryRow label="Total" value={`${actionsSummary.totalActions} ações`} colors={colors} />
              <SummaryRow label="Atletas" value={`${byAthlete.length} avaliadas`} colors={colors} />
              <SummaryRow
                label="Ponto forte"
                value={getDominantStrengths(actions)[0] || "Sem destaque"}
                colors={colors}
              />
              <SummaryRow
                label="Atenção"
                value={getDominantWeaknesses(actions)[0] || "Sem alerta"}
                colors={colors}
              />
            </View>

            <SummaryColumn
              title="Atletas em destaque"
              items={byAthlete.slice(0, 3).map((item) => ({
                title: item.athleteName,
                subtitle: `${item.weaknesses[0] || item.strengths[0] || "Sem recorte"} · ${item.totalActions} ações`,
                rightValue: `${Math.round((item.averageScore / 3) * 100)}%`,
              }))}
              colors={colors}
            />

            <SummaryColumn
              title="Sinais para o treino"
              subtitle="Entram como pista para a semana."
              items={actionsSummary.dominantWeaknesses.map((item) => ({
                title: item,
                subtitle: "Ponto de atenção recorrente",
              }))}
              colors={colors}
              chipMode
            />

            <View style={getSectionCardStyle(colors, "primary", { radius: 18 })}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                Vídeo e marcação
              </Text>
              <Text style={{ color: colors.muted }}>
                O vínculo com vídeo entra em pacote posterior. Os campos de timestamp já estão previstos no modelo.
              </Text>
            </View>

            <View style={getSectionCardStyle(colors, "primary", { radius: 18 })}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                Registro técnico legado
              </Text>
              <Text style={{ color: colors.muted }}>
                O motor técnico antigo continua disponível como apoio durante a migração do módulo.
              </Text>
              {legacyRoute ? (
                <Button label="Abrir legado" onPress={() => router.push(legacyRoute)} variant="secondary" />
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaCard({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View
      style={[
        getSectionCardStyle(colors, "neutral", { radius: 16, shadow: false }),
        { flexGrow: 1, flexBasis: 180 },
      ]}
    >
      <Text style={{ color: colors.muted, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>{value}</Text>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={{
          minHeight: multiline ? 96 : 48,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 10,
          color: colors.text,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

function PickerPills({
  label,
  value,
  onChange,
  options,
  colors,
  allowClearChip = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  colors: ReturnType<typeof useAppTheme>["colors"];
  allowClearChip?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const active = option.value !== "" && option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? colors.text : colors.border,
                backgroundColor: active ? colors.text : colors.card,
              }}
            >
              <Text style={{ color: active ? colors.background : colors.text, fontWeight: "700", fontSize: 12 }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
        {allowClearChip ? (
          <Pressable
            onPress={() => onChange("")}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>+ Outro</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function SummaryColumn({
  title,
  subtitle,
  items,
  colors,
  chipMode = false,
}: {
  title: string;
  subtitle?: string;
  items: { title: string; subtitle: string; rightValue?: string }[];
  colors: ReturnType<typeof useAppTheme>["colors"];
  chipMode?: boolean;
}) {
  return (
    <View style={[getSectionCardStyle(colors, "neutral", { radius: 18 }), { flex: 1 }]}>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.muted }}>{subtitle}</Text> : null}
      {!items.length ? (
        <Text style={{ color: colors.muted }}>Sem dados suficientes ainda.</Text>
      ) : (
        chipMode ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {items.map((item) => (
              <View
                key={`${title}-${item.title}`}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: colors.successBg,
                }}
              >
                <Text style={{ color: colors.successText, fontWeight: "700" }}>{item.title}</Text>
              </View>
            ))}
          </View>
        ) : (
          items.map((item) => (
            <View
              key={`${title}-${item.title}`}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                paddingVertical: 6,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{item.subtitle}</Text>
              </View>
              {item.rightValue ? (
                <Text style={{ color: colors.text, fontWeight: "800" }}>{item.rightValue}</Text>
              ) : null}
            </View>
          ))
        )
      )}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: colors.muted }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}

function TimelineBadge({
  label,
  tone,
  colors,
}: {
  label: string;
  tone: "danger" | "warning" | "info" | "success";
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const palette =
    tone === "danger"
      ? { bg: colors.dangerBg, text: colors.dangerText }
      : tone === "warning"
        ? { bg: colors.warningBg, text: colors.warningText }
        : tone === "info"
          ? { bg: colors.infoBg, text: colors.infoText }
          : { bg: colors.successBg, text: colors.successText };
  return (
    <View
      style={{
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: palette.bg,
      }}
    >
      <Text style={{ color: palette.text, fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const phaseLabel = (phase?: string) =>
  ({
    serve: "Saque",
    sideout: "Side-out",
    transition: "Transição",
    freeball: "Freeball",
    out_of_system: "Fora do sistema",
  } as Record<string, string>)[phase ?? ""] ?? "Sem fase";

const timelineTone = (quality: string) =>
  quality === "error"
    ? "danger"
    : quality === "low"
      ? "warning"
      : quality === "medium"
        ? "info"
        : "success";
