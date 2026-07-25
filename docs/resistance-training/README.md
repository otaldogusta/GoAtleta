# Treinamento Resistido Integrado (Gym & Court)

Este documento centraliza e unifica todo o ecossistema de integração do treinamento resistido (academia/musculação) com o treino de quadra no GoAtleta.

---

## 🎯 Princípios Centrais

1. **A Periodização Manda**: A academia não é paralela à quadra. Ela é um componente do microciclo semanal, e as demandas de quadra orientam o que e quando a academia faz.
2. **Templates Controlados**: São utilizados 5 templates base (A-E) em vez de uma biblioteca infinita de exercícios, focando em distribuição semanal e transferência real para o jogo.
3. **Sem Auto-Intervenção**: O motor de IA observa (QA) e sugere interferências ou melhorias na relação quadra-academia, mas nunca recalibra o treino sozinho. O professor sempre decide.

---

## 🗃️ Estrutura de Dados e Persistência

Os seguintes campos no banco de dados e modelos TypeScript (`src/core/models.ts`) controlam o estado:
- `ClassPlan.weeklyIntegratedContextJson`: Contexto de integração semanal.
- `DailyLessonPlan.sessionEnvironment`: Onde a sessão ocorre (`"quadra" | "academia" | "mista" | "preventiva"`).
- `DailyLessonPlan.sessionComponents`: Componentes ativos na sessão.

### Tipos Importantes
```typescript
interface ResistanceTrainingPlan {
  id: string;
  label: string;
  primaryGoal: ResistanceTrainingGoal;
  transferTarget: string;
  estimatedDurationMin: number;
  exercises: ResistanceExercisePrescription[];
}

interface ResistanceExercisePrescription {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  cadence?: string;
  notes?: string;
  transferTarget?: string;
}
```

---

## 🚀 Histórico de Slices e Guia de Execução (Runbook)

A integração foi dividida e executada em 5 fatias de entregáveis (Slices):

### Slice A1: UI Academia Básica
- **Entregável**: `SessionResistanceBlock.tsx` e `ExercisePrescriptionTable.tsx` em `src/screens/session/components/`.
- **Estratégia**: Criação do componente e de um adapter para extrair `SessionComponentAcademiaResistido` e renderizá-lo como tabela semântica (Nome | Séries × Reps | Intervalo | Notas).

### Slice A2: Cabeçalho Contextual Integrado
- **Entregável**: Enriquecer `SessionContextHeader` para exibir o ambiente, foco físico, relação com a semana e transferência esperada.
- **Estratégia**: Garantir fallback legível se a sessão não tiver contexto integrado.

### Slice B1: Persistência e Integração no Fluxo de Geração
- **Entregável**: Conectar a lógica semanal de periodização em `buildWeeklyIntegratedContext` para salvar no banco o JSON `weeklyIntegratedContextJson`.
- **Estratégia**: Mudar o estado de `sessionEnvironment` no diário para `"academia"` no dia correto e salvar os componentes associados.

### Slice B2: Especialização de Templates por Ênfase Física
- **Entregável**: Atualizar `resolveResistanceTemplate` no core para especializar o plano com base na ênfase da semana (`weeklyPhysicalEmphasis`) e na quantidade de sessões.

### Slice C1: Sinais de Alerta Observacionais (QA Observacional)
- **Entregável**: Sinais inseridos no motor de análise de planos para identificar riscos de sobreposição.

---

## 🔍 Sinais de QA e Observabilidade Atuais

O pipeline de observability do GoAtleta analisa a coerência do microciclo:
1. **Risco de Interferência (`resistance_interference_risk`)**: Disparado se há alta carga de salto na quadra combinada com treino resistido de potência de pernas no mesmo dia ou próximo.
   - *Aviso*: *"Confira se a recuperação e a distribuição da carga entre sessões está adequada."*
2. **Transferência Fraca (`resistance_transfer_weak`)**: Quando um treino resistido não declara o `transferTarget` correspondente à ação na quadra.
   - *Aviso*: *"Vale deixar claro qual ação de jogo a academia pretende sustentar."*
3. **Lacuna de Equilíbrio (`resistance_balance_gap`)**: Se a semana foca excessivamente em membros inferiores/potência sem incluir apoio preventivo ou fortalecimento de core.
   - *Aviso*: *"Verifique se há estabilidade e suporte estrutural suficientes na semana."*

---

## 🚫 Limitações e Fora de Escopo

O sistema de treinamento resistido **não realiza**:
- Criação/Edição de fichas complexas de musculação ou bibliotecas extensas de exercícios.
- Auto-recalibração automática de cargas da academia sem autorização humana.
- Suporte a cálculos de `%1RM`, cargas de treinamento baseadas em velocidade (VBT) ou periodizações de S&C clínicas/avançadas.
