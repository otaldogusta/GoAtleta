import type { VideoContact, VideoSkill } from '../../../core/scouting-video';

export type ContactOutcomeTone = 'neutral' | 'error' | 'warning' | 'positive' | 'point';

// Presentation only: a contact evaluation never assigns the rally winner.
const outcomes: Record<VideoSkill, Record<string, ContactOutcomeTone>> = {
    Saque: { Ace: 'point', Erro: 'error' },
    Recepção: { Controlada: 'positive', 'Limitou o ataque': 'warning', 'Bola devolvida direto': 'warning', Erro: 'error' },
    Levantamento: { Atacável: 'positive', 'Fora de condição': 'warning', 'Bola enviada ao adversário': 'warning', Erro: 'error' },
    Ataque: { 'Ponto de ataque': 'point', Bloqueado: 'warning', Erro: 'error' },
    Bloqueio: { 'Ponto de bloqueio': 'point', Erro: 'error' },
    Defesa: { Controlada: 'positive', Erro: 'error' },
    'Bola de graça': { 'Ponto direto': 'point', Erro: 'error' },
    'Cobertura de ataque': { Controlada: 'positive', Erro: 'error' },
};

export const contactOutcomeSymbols: Record<ContactOutcomeTone, string> = { neutral: '', error: '×', warning: '!', positive: '✓', point: '★' };

export function contactOutcomeTone(contact: Pick<VideoContact, 'skill' | 'outcome'>): ContactOutcomeTone {
    return outcomes[contact.skill][contact.outcome] ?? 'neutral';
}

export function contactOutcomeSummary(contacts: VideoContact[]) {
    const counts: Record<ContactOutcomeTone, number> = { neutral: 0, error: 0, warning: 0, positive: 0, point: 0 };
    for (const contact of contacts) counts[contactOutcomeTone(contact)]++;
    return ([
        ['error', 'erro', 'erros'], ['warning', 'comprometido', 'comprometidos'],
        ['point', 'ponto direto', 'pontos diretos'], ['positive', 'positivo', 'positivos'],
    ] as const).filter(([tone]) => counts[tone]).map(([tone, singular, plural]) => ({ tone, count: counts[tone], label: `${counts[tone]} ${counts[tone] === 1 ? singular : plural}` }));
}
