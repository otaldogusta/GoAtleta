import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import type { ClassGroup } from "../../core/models";
import { missingClassActivity, type MissingClassActivity } from "../../core/activity-review";
import { loadActivityReview, saveActivityReview } from "../../api/activity-review";
import { listCalendarPauses } from "../../api/holiday-decisions";
import { ActivityReviewPanel, validReviewDraft, type ReviewDraft } from "./ActivityReviewPanel";
import { Button } from "../../ui/Button";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useAppTheme } from "../../ui/app-theme";
import { claimActivityNotice } from "../../core/activity-notice";
import { compactUiMetrics as metrics, radius, spacing } from "../../theme/tokens";

const EMPTY_ACTIVITY_ITEMS: MissingClassActivity[] = [];

export function ActivityReviewSuggestion({ organizationId, userId, classes, today, onPresence, onSaved, onAvailable, openRequest = 0 }: {
  organizationId: string; userId: string; onAvailable?: (count: number) => void; openRequest?: number; classes: ClassGroup[]; today: string;
  onPresence: (visible: boolean) => void; onSaved: () => Promise<void>;
}) {
  const readScope = JSON.stringify([organizationId, userId, today]);
  const [itemSnapshot, setItemSnapshot] = useState<{ scope: string; rows: MissingClassActivity[] }>({ scope: "", rows: [] });
  const items = itemSnapshot.scope === readScope ? itemSnapshot.rows : EMPTY_ACTIVITY_ITEMS;
  const [dismissed, setDismissed] = useState(true);
  const [requested, setRequested] = useState(openRequest);
  const [open, setOpen] = useState(false);
  const [panelScope, setPanelScope] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<ReviewDraft>({reason:null,start:"",end:"",note:"",resolution:null,newDate:""});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { colors } = useAppTheme();
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    void Promise.all([loadActivityReview(organizationId,today,controller.signal), listCalendarPauses(organizationId)])
      .then(([data,pauses]) => { if (alive) setItemSnapshot({ scope: readScope, rows: missingClassActivity({ classes: classes.filter(c => data.enrolledClassIds.has(c.id)), ...data, pauses, today }) }); })
      .catch(() => { if (alive) setItemSnapshot({ scope: readScope, rows: [] }); }); // No suggestion from incomplete evidence.
    return () => { alive = false; controller.abort(); };
  }, [organizationId,classes,today,readScope]);
  useEffect(() => {
    onAvailable?.(items.length);
    return () => onAvailable?.(0);
  }, [items.length,onAvailable]);
  const hasItems = items.length > 0;
  useEffect(() => {
    if (!hasItems) return;
    let alive = true;
    void claimActivityNotice(userId,organizationId,today).then(show => { if (alive && show) setDismissed(false); });
    return () => { alive = false; };
  }, [userId,organizationId,today,hasItems]);
  const visible = items.length > 0 && !dismissed;
  useEffect(() => { onPresence(visible); return () => onPresence(false); }, [onPresence,visible]);
  const begin = useCallback(() => {
    setPanelScope(readScope);
    setSelected(items.map(i => i.classId)); setError("");
    const dates = items.flatMap(i => i.dates).sort();
    setDraft({reason:null,start:dates[0],end:dates[dates.length-1],note:"",resolution:null,newDate:""}); setOpen(true);
  }, [items,readScope]);
  if (openRequest !== requested) {
    setRequested(openRequest);
    if (items.length) begin();
  }
  const {reason,start,end} = draft;
  const valid = panelScope === readScope && validReviewDraft(draft,selected);
  const save = async () => {
    if (!valid || saving || !reason) return;
    setSaving(true); setError("");
    try {
      if (["recess","suspended","held"].includes(reason)) await saveActivityReview(organizationId,selected,start,end,reason);
      else await saveActivityReview(organizationId,selected,start,end,reason,{note:draft.note.trim(),resolution:draft.resolution,newDate:draft.newDate});
      await onSaved();
      setItemSnapshot(current => current.scope !== readScope ? current : { scope: readScope, rows: current.rows.filter(item => !selected.includes(item.classId) || item.dates[0] < start || item.dates[0] > end) });
      setDismissed(true);
      setOpen(false);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "";
      setError(message.includes("PGRST202") ? "Os novos motivos ainda aguardam ativação. Nenhum registro foi alterado." : "Não foi possível concluir. Confira as datas e tente novamente.");
    }
    finally { setSaving(false); }
  };
  if (!items.length) return null;
  return <>
    {visible && !open ? <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}><GoAtletaIcon name="assistant" size={24} color={colors.successText} /><Text style={[styles.title,styles.grow,{color:colors.text}]}>Houve uma pausa nas aulas?</Text>
        <Pressable style={styles.close} accessibilityRole="button" accessibilityLabel="Dispensar sugestão de pausa" onPress={() => setDismissed(true)}><GoAtletaIcon name="close" size={20} color={colors.muted}/></Pressable>
      </View>
      <Text style={{color:colors.muted}}>{items[0].name}: {items[0].dates.length} datas previstas seguidas sem chamada.{items.length > 1 ? ` Mais ${items.length - 1} turma(s) para revisar.` : ""}</Text>
      <View style={styles.actions}><Button label="Revisar período" onPress={begin}/></View>
    </View> : null}
    <ActivityReviewPanel visible={open && panelScope === readScope} items={items} selected={selected} onSelected={setSelected} draft={draft} onDraft={setDraft} saving={saving} error={error} onClose={() => { if(!saving)setOpen(false); }} onSave={()=>void save()} />
  </>;
}
const styles=StyleSheet.create({
  notice:{width:'100%',padding:spacing.md,gap:spacing.sm,borderWidth:1,borderRadius:radius.container},
  panel:{width:'100%',maxWidth:520,maxHeight:'90%',padding:spacing.lg,gap:spacing.sm,borderWidth:1,borderRadius:radius.container},
  row:{flexDirection:'row',alignItems:'center',gap:spacing.sm},grow:{flex:1,minWidth:0},title:{fontSize:metrics.titleFontSize,fontWeight:'700'},
  close:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center'},actions:{flexDirection:'row',justifyContent:'flex-end'},
  list:{flexShrink:1},item:{paddingVertical:spacing.sm,borderBottomWidth:1,gap:4},label:{fontWeight:'600',marginTop:spacing.sm,marginBottom:spacing.xs},
  option:{padding:spacing.sm,borderRadius:radius.internal,marginBottom:spacing.xs},dates:{flexDirection:'row',gap:spacing.sm},
});
