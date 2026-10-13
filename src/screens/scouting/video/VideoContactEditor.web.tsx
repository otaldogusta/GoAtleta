import type { Student } from '../../../core/models';
import { videoOutcomes, videoSkills, videoTime, type VideoContact, type VideoSkill } from '../../../core/scouting-video';
import { StudioAction } from './StudioUI.web';
export function VideoContactEditor({ contact, students, teams, onChange, onSave, onDelete, onTime, onCancel }: {
    contact: VideoContact;
    students: Student[];
    teams: {
        us: string;
        them: string;
    };
    onChange: (contact: VideoContact) => void;
    onSave: () => void;
    onDelete?: () => void;
    onTime: () => void;
    onCancel: () => void;
}) {
    const skill = (value: VideoSkill) => onChange({ ...contact, skill: value, outcome: '' });
    return <><div className="sv-row"><h3>{onDelete ? 'Editar contato' : 'Novo contato'}</h3><small>{videoTime(contact.time, true)}</small></div><div className="sv-skills" role="group" aria-label="Fundamento">{videoSkills.map(s => <StudioAction key={s} label={s} active={s === contact.skill} onPress={() => skill(s)}>{s}</StudioAction>)}</div>
    <div className="sv-fields"><label className="sv-field">Equipe<span><select value={contact.team} onChange={e => onChange({ ...contact, team: e.target.value as 'us' | 'them', studentId: null, athlete: '' })}><option value="us">{teams.us}</option><option value="them">{teams.them}</option></select></span></label>
      <label className="sv-field">Atleta<span><select value={contact.studentId ?? ''} onChange={e => { const student = students.find(s => s.id === e.target.value); onChange({ ...contact, studentId: student?.id ?? null, athlete: student?.name ?? '' }); }}><option value="">Sem atleta identificado</option>{contact.team === 'us' ? students.map(s => <option key={s.id} value={s.id}>{s.name}</option>) : null}</select></span></label></div>
    {!contact.studentId ? <label className="sv-field">Nome ou camisa · opcional<span><input value={contact.athlete} maxLength={80} onChange={e => onChange({ ...contact, athlete: e.target.value })}/></span></label> : null}
    <small>Resultado do contato</small><div className="sv-wrap" style={{ marginTop: 8 }}>{['', ...videoOutcomes[contact.skill]].map(value => <StudioAction key={value} label={value || 'Não avaliar'} active={value === contact.outcome} onPress={() => onChange({ ...contact, outcome: value })}>{value || 'Não avaliar'}</StudioAction>)}</div><div className="sv-editor-actions"><StudioAction label="Cancelar edição do contato" onPress={onCancel}>Cancelar</StudioAction><StudioAction label="Usar instante atual" onPress={onTime}>Usar instante atual</StudioAction>{onDelete ? <StudioAction label="Excluir contato" icon="trash" onPress={onDelete}/> : null}<StudioAction label={onDelete ? 'Salvar contato' : 'Registrar contato'} primary onPress={onSave}>{onDelete ? 'Salvar contato' : 'Registrar contato'}</StudioAction></div></>;
}
