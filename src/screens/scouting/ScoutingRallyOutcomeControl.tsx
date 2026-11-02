import { useState } from 'react';
import { View } from 'react-native';
import type { ScoutingRallyOutcome, ScoutingSide } from '../../core/models';
import { scoutingRallyFaultLabels, scoutingRallyFaultReasons, scoutingRallyOutcomeLabel } from '../../core/scouting-rallies';
import { Choice, Link } from './ScoutingUI';
import { CaptureText } from './ScoutingCaptureUI';

/** Optional ending; technical contacts remain independent and may be incomplete. */
export function ScoutingRallyOutcomeControl({ outcome, serve, disabled, onChange }: {
  outcome: ScoutingRallyOutcome | null; serve: ScoutingSide; disabled: boolean;
  onChange: (outcome: ScoutingRallyOutcome | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 4 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <Link label={outcome ? scoutingRallyOutcomeLabel(outcome) : 'Motivo do ponto'} selected={open} disabled={disabled} onPress={() => setOpen(!open)}/>
      {outcome ? <Link label="Limpar motivo" disabled={disabled} onPress={() => { onChange(null); setOpen(false); }}/> : null}
    </View>
    {open ? <>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {(['us', 'them'] as const).map(team => <Choice compact key={team} label={team === 'us' ? 'Falta nossa' : 'Falta adversária'}
          selected={outcome?.kind === 'falta' && outcome.team === team} disabled={disabled}
          onPress={() => onChange({ kind: 'falta', team, reason: outcome?.kind === 'falta' ? outcome.reason : 'outra' })}/>)}
        {serve === 'them' ? <Choice compact label="Ace adversário" selected={outcome?.kind === 'ace' && outcome.team === 'them'} disabled={disabled}
          onPress={() => { onChange({ kind: 'ace', team: 'them' }); setOpen(false); }}/> : null}
      </View>
      {outcome?.kind === 'falta' ? <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
        {scoutingRallyFaultReasons.map(reason => <Choice compact key={reason} label={scoutingRallyFaultLabels[reason]} selected={outcome.reason === reason} disabled={disabled}
          onPress={() => { onChange({ ...outcome, reason }); setOpen(false); }}/>)}
      </View> : <CaptureText muted>O detalhe é opcional.</CaptureText>}
    </> : null}
  </View>;
}
