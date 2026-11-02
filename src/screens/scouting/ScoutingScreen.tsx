import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, View } from "react-native";
import { useIsFocused, useRouter } from "expo-router";
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
import { Copy, ErrorNotice, Input, Link, shortDate } from "./ScoutingUI";
import { ScoutingCollector } from "./ScoutingCollector";
import { ScoutingPerformanceOverview } from "./ScoutingPerformanceOverview";
import { ScoutingSelect, ScoutingTabs } from "./ScoutingNavigation";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { NewScoutingModal } from "./NewScoutingModal";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";
import { radius } from "../../theme/tokens";
import type { ScoutingWorkspaceMode } from "./ScoutingWorkspace.types";
const ScoutingWorkspace = lazy(() => import('./ScoutingWorkspace'));

export function ScoutingScreen({ classId, initialSessionId }: { classId: string; initialSessionId?: string }) {
  const { activeOrganizationId } = useOrganization();
  const { session } = useAuth();
  const userId = session?.user?.id;
  if (!activeOrganizationId || !userId) return <ActivityIndicator />;
  return <ScopedScouting key={`${activeOrganizationId}:${userId}:${classId}`} org={activeOrganizationId} userId={userId} classId={classId} initialSessionId={initialSessionId} />;
}
function ScopedScouting({ org, userId, classId, initialSessionId }: { org: string; userId: string; classId: string; initialSessionId?: string }) {
  const isFocused = useIsFocused();
  markRender("screen.class.scouting");
  const { colors } = useAppTheme();
  const router = useRouter();
  const scoped = useTrainerRouteScope();
  const layout = useResponsiveLayout();
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
  const [current, setCurrent] = useState(Platform.OS === 'web' ? null : initialSessionId ?? null);
  const [creating, setCreating] = useState(false);
  const [workspace, setWorkspace] = useState<{sessionId?:string;mode:ScoutingWorkspaceMode}|null>(Platform.OS === 'web' && initialSessionId ? {sessionId:initialSessionId,mode:'register'} : null);
  const pickedInitialMode = useRef(false);
  const alive = useRef(true);
  const epoch = useRef(0);
  const dirty = useRef(false);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!current && !workspace && !loading && restoreFocus.current) {
      restoreFocus.current = false;
      if (Platform.OS === "web" && typeof document !== "undefined" && document.activeElement === document.body) document.getElementById(`scouting-${tab}-tab`)?.focus();
    }
  }, [current, workspace, loading, tab]);
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
  useEffect(() => {
    if (pickedInitialMode.current || !rows.length) return;
    pickedInitialMode.current = true;
    const selected = rows.find(row => row.session.id === initialSessionId) ?? rows[0];
    setMode(selected.session.type === 'treino' ? 'treino' : 'jogo');
  }, [rows, initialSessionId]);
  const visible = useMemo(() => rows.filter(({ session: s }) => (mode === "treino" ? s.type === "treino" : s.type !== "treino") &&
    (tab !== 'history' || format === "all" || (s.format ?? "unknown") === format) && (year === "all" || s.date.slice(0, 4) === year) && (month === "all" || s.date.slice(5, 7) === month)), [rows, mode, format, year, month, tab]);
  const completed = useMemo(() => visible.filter(r => r.session.status === "concluido"), [visible]);
  const inProgress = visible.filter(r => r.session.status === "em_andamento");
  const active = inProgress[0];
  const periods = [...new Set(rows.map(r => r.session.date.slice(0, 7)))].sort().reverse();
  const periodOptions = [{ value: "all", label: "Todo o período" }, ...[...new Set(periods.map(p => p.slice(0, 4)))].flatMap(y => [
    { value: y, label: `Ano de ${y}` }, ...periods.filter(p => p.startsWith(y)).map(p => ({ value: p, label: new Date(`${p}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) })),
  ])];
  const historyRows = visible.filter(row => `${row.session.title} ${row.session.opponent ?? ""}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));
  const back = () => router.replace(classId ? { pathname: "/class/[id]", params: { id: classId } } : scoped.classes);
  const close = () => { restoreFocus.current = true; setCurrent(null); setWorkspace(null); if (dirty.current) { dirty.current = false; reloadRows(); } if (initialSessionId) router.replace({ pathname: "/class/[id]/scouting", params: { id: classId } }); };
  const openAnalysis = (id?:string, area:ScoutingWorkspaceMode='register') => { if (Platform.OS === 'web') setWorkspace({sessionId:id,mode:area}); else if(id) setCurrent(id); else setCreating(true); };
  const shell = { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.card, padding: layout.density.cardPadding, gap: 12 } as const;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScreenPageHeader title="Scouting" eyebrow={cls?.name} onBack={back} right={<Button label={Platform.OS === 'web' ? 'Estúdio' : '+ Nova análise'} disabled={loading || (!ready && !rows.length)} onPress={() => Platform.OS === 'web' ? openAnalysis(active?.session.id ?? visible[0]?.session.id ?? rows[0]?.session.id,'video') : setCreating(true)} />} />
    <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}>
      <ResponsivePage gap={layout.density.pageGap}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><ScoutingTabs segmented value={mode} onChange={v => setMode(v as "treino" | "jogo")} items={[{ value: "treino", label: "Treinos" }, { value: "jogo", label: "Jogos" }]} /><Copy muted>{cls?.name}</Copy></View>
      <ErrorNotice text={error} />
      {error ? <Link label="Tentar novamente" onPress={() => reloadRows()} /> : null}
      {!loading && !ready && !error ? <Copy muted>A nova coleta aguarda atualização do banco. Você pode consultar as análises existentes.</Copy> : null}
      {loading ? <ActivityIndicator color={colors.text} /> : null}
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <ScoutingTabs value={tab} onChange={v => setTab(v as "overview" | "history")} items={[{ value: "overview", label: "Visão geral", id: "scouting-overview-tab" }, { value: "history", label: `Histórico${visible.length ? ` · ${visible.length}` : ""}`, id: "scouting-history-tab" }]} />
          <ScoutingSelect label="Período" calendar value={year === "all" ? "all" : month === "all" ? year : `${year}-${month}`} options={periodOptions} onChange={v => { const [y, m] = v.split("-"); setYear(y); setMonth(m ?? "all"); }} />
        </View>
        {tab === 'history' ? <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Copy muted>Contexto observado</Copy><ScoutingSelect label="Contexto observado" outlined value={format} onChange={setFormat} options={["all", "2x2", "3x3", "4x4", "6x6", "outro", "unknown"].map(f => ({ value: f, label: f === "all" ? "Todos os contextos" : f === "unknown" ? "Não informado" : f === "outro" ? "Outro" : f.replace("x", " × ") }))} /></View>
        </View> : null}
      </View>
      {tab === "overview" ? <ScoutingPerformanceOverview rows={completed} ready={ready} onReview={id=>openAnalysis(id)} /> : <View style={{ gap: 4 }}>
        <Input label="Buscar análise" value={query} onChangeText={setQuery} placeholder="Título ou adversário" />
        {!historyRows.length && !loading ? <Copy muted>Nenhuma análise neste filtro.</Copy> : null}
        {historyRows.map(row => <Pressable key={row.session.id} accessibilityRole="button" accessibilityLabel={`Abrir ${row.session.title}, ${shortDate(row.session.date)}`} onPress={() => openAnalysis(row.session.id)} style={{ padding: 12, borderRadius: radius.internal, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", gap: 16, alignItems: "center" }}>
          <View style={{ flex: 1, gap: 4 }}><Copy>{row.session.title}</Copy><Copy muted>{shortDate(row.session.date)} · {row.session.format ?? "Contexto não informado"}{ready ? ` · ${row.counts.reduce((n, c) => n + c.count, 0)} ações` : ""}</Copy></View>
          <Copy muted>{row.session.status === "concluido" ? "Concluída" : "Em andamento"} ›</Copy>
        </Pressable>)}
      </View>}
      {active ? <View style={[shell, { flexDirection: 'row', alignItems: 'center' }]}><GoAtletaIcon name="scouting" size={16} color={colors.muted}/><View style={{flex:1,gap:4}}><Copy muted>Em andamento{inProgress.length > 1 ? ` · ${inProgress.length} análises` : ''}</Copy><Copy>{active.session.title}</Copy></View><Link label="Continuar" onPress={()=>openAnalysis(active.session.id,'video')}/></View>:null}
      {tab === "overview" && completed.length > 0 ? <View style={{ gap: 10 }}>
        <Copy title>Últimas análises</Copy>
        {completed.slice(0, 3).map(row => <Pressable key={row.session.id} accessibilityRole="button" onPress={() => openAnalysis(row.session.id)} style={{ padding: 12, borderRadius: radius.internal, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Copy>{row.session.title} ›</Copy><Copy muted>{shortDate(row.session.date)} · {row.session.format ?? "Contexto não informado"}</Copy>
        </Pressable>)}
        <Link label="Ver histórico completo" onPress={() => setTab("history")} />
      </View> : null}
      {hasMore ? <Button label="Carregar análises anteriores" variant="outline" loading={loading} onPress={() => reloadRows(rows.length)} /> : null}
      </ResponsivePage>
    </ScrollView>
    {Platform.OS !== 'web' && current ? <ScoutingCollector key={current} org={org} sessionId={current} userId={userId} students={students} onClose={close} onSaved={() => { dirty.current = true; }} /> : null}
    {Platform.OS !== 'web' && creating ? <NewScoutingModal org={org} classId={classId} mode={mode} onClose={() => setCreating(false)} onCreated={id => { setCreating(false); setCurrent(id); reloadRows(); }} /> : null}
    {workspace && Platform.OS === 'web' ? <Suspense fallback={<ActivityIndicator accessibilityLabel="Abrindo estúdio de scouting"/>}><ScoutingWorkspace org={org} userId={userId} classId={classId} teamName={cls?.name??''} students={students} rows={rows} mode={mode} canCreate={ready} active={isFocused} initialSessionId={workspace.sessionId} initialMode={workspace.mode} onClose={close} onSaved={()=>{dirty.current=true;}} onCreated={()=>reloadRows()}/></Suspense>:null}
  </SafeAreaView>;
}
