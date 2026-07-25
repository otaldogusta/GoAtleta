# Cycle Day Planning - Backlog and PR Checklist Archive

Este é um registro histórico consolidado contendo os planos de backlog de implementação e os checklists de PR/sprints para a entrega da funcionalidade de **Cycle Day Planning** (fase executada em Abril de 2026).

---

## 🎯 Objetivo da Funcionalidade

Implementar um motor resiliente de geração de treinos que:
- Sempre gera um plano.
- Degrada graciosamente quando há falta de dados históricos.
- Melhora o direcionamento quando há histórico parcial ou forte.
- Trata edições do professor como sinais locais de aprendizado de alto valor.
- Evita dependência frágil de dados de execução perfeitos.

O motor suporta três estados operacionais:
1. Sem histórico.
2. Histórico parcial ou inconsistente.
3. Histórico recente forte e corrigido pelo professor.

---

## 🏗️ Blocos e Mapeamento de Módulos Core

- **Lógica Pura de Planejamento**: Alocada em `src/core/cycle-day-planning/`.
- **Orquestração e Adapters de Interface**: Alocados em `src/screens/session/application/`.
- **Helpers de Banco de Dados**: Alocados em `src/db/`.

### Tipos Importantes Introduzidos
```typescript
type HistoricalConfidence = "none" | "low" | "medium" | "high";

type SessionExecutionState =
  | "planned_only"
  | "applied_not_confirmed"
  | "teacher_edited"
  | "confirmed_executed"
  | "skipped"
  | "unknown";

interface RecentSessionSummary {
  sessionDate: string;
  wasPlanned: boolean;
  wasApplied: boolean;
  wasEditedByTeacher: boolean;
  wasConfirmedExecuted: boolean | null;
  executionState: SessionExecutionState;
  primarySkill?: string;
  progressionDimension?: string;
  dominantBlock?: string;
  fingerprint?: string;
  teacherOverrideWeight: "none" | "soft" | "strong";
}
```

---

## 🚀 Ordem de Entrega (Checklists de PR)

### Sprint 1: Conexão e Contexto Inicial
- **PR 10 - Contexto Real de Ciclo na Geração**: Uso do contexto do dia do ciclo (cycle-day) como o driver real da sessão em vez de apenas identidade da turma.
- **PR 11 - Resolução do Índice da Sessão na Semana**: Resolver o index de sessão correspondente.
- **PR 12 - Inicialização de Novas Turmas**: Garantir bootstrap seguro e sem quebras em turmas recém-criadas.

### Sprint 2: Ênfase e Evitação de Repetições
- **PR 15 - Bloco Dominante Orientando Estratégia**: O bloco de maior volume orienta o tipo de tarefa sugerido.
- **PR 16 - Carga, Demanda e RPE Modulando Sessões**: Modulação ativa com base no esforço percebido.
- **PR 14 - Anti-Repetição por Fingerprint de Plano**: Evitar geração consecutiva de planos com a mesma estrutura de exercícios.

### Sprint 3: Aprendizado com Professor e Loops de Feedback
- **PR 13 - Edição do Treinador como Aprendizado Local**: Persistência de overrides.
- **PR 17 - Explicação Curta do Plano**: Mostrar resumo da decisão pedagógica da IA na tela.
- **PR 18 - Fechamento do Loop de Aprendizado**: Fechamento do fluxo da periodização até a sessão do dia.
