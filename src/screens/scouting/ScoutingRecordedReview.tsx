import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { OperationalText as Text } from '../../ui/OperationalText';
import { Pressable } from '../../ui/Pressable';
import { useAppTheme } from '../../ui/app-theme';
import { compactUiMetrics as metrics, radius, spacing } from '../../theme/tokens';
import { captureResult, scoutingRallyOutcomeLabel } from '../../core/scouting-rallies';
import type { ScoutingDetail } from '../../db/scouting-collection';
import { CaptureText } from './ScoutingCaptureUI';
import { skillLabel } from './ScoutingUI';
import { GoAtletaIcon } from '../../ui/icon-registry';

/** Review observed game records without a video or any write command. */
export function ScoutingRecordedReview({ detail, containerWidth = 1040 }: { detail: ScoutingDetail; containerWidth?: number }) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<string | null>(null);
  const [contactIndex, setContactIndex] = useState(0);
  const points = detail.rallies;
  const point = points.find(item => item.id === selected) ?? points[0];
  const pointIndex = point ? points.indexOf(point) : -1;
  const contact = point?.contacts[contactIndex] ?? point?.contacts[0];
  const wide = containerWidth >= 900;
  const panelWidth = Math.min(340, Math.max(300, width * .3));
  const choose = (id: string) => { setSelected(id); setContactIndex(0); };
  const section = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, minWidth: 0, overflow: 'hidden' as const };
  const heading = { padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: spacing.sm };
  return <View role="region" accessibilityLabel="Revisar scouting sem vídeo" style={{ flex: 1, minHeight: 0, width: '100%', flexDirection: wide ? 'row' : 'column', gap: spacing.sm }}>
    <View style={[section, { flex: wide ? 1 : undefined, maxHeight: wide ? undefined : 260, minHeight: wide ? 0 : 180 }]}>
      <View style={heading}><CaptureText strong>{points.length ? `Pontos · ${points.length}` : `Ações · ${detail.actions.length}`}</CaptureText><CaptureText muted>{detail.session.status === 'concluido' ? 'Concluído' : 'Registrado'}</CaptureText></View>
      <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ padding: spacing.xs, gap: spacing.xs }}>
        {points.map((item, index) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Revisar ponto ${index + 1}, set ${item.setNumber}, ${item.scoreUs} a ${item.scoreThem}`} accessibilityState={{ selected: item.id === point?.id }} onPress={() => choose(item.id)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: metrics.touchTarget, padding: spacing.sm, borderRadius: radius.internal, backgroundColor: item.id === point?.id ? colors.surfaceElevated : 'transparent', borderWidth: 1, borderColor: item.id === point?.id ? colors.borderStrong : 'transparent' }}>
          <View style={{ width: 60 }}><CaptureText muted>{String(index + 1).padStart(2, '0')} · S{item.setNumber}</CaptureText><CaptureText strong>{item.scoreUs} × {item.scoreThem}</CaptureText></View>
          <Text numberOfLines={2} style={{ flex: 1, color: colors.text, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight }}>{item.outcome ? scoutingRallyOutcomeLabel(item.outcome) : item.contacts.length ? item.contacts.map(c => `${c.athleteName || 'Equipe'} · ${captureResult(c)?.label ?? c.resultKey}`).join(' → ') : 'Somente placar'}</Text>
        </Pressable>)}
        {!points.length ? detail.actions.map(action => <View key={action.id} style={{ padding: spacing.sm, gap: spacing.xs }}><CaptureText strong>{action.athleteName || 'Equipe'}</CaptureText><CaptureText muted>{skillLabel(action.fundamental)} · {action.resultLabel}</CaptureText></View>) : null}
        {!points.length && !detail.actions.length ? <View style={{ padding: spacing.sm }}><CaptureText muted>Nenhum registro nesta análise.</CaptureText></View> : null}
      </ScrollView>
    </View>
    {point ? <View style={[section, { width: wide ? panelWidth : '100%', flex: wide ? undefined : 1, minHeight: 0 }]}>
      <View style={heading}><CaptureText strong>Set {point.setNumber} · Ponto {pointIndex + 1}</CaptureText><View style={{ flexDirection: 'row', gap: spacing.xs }}>{[-1, 1].map(direction => { const disabled = direction < 0 ? pointIndex <= 0 : pointIndex >= points.length - 1; return <Pressable key={direction} accessibilityRole="button" accessibilityLabel={direction < 0 ? 'Ponto anterior' : 'Próximo ponto'} accessibilityState={{ disabled }} disabled={disabled} onPress={() => choose(points[pointIndex + direction].id)} style={{ width: metrics.touchTarget, minHeight: metrics.touchTarget, alignItems: 'center', justifyContent: 'center', opacity: disabled ? .45 : 1 }}><GoAtletaIcon name={direction < 0 ? 'chevronBack' : 'chevronForward'} size={metrics.iconSize} color={colors.text} /></Pressable>; })}</View></View>
      <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ padding: spacing.sm, gap: spacing.sm }}>
        <View accessibilityLabel={`Placar registrado: nós ${point.scoreUs}, adversário ${point.scoreThem}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><CaptureText muted>Nós</CaptureText><Text style={{ color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{point.scoreUs} × {point.scoreThem}</Text><CaptureText muted>Adversário</CaptureText></View>
        {point.outcome ? <CaptureText>{scoutingRallyOutcomeLabel(point.outcome)}</CaptureText> : null}
        <CaptureText strong>Contatos · {point.contacts.length}</CaptureText>
        {point.contacts.map((item, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Ver contato ${index + 1}: ${item.athleteName || 'Equipe'}`} accessibilityState={{ selected: item === contact }} onPress={() => setContactIndex(index)} style={{ gap: spacing.xs, padding: spacing.sm, minHeight: metrics.touchTarget, borderRadius: radius.internal, backgroundColor: item === contact ? colors.surfaceElevated : 'transparent', borderWidth: 1, borderColor: item === contact ? colors.borderStrong : colors.border }}><CaptureText strong>{item.athleteName || 'Equipe'}</CaptureText><CaptureText muted>{item.resultKey === 'freeball_devolvida' ? 'Bola de graça' : skillLabel(item.fundamental)} · {item.resultKey === 'freeball_devolvida' ? 'Devolvida' : captureResult(item)?.label ?? item.resultKey}</CaptureText></Pressable>)}
        {!point.contacts.length ? <CaptureText muted>Somente placar registrado.</CaptureText> : null}
        {contact?.zone ? <View style={{ gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}><CaptureText muted>Local do contato</CaptureText><CaptureText strong>Zona {contact.zone}</CaptureText></View> : null}
      </ScrollView>
    </View> : null}
  </View>;
}
