import type { Student } from '../../../core/models';
import { videoOutcomes, videoSkills, videoTime, type VideoContact, type VideoSkill } from '../../../core/scouting-video';
import { StudioAction } from './StudioUI.web';
export function VideoContactEditor({ contact, students, teams, onChange, onSave, onDelete, onTime, onCancel, changed = true }: {
    changed?: boolean;
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
    const skill = (value: VideoSkill) => { if (value !== contact.skill) onChange({ ...contact, skill: value, outcome: '' }); };
    return <>
      <div className="sv-row"><h3>{onDelete ? 'Editar contato' : 'Novo contato'}</h3><small>{videoTime(contact.time, true)}</small></div>
      <div className="sv-fields">
        <label className="sv-field">Fundamento<span><select aria-label="Fundamento" value={contact.skill} onChange={event => skill(event.target.value as VideoSkill)}>{videoSkills.map(value => <option key={value} value={value}>{value}</option>)}</select></span></label>
        <label className="sv-field">Equipe<span><select value={contact.team} onChange={e => onChange({ ...contact, team: e.target.value as 'us' | 'them', studentId: null, athlete: '' })}><option value="us">{teams.us}</option><option value="them">{teams.them}</option></select></span></label>
        <label className={`sv-field${contact.studentId ? ' sv-field-wide' : ''}`}>Atleta<span><select value={contact.studentId ?? ''} onChange={e => { const student = students.find(s => s.id === e.target.value); onChange({ ...contact, studentId: student?.id ?? null, athlete: student?.name ?? '' }); }}><option value="">Sem atleta</option>{contact.team === 'us' ? students.map(s => <option key={s.id} value={s.id}>{s.name}</option>) : null}</select></span></label>
        {!contact.studentId ? <label className="sv-field">Nome ou camisa · opcional<span><input value={contact.athlete} maxLength={80} onChange={e => onChange({ ...contact, athlete: e.target.value })}/></span></label> : null}
      </div>
      <label className="sv-field">Resultado<span><select aria-label="Resultado do contato" value={contact.outcome} onChange={event => onChange({ ...contact, outcome: event.target.value })}>{['', ...videoOutcomes[contact.skill]].map(value => <option key={value} value={value}>{value || 'Não avaliar'}</option>)}</select></span></label>
      <div className="sv-editor-actions"><StudioAction label="Cancelar edição do contato" onPress={onCancel}>Cancelar</StudioAction><StudioAction label="Usar instante atual" onPress={onTime}>Usar instante atual</StudioAction>{onDelete ? <StudioAction label="Excluir contato" icon="trash" onPress={onDelete}/> : null}<StudioAction label={onDelete ? 'Salvar contato' : 'Registrar contato'} primary disabled={!changed} onPress={onSave}>{onDelete ? 'Salvar contato' : 'Registrar contato'}</StudioAction></div>
    </>;
}
