---
name: goatleta-volleyball-domain
description: Implementar scouting, fundamentos, rotações e quadra visual de voleibol no Go Atleta usando os modelos esportivos e pedagógicos existentes.
---

# Domínio de voleibol

Resolver caminhos na raiz. Identificar modalidade, formato de jogo, fase, categoria e perfil pedagógico antes de aplicar regras de vôlei adulto competitivo a uma turma escolar.

## Fontes do produto

- `src/core/scouting.ts` e `src/core/models.ts`: fundamentos, fases, opções de resultado e sinais de planejamento.
- `src/db/scouting-sessions.ts`: persistência e vínculos de sessões.
- `src/core/visual-court.ts`, `visual-court-editor.ts` e `src/core/presets/5x1-reception.goatleta.json`: coordenadas, atores, fases e referência 5x1.
- `src/core/pedagogy/volleyball-language-lexicon.ts` e `src/core/cycle-day-planning/volleyball-skill-signals.ts`: linguagem e integração pedagógica.

Não confundir zona oficial, slot didático, índice de rotação e posição/função do atleta. Conferir orientação da quadra e fases `receive_legal`, `receive_release` e `attack_shape` antes de mover atores. Preservar ajustes do professor e a extensão editável na serialização.

Scouting contém contratos distintos: contagens simples usam 0–2, enquanto opções de ações podem usar níveis 0–3. Não converter escalas sem rastrear consumidores e histórico. Distinguir fundamento de fase (por exemplo, recepção e side-out), resultado de ação e desfecho de rally.

Regras adaptadas da turma são contexto explícito; não tratá-las automaticamente como erro regulamentar. Para afirmar regras oficiais atuais, consultar a fonte primária da federação aplicável e identificar modalidade/edição. O editor não deve prometer validação regulamentar que não implementa.

Testar invariantes afetadas em `src/core/__tests__/visual-court.test.ts`, `visual-court-editor.test.ts` e testes de scouting. Exportar/importar deve preservar formato e ajustes, sem transportar identidade de alunos ou vínculos de outra turma indevidamente.
