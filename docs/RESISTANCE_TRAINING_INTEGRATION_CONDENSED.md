# GoAtleta: Integração de Treinamento Resistido — VERSÃO CONDENSADA

**Use isto quando o contexto ficar apertado. Mesmo DNA da versão completa, 30% do tamanho.**

---

## ⚡ RESUMO EXECUTIVO

**Missão:** Evoluir GoAtleta de "planejador de aula" para "planejador de microciclo integrado" onde quadra + academia seguem a mesma lógica de periodização.

**NÃO é:** app de musculação, ficha hiper detalhada, biblioteca infinita de exercícios.

**É:** academia como *componente do microciclo*, governada pela semana.

Regra operacional desta fase: usar os campos reais já definidos em `src/core/models.ts` e não criar aliases paralelos na UI.

---

## 🎯 O QUE JÁ EXISTE (NÃO REFAZER)

- ✅ Modelos: `IntegratedTrainingModel`, `ResistanceTrainingProfile`, `SessionEnvironment`
- ✅ Contexto: `training-context.ts` com `resolveTeamTrainingContext()`
- ✅ Builders: `buildWeeklyIntegratedContext()`, `resolveSessionEnvironment()`
- ✅ Templates A-E base definidos
- ✅ Testes passando

**Trabalho agora:** elevar isso a produto real (render + gerador + observação).

---

## 🚨 O QUE FALTA

1. **Sessão resistida não renderiza** — interface não mostra academia
2. **Gerador não escreve contexto integrado** — `weeklyIntegratedContextJson` vazio
3. **Treinador não vê função da academia** — parece anexo solto
4. **Sem sinais QA** — quadra × academia não são observadas juntas

---

## 🏗️ TRÊS BLOCOS DE IMPLEMENTAÇÃO

### BLOCO A — EXPRESSÃO DE PRODUTO
Renderizar sessão resistida como sessão **de verdade**.

**A1.** Componente `SessionResistanceBlock` + render de tabela exercícios
- Mostrar: exercício | séries | reps | intervalo | observações
- Quadra continua funcionando
- Mista renderiza blocos separados

**A2.** Topo de contexto integrado
- Ambiente | Foco físico | Relação semana | Transferência
- Ex: "Academia — Potência de MMII — Sustenta quadra — Transferência: salto/bloqueio"

### BLOCO B — PERIODIZAÇÃO REAL DO RESISTIDO
Garantir que academia *obedece* a semana.

**B1.** Gerador escreve `weeklyIntegratedContext` em cada ClassPlan
- `teamContext` → `buildWeeklyIntegratedContext()` → salva em DB
- DailyLessonPlan recebe `sessionEnvironment + sessionPrimaryComponent`
- SessionComponent criado com ResistanceTrainingPlan

**B2.** `weeklyPhysicalEmphasis` dirige escolha de template
- "forca_base" → Template A
- "potencia_atletica" → Template B
- "prevencao" → Template C
- Wording coerente, transferência explícita

### BLOCO C — INTELIGÊNCIA OBSERVACIONAL
Sinais QA que veem coerência/incoerência (SEM auto-recalibragem).

**C1.** Observables básicos
- Interferência: academia pesada em semana densa de salto
- Transferência: foco físico sem suporte técnico-tático
- Equilíbrio: pouca prevenção, excesso de empurrar

---

## ✅ SUCESSO = O QUE O TREINADOR PERCEBE

- ✓ Identifica rapidamente se sessão é quadra / academia / mista
- ✓ Entende função física da sessão na semana
- ✓ Entende transferência academia → voleibol
- ✓ Sessão resistida está clara e utilizável
- ✓ Academia não é anexo — participa da semana

---

## 🛑 LIMITES DUROS (ESTA FASE)

❌ NÃO fazer:
- %1RM, VBT, auto-regulação avançada
- Dashboards de tonelagem
- Recommendation que reprograma academia sozinha
- Biblioteca infinita de exercícios (A-E controlados)
- Multimodalidade geral

❌ NÃO virar:
- App de musculação
- App de S&C separado
- Camada paralela à periodização

✅ TUDO subordinado ao microciclo do esporte.

---

## 🎬 IMPLEMENTAÇÃO: SLICES

### SLICE A1: UI Academia Básica
**Arquivos:** `SessionResistanceBlock.tsx` (NOVO) | `session.tsx` (refator)

**Fazer:**
- [ ] Criar componente isolado antes de tocar na tela principal
- [ ] Criar adapter para extrair `SessionComponentAcademiaResistido`
- [ ] Renderizar tabela exercícios quando `sessionEnvironment === "academia"`
- [ ] Exibir: exercício | séries | reps | intervalo | observações
- [ ] Quadra continua funcionando (zero regressão)
- [ ] Testes: 3+ variações de planos

**Risco:** Quebra de render se dados ausentes
**Mitiga:** Defaults obrigatórios, validação prévia, adapter antes de mexer em `session.tsx`

---

### SLICE A2: Contexto no Topo
**Arquivos:** `SessionContextHeader.tsx` (NOVO) | `SessionMixedStructure.tsx` (NOVO)

**Fazer:**
- [ ] Topo mostra: Ambiente | Foco físico | Relação | Transferência
- [ ] Sessão mista renderiza blocos separados + ponte
- [ ] Wording claro e breve
- [ ] Testes: 5+ combinações (modelo × énfase)

**Risco:** Overengineering na renderização
**Mitiga:** Extrair lógica em componentes isolados primeiro

---

### SLICE B1: Gerador Escreve Contexto
**Arquivos:** `build-auto-week-plan.ts` | `build-auto-plan-for-cycle-day.ts` | `sqlite.ts`

**Fazer:**
- [ ] Confirmar o que já foi implementado antes de adicionar nova lógica
- [ ] `resolveTeamTrainingContext()` chamado no gerador
- [ ] `buildWeeklyIntegratedContext()` produz JSON salvo em DB
- [ ] DailyLessonPlan tem `sessionEnvironment` correto
- [ ] SessionComponent criado com plano resistido
- [ ] Testes: 10+ turmas reais, zero regressão em quadra

**Risco:** Motor quebra planos antigos
**Mitiga:** Defaults em carregamento, teste com dados reais, rollback pré-testado

---

### SLICE B2: Énfase Física Dirige Template
**Arquivos:** `resistance-templates.ts` | `build-auto-plan-for-cycle-day.ts`

**Fazer:**
- [ ] `resolveResistanceTemplate(goal, profile, weeklyPhysicalEmphasis)` mais específico
- [ ] Énfase influencia template + transferência
- [ ] Wording coerente (não genérico)
- [ ] QA manual: 3-5 planos antes de deploy

**Risco:** Template ruim → plano ruim → abandono
**Mitiga:** QA rigoroso, permite override coach se necessário

---

### SLICE C1: Sinais QA (Observacional)
**Arquivos:** `gym-court-observables.ts` (NOVO) | QA UI (NOVO)

**Fazer:**
- [ ] Detectar interferência (academia pesada + quadra densa)
- [ ] Detectar falta de transferência (foco físico sem suporte técnico)
- [ ] Detectar desbalanceamento (pouca prevenção, excesso empurrar)
- [ ] Expor em QA internal (zero impacto no plano gerado)
- [ ] Wording educacional, não alarmista

**Risco:** Recomendação quebra se dados ausentes
**Mitiga:** Fallback gracioso, testes unitários completos

---

## 📊 ORDEM DE EXECUÇÃO RECOMENDADA

```
Semana 1: SLICE A1 + A2 (UI da sessão resistida)
Semana 2: SLICE B1 (Gerador escreve contexto) + testes
Semana 3: SLICE B2 (Énfase dirige template) + QA manual
Semana 4: SLICE C1 (Sinais QA) + validação com treinador
```

---

## 🎯 PRIORIZAÇÃO

**RENDER + GERADOR PRIMEIRO** (crítico para produto)
1. Sessão renderiza bem
2. Semana periodiza o resistido
3. Treinador entende função da academia

**QA DEPOIS** (suporte)
4. Observação de interferência/transferência

Não tentar resolver tudo de uma vez.

---

## 🔍 ARQUIVOS CRÍTICOS

🔴 **RISCO MÁXIMO (quebra fácil):**
- `app/class/[id]/session.tsx` — monolítico, muita lógica
- `src/core/session-generator/build-auto-week-plan.ts`

🟡 **RISCO MÉDIO:**
- `src/core/models.ts` — mudanças afetam tudo
- `src/db/sqlite.ts` — schema

🟢 **RISCO BAIXO:**
- `src/screens/session/components/` — novo, isolado
- `src/core/resistance/` — já testado

---

## ✋ PERGUNTA-GUIA CONSTANTE

**"Isso faz a academia participar da lógica da semana ou só existir dentro do sistema?"**

Se a resposta for "só existir", ainda está errado.

---

## 📋 CRITÉRIO DE ACEITE GLOBAL (FIM)

Quando tudo estiver pronto, o treinador deve poder:

1. ✅ Abrir turma com academia integrada
2. ✅ Ver semana com sessões claras (quadra/academia/mista)
3. ✅ Clicar em academia e ver tabela de exercícios
4. ✅ Ler topo: ambiente, foco físico, transferência
5. ✅ Entender que academia participa da semana
6. ✅ Ver sinais QA (sem auto-recalibragem)
7. ✅ Render quadra intacta (zero regressão)
8. ✅ Nenhuma auto-intervenção no plano
9. ✅ Sessões antigas ou parciais abrem sem quebrar

---

## 🚀 PRÓXIMA AÇÃO

1. Propor ordem exata de implementação em slices
2. Identificar arquivos-alvo prováveis
3. Definir critério de aceite por slice
4. Destacar riscos de regressão
5. Priorizar impacto em produto

---

**Versão:** Condensada v2.0 (1200 palavras)  
**Data:** 23/04/2026  
**Status:** Pronto para copiar e colar em novo chat
