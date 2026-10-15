import type { Student } from '../../../core/models';
import { videoOutcomes, videoSkills, videoTime, type VideoContact, type VideoSkill } from '../../../core/scouting-video';
import { StudioAction } from './StudioUI.web';
import { StudioSelect } from './StudioSelect.web';
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
        <div className="sv-field">Fundamento<StudioSelect label="Fundamento" value={contact.skill} options={videoSkills.map(value => ({ value, label: value }))} onChange={skill}/></div>
        <div className="sv-field">Equipe<StudioSelect label="Equipe" value={contact.team} options={[{ value: 'us', label: teams.us }, { value: 'them', label: teams.them }]} onChange={team => onChange({ ...contact, team, studentId: null, athlete: '' })}/></div>
        <div className={`sv-field${contact.studentId ? ' sv-field-wide' : ''}`}>Atleta<StudioSelect label="Atleta" value={contact.studentId ?? ''} options={[{ value: '', label: 'Sem atleta' }, ...(contact.team === 'us' ? students.map(s => ({ value: s.id, label: s.name })) : [])]} onChange={value => { const student = students.find(s => s.id === value); onChange({ ...contact, studentId: student?.id ?? null, athlete: student?.name ?? '' }); }}/></div>
        {!contact.studentId ? <label className="sv-field">Nome ou camisa<span><input aria-label="Nome ou camisa (opcional)" value={contact.athlete} maxLength={80} onChange={e => onChange({ ...contact, athlete: e.target.value })}/></span></label> : null}
      </div>
      <div className="sv-field">Resultado<StudioSelect label="Resultado do contato" value={contact.outcome} options={['', ...videoOutcomes[contact.skill]].map(value => ({ value, label: value || 'Não avaliar' }))} onChange={outcome => onChange({ ...contact, outcome })}/></div>
      <div className="sv-editor-actions"><StudioAction label="Cancelar edição do contato" onPress={onCancel}>Cancelar</StudioAction><StudioAction label="Usar instante atual" onPress={onTime}>Usar instante atual</StudioAction>{onDelete ? <StudioAction label="Excluir contato" icon="trash" onPress={onDelete}/> : null}<StudioAction label={onDelete ? 'Salvar contato' : 'Registrar contato'} primary disabled={!changed} onPress={onSave}>{onDelete ? 'Salvar contato' : 'Registrar contato'}</StudioAction></div>
    </>;
}
