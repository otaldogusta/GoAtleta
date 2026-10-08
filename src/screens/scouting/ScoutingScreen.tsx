import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../auth/auth";
import { useOrganization } from "../../providers/organization-context";
import { ScreenPageHeader } from "../../components/ui/ScreenPageHeader";
import { ResponsivePage } from "../../components/ui/ResponsivePage";
import type { ClassGroup, Student } from "../../core/models";
import { getClassById, getStudentsByClass } from "../../db/seed";
import { loadScoutingOverview, type ScoutingOverview } from "../../db/scouting-collection";
import { useAppTheme } from "../../ui/app-theme";
import { Button } from "../../ui/Button";
import { Pressable } from "../../ui/Pressable";
import { markRender, measureAsync } from "../../observability/perf";
import { useTrainerRouteScope } from "../../navigation/use-trainer-route-scope";
import { amount, Copy, ErrorNotice, Input, Link, shortDate } from "./ScoutingUI";
import { ScoutingCollector } from "./ScoutingCollector";
import { ScoutingMetrics } from "./ScoutingMetrics";
import { ScoutingSelect, ScoutingTabs } from "./ScoutingNavigation";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { NewScoutingModal } from "./NewScoutingModal";

export function ScoutingScreen({ classId, initialSessionId }: { classId: string; initialSessionId?: string }) {
  const { activeOrganizationId } = useOrganization();
  const { session } = useAuth();
  const userId = session?.user?.id;
  if (!activeOrganizationId || !userId) return <ActivityIndicator />;
  return <ScopedScouting key={`${activeOrganizationId}:${userId}:${classId}`} org={activeOrganizationId} userId={userId} classId={classId} initialSessionId={initialSessionId} />;
}
function ScopedScouting({ org, userId, classId, initialSessionId }: { org: string; userId: string; classId: string; initialSessionId?: string }) {
  markRender("screen.class.scouting");
  const { colors } = useAppTheme();
  const router = useRouter();
  const scoped = useTrainerRouteScope();
  const { width } = useWindowDimensions();
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [rows, setRows] = useState<ScoutingOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [mode, setMode] = useState<"treino" | "jogo">("treino");
  const [tab, setTab] = useState<"overview" | "history">("overview");
  const [format, setFormat] = useState("all");
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [query, setQuery] = useState("");
  const [criteria, setCriteria] = useState(false);
  const [current, setCurrent] = useState(initialSessionId ?? null);
  const [creating, setCreating] = useState(false);
  const alive = useRef(true);
  const epoch = useRef(0);
  const dirty = useRef(false);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!current && !loading && restoreFocus.current) {
      restoreFocus.current = false;
      if (Platform.OS === "web" && typeof document !== "undefined" && document.activeElement === document.body) document.getElementById(`scouting-${tab}-tab`)?.focus();
    }
  }, [current, loading, tab]);
  const fetchRows = useCallback(async (offset = 0) => {
    const token = ++epoch.current;
    try {
      const data = await measureAsync("screen.class.scouting.load.overview", () => loadScoutingOverview(org, classId, offset));
      if (!alive.current || token !== epoch.current) return;
      setRows(old => offset ? [...old, ...data.rows.filter(r => !old.some(o => o.session.id === r.session.id))] : data.rows);
      setReady(data.ready); setHasMore(data.rows.length === 50);
    } catch { if (alive.current && token === epoch.current) setError("Não foi possível carregar o scouting. Tente novamente."); }
    finally { if (alive.current && token === epoch.current) setLoading(false); }
  }, [org, classId]);
  const reloadRows = (offset = 0) => { setLoading(true); setError(""); void fetchRows(offset); };
  useEffect(() => {
    alive.current = true;
    // Start IO after this commit; cleanup can cancel a superseded mount.
    void Promise.resolve().then(() => { if (alive.current) return fetchRows(); });
    void Promise.all([getClassById(classId, { organizationId: org }), getStudentsByClass(classId, { organizationId: org })]).then(([group, roster]) => {
      if (alive.current) { setCls(group); setStudents(roster); }
    }).catch(() => { if (alive.current) setError("Não foi possível carregar a turma e os atletas."); });
    return () => { alive.current = false; epoch.current += 1; };
  }, [classId, org, fetchRows]);
  const visible = useMemo(() => rows.filter(({ session: s }) => (mode === "treino" ? s.type === "treino" : s.type !== "treino") &&
    (format === "all" || (s.format ?? "unknown") === format) && (year === "all" || s.date.slice(0, 4) === year) && (month === "all" || s.date.slice(5, 7) === month)), [rows, mode, format, year, month]);
  const completed = useMemo(() => visible.filter(r => r.session.status === "concluido"), [visible]);
  const counts = useMemo(() => completed.flatMap(r => r.counts), [completed]);
  const actionCount = counts.reduce((total, c) => total + c.count, 0);
  const inProgress = visible.filter(r => r.session.status === "em_andamento");
  const active = inProgress[0];
  const contextKinds = new Set(completed.map(r => r.session.format ?? "unknown"));
  const mixed = contextKinds.size > 1;
  const periods = [...new Set(rows.map(r => r.session.date.slice(0, 7)))].sort().reverse();
  const periodOptions = [{ value: "all", label: "Todo o período" }, ...[...new Set(periods.map(p => p.slice(0, 4)))].flatMap(y => [
    { value: y, label: `Ano de ${y}` }, ...periods.filter(p => p.startsWith(y)).map(p => ({ value: p, label: new Date(`${p}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) })),
  ])];
  const historyRows = visible.filter(row => `${row.session.title} ${row.session.opponent ?? ""}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));
  const back = () => router.replace(classId ? { pathname: "/class/[id]", params: { id: classId } } : scoped.classes);
  const close = () => { restoreFocus.current = true; setCurrent(null); if (dirty.current) { dirty.current = false; reloadRows(); } if (initialSessionId) router.replace({ pathname: "/class/[id]/scouting", params: { id: classId } }); };
  const shell = { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 20, gap: 16 } as const;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScreenPageHeader title="Scouting" eyebrow={cls?.name} onBack={back} right={<Button label="+ Nova análise" variant={active ? "outline" : "primary"} disabled={!ready || loading} onPress={() => setCreating(true)} />} />
    <ScrollView contentContainerStyle={{ paddingTop: 24, paddingBottom: 48 }}>
      <ResponsivePage gap={24}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><ScoutingTabs segmented value={mode} onChange={v => setMode(v as "treino" | "jogo")} items={[{ value: "treino", label: "Treinos" }, { value: "jogo", label: "Jogos" }]} /><Copy muted>{cls?.name}</Copy></View>
      <ErrorNotice text={error} />
      {error ? <Link label="Tentar novamente" onPress={() => reloadRows()} /> : null}
      {!loading && !ready && !error ? <Copy muted>A nova coleta aguarda atualização do banco. Você pode consultar as análises existentes.</Copy> : null}
      {loading ? <ActivityIndicator color={colors.text} /> : null}
      {active ? <View style={[shell, { flexDirection: width >= 650 ? "row" : "column", justifyContent: "space-between", alignItems: width >= 650 ? "center" : "stretch" }]}>
        <GoAtletaIcon name="scouting" size={20} color={colors.muted} /><View style={{ gap: 5, flex: 1 }}><Copy muted>Em andamento{inProgress.length > 1 ? ` · ${inProgress.length} análises` : ""}</Copy><Copy title>{active.session.title}</Copy><Copy muted>{shortDate(active.session.date)} · {active.session.format ?? "Contexto não informado"}</Copy></View>
        <Button label={ready ? "Continuar análise" : "Ver análise"} onPress={() => setCurrent(active.session.id)} />
      </View> : null}
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <ScoutingTabs value={tab} onChange={v => setTab(v as "overview" | "history")} items={[{ value: "overview", label: "Visão geral", id: "scouting-overview-tab" }, { value: "history", label: `Histórico${visible.length ? ` · ${visible.length}` : ""}`, id: "scouting-history-tab" }]} />
          <ScoutingSelect label="Período" calendar value={year === "all" ? "all" : month === "all" ? year : `${year}-${month}`} options={periodOptions} onChange={v => { const [y, m] = v.split("-"); setYear(y); setMonth(m ?? "all"); }} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Copy muted>Contexto observado</Copy><ScoutingSelect label="Contexto observado" outlined value={format} onChange={setFormat} options={["all", "2x2", "3x3", "4x4", "6x6", "outro", "unknown"].map(f => ({ value: f, label: f === "all" ? "Todos os contextos" : f === "unknown" ? "Não informado" : f === "outro" ? "Outro" : f.replace("x", " × ") }))} /></View>
          {tab === "overview" ? <Copy muted>Somente análises concluídas</Copy> : null}
        </View>
      </View>
      {tab === "overview" ? <View style={shell}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><View style={{ gap: 5 }}><Copy title>Leitura da equipe</Copy><Copy muted>{ready ? `${amount(completed.length, "análise concluída exibida", "análises concluídas exibidas")} · ${amount(actionCount, "ação observada", "ações observadas")}` : "Somente análises concluídas"}</Copy></View><Link label="Critérios" onPress={() => setCriteria(!criteria)} /></View>
        {mode === "jogo" && !mixed && ready && completed.some(r => r.rallyStats.total > 0) ? <View style={{ flexDirection: "row", gap: 24, flexWrap: "wrap", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>{(["receiving", "serving"] as const).map(k => {
          const total = completed.reduce((n, r) => n + r.rallyStats[k], 0);
          const won = completed.reduce((n, r) => n + r.rallyStats[k === "receiving" ? "receivingWon" : "servingWon"], 0);
          return <View key={k} style={{ gap: 4 }}><Copy>{k === "receiving" ? "Pontos recebendo · side-out" : "Pontos sacando · break point"}</Copy><Copy title>{total ? `${Math.round(won / total * 100)}%` : "—"}</Copy><Copy muted>{won} de {total} jogadas registradas</Copy></View>;
        })}</View> : null}
        {mixed ? <Copy muted>Selecione um contexto para comparar tarefas equivalentes.</Copy> : actionCount > 0 && ready ? <ScoutingMetrics counts={counts} /> : <Copy muted>{ready ? "Conclua uma análise com registros para ver a leitura da equipe." : "Os indicadores estarão disponíveis após a atualização."}</Copy>}
        {criteria ? <Copy muted>Recepção, saque e defesa: resultados de nível 2 ou 3 / ações observadas. Ataque: (pontos − erros − bloqueios que encerraram o ponto) / ataques classificados. “Bloqueado” de registros antigos fica fora desse cálculo. Não é a porcentagem de pontos ganhos. Somente análises concluídas e carregadas entram nesta leitura; ausência de registro não é erro. Treinos e jogos permanecem separados.</Copy> : null}
      </View> : <View style={{ gap: 4 }}>
        <Input label="Buscar análise" value={query} onChangeText={setQuery} placeholder="Título ou adversário" />
        {!historyRows.length && !loading ? <Copy muted>Nenhuma análise neste filtro.</Copy> : null}
        {historyRows.map(row => <Pressable key={row.session.id} accessibilityRole="button" accessibilityLabel={`Abrir ${row.session.title}, ${shortDate(row.session.date)}`} onPress={() => setCurrent(row.session.id)} style={{ paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", gap: 16, alignItems: "center" }}>
          <View style={{ flex: 1, gap: 4 }}><Copy>{row.session.title}</Copy><Copy muted>{shortDate(row.session.date)} · {row.session.format ?? "Contexto não informado"}{ready ? ` · ${row.counts.reduce((n, c) => n + c.count, 0)} ações` : ""}</Copy></View>
          <Copy muted>{row.session.status === "concluido" ? "Concluída" : "Em andamento"} ›</Copy>
        </Pressable>)}
      </View>}
      {tab === "overview" && completed.length > 0 ? <View style={{ gap: 10 }}>
        <Copy title>Últimas análises</Copy>
        {completed.slice(0, 3).map(row => <Pressable key={row.session.id} accessibilityRole="button" onPress={() => setCurrent(row.session.id)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Copy>{row.session.title} ›</Copy><Copy muted>{shortDate(row.session.date)} · {row.session.format ?? "Contexto não informado"}</Copy>
        </Pressable>)}
        <Link label="Ver histórico completo" onPress={() => setTab("history")} />
      </View> : null}
      {hasMore ? <Button label="Carregar análises anteriores" variant="outline" loading={loading} onPress={() => reloadRows(rows.length)} /> : null}
      </ResponsivePage>
    </ScrollView>
    {current ? <ScoutingCollector key={current} org={org} sessionId={current} userId={userId} students={students} onClose={close} onSaved={() => { dirty.current = true; }} /> : null}
    {creating ? <NewScoutingModal org={org} classId={classId} mode={mode} onClose={() => setCreating(false)} onCreated={id => { setCreating(false); setCurrent(id); reloadRows(); }} /> : null}
  </SafeAreaView>;
}
