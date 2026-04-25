# GoAtleta Resistance Training Integration — README

**Complete package to evolve GoAtleta's court + gym integration from architecture to product.**

---

## 📦 O QUE VOCÊ RECEBEU

4 documentos + este README:

| Documento | Tamanho | Uso |
|-----------|---------|-----|
| **Prompt Completo** | 3500 palavras | Novo chat, contexto abundante |
| **CONDENSED.md** | 1200 palavras | Chat apertado, foco rápido |
| **SLICE_CHECKLIST.md** | 2000 palavras | Acompanhamento + aceite |
| **RUNBOOK.md** | 1500 palavras | Step-by-step durante code |
| **STATUS.md** | ~1000 palavras | Consolidado do que já entrou |
| **Este arquivo** | — | Entrada rápida |

---

## 🎯 QUAL DOCUMENTO USAR?

### Cenário 1: "Vou começar um novo chat para implementar isso"

→ **Cole o Prompt Completo** (versão v2.0 final)

**Por quê:** Tem todos os detalhes, contexto, limites, princípios. Dev novo entende tudo.

**Onde:** Colado diretamente em novo chat ou salvo em arquivo.

**Tempo de leitura:** 15-20 min

---

### Cenário 2: "Já estou implementando, mas o chat perdeu contexto"

→ **Cole o CONDENSED.md**

**Por quê:** Resumo executivo (1200 palavras vs 3500). Rápido de ler, mesmos princípios.

**Onde:** `docs/RESISTANCE_TRAINING_INTEGRATION_CONDENSED.md`

**Tempo de leitura:** 5-7 min

---

### Cenário 3: "Estou no meio de uma slice, preciso validar aceite"

→ **Use SLICE_CHECKLIST.md**

**Por quê:** Tem deliverables, testes, acceptance criteria por slice.

**Onde:** `docs/SLICE_CHECKLIST.md` — procure pela slice (A1, A2, B1, B2, C1)

**Tempo de consulta:** 2-3 min

---

### Cenário 4: "Vou começar a codar agora. Preciso de guia passo-a-passo"

→ **Use RUNBOOK.md**

**Por quê:** Snippets, comandos, "Passo 1, 2, 3, 4" para cada slice.

**Onde:** `docs/RESISTANCE_TRAINING_RUNBOOK.md`

**Tempo de codificação:** segue o runbook

---

### Cenário 5: "Quero saber o que já foi implementado e o que ainda está fora do escopo"

→ **Use STATUS.md**

**Por quê:** Resume a fase já entregue, os guards atuais, os sinais QA e os próximos passos opcionais sem reabrir backlog.

**Onde:** `docs/RESISTANCE_TRAINING_STATUS.md`

**Tempo de leitura:** 3-5 min

---

## 🚀 QUICK START

### Se é primeira vez:

```
1. Leia este README (2 min)
2. Leia CONDENSED.md (7 min)
3. Abra SLICE_CHECKLIST.md como referência
4. Comece com SLICE A1 usando RUNBOOK.md
```

**Tempo total até código:** 15 min

### Se já sabe o contexto:

```
1. Abre RUNBOOK.md na slice que você está
2. Segue Passo 1, 2, 3, 4
3. Usa SLICE_CHECKLIST.md para validar aceite
4. Próxima slice
```

### Se a frente já foi implementada e você só precisa se situar:

```
1. Leia STATUS.md
2. Confirme se a dúvida é sobre implementado, guard ou QA
3. Só depois reabra RUNBOOK/CHECKLIST se houver nova fase real
```

---

## 🎯 PRINCÍPIOS CENTRAIS (não esqueça)

### A Periodização Manda
- Academia **não é paralela** a quadra
- Academia é **componente do microciclo**
- A semana periodizada governa o quê (e quando) academia faz

### Render Antes de QA
- Primeiro: sessão resistida renderizar bem ✅
- Segundo: gerador periodizar o resistido ✅
- Terceiro: treinador entender função ✅
- Quarto: sinais QA observarem coerência ✅

### Templates Controlados
- Apenas 5 templates base (A-E)
- Sem biblioteca infinita de exercícios
- Foco em **distribuição semanal** e **transferência**

### Sem Auto-Intervenção
- Recommendation **observa** (QA)
- Recommendation **nunca recalibra** a academia sozinha
- Treinador sempre decide

---

## 🔍 ESTRUTURA DOS SLICES

```
SLICE A1 ────→ UI Academia Renderiza
SLICE A2 ────→ Topo com Contexto

SLICE B1 ────→ Gerador Escreve Contexto
SLICE B2 ────→ Énfase Dirige Template

SLICE C1 ────→ Sinais QA (Observacional)
```

**Ordem:** A1 → A2 → B1 → B2 → C1

**Cada slice:** 1-3 dias

---

## 📊 CHECKLIST PRÉ-IMPLEMENTAÇÃO

Antes de começar:

- [ ] Base R1-R6 está passando em testes (`npm run jest src/core/resistance`)
- [ ] Campos reais em `src/core/models.ts` confirmados antes de codar UI
- [ ] Você entendeu que academia é **componente semanal**, não app paralelo
- [ ] Você leu CONDENSED.md (rápido summary)
- [ ] Você está pronto para pensar como treinador + dev + arquiteto
- [ ] Você tem ambiente React Native/Expo funcionando

---

## 🛑 REGRAS DE OURO

**Se estiver pensando em fazer algo...**

✅ **SIM:**
- Renderizar tabela de exercícios clara
- Fazer gerador periodizar academia
- Trazer dados de contexto integrado pra UI
- Observar coerência quadra × academia
- Permitir que treinador override o plano

❌ **NÃO:**
- Abrir biblioteca de 100+ exercícios
- Deixar coach "montar ficha" manualmente
- Auto-recalibração automática de academia
- Apps paralelos ou "abas desconectadas"
- %1RM, VBT, prescrição avançada de S&C

**Pergunta guia:** "Isso faz academia participar da lógica da semana ou só existir no sistema?"

Para A1, pergunte também: "Estou só renderizando o que já existe no domínio ou estou inventando um shape novo no componente?"

---

## 📞 SE FICAR TRAVADO

### "Como começo SLICE A1?"
→ Abra `RUNBOOK.md`, seção "SLICE A1: SessionResistanceBlock", Passo 1

### "Qual é o critério de aceite?"
→ Vá em `SLICE_CHECKLIST.md`, procure a slice, veja "Acceptance Criteria"

### "O que é weeklyIntegratedContext?"
→ Leia CONDENSED.md, seção "O QUE JÁ EXISTE" e "BLOCO B"

### "Posso mexer direto em session.tsx?"
→ Só depois de criar componente isolado + adapter. Esse arquivo é o maior ponto de regressão da frente.

### "Como testo isso?"
→ Em RUNBOOK.md tem comandos `npm run jest` para cada slice

### "Preciso de mais contexto?"
→ Cole o **Prompt Completo** em novo chat, explique aonde ficou travado

---

## 🚢 ANTES DE FAZER DEPLOY

**Validação pré-deploy:**

```bash
# 1. Testes
npm run jest src/core/resistance
npm run jest src/core/session-generator
npm run jest src/screens/session/components

# 2. Lint
npm run lint

# 3. Manual QA (super importante nesta fase)
- Abra turma quadra: SEM MUDANÇAS ✅
- Abra turma academia: tabela clara ✅
- Abra turma mista: blocos separados + ponte ✅
- Gere semana: context salvo em DB ✅
- Topo renderiza: ambiente + foco + transferência ✅

# 4. Regressão
- Planos antigos carregam sem erro ✅
- UI quadra continua funcionando ✅
```

**Se algum falhar, VOLTA slice anterior.**

---

## 📚 REFERÊNCIA RÁPIDA

### Funções principais (sempre chamadas):

```typescript
resolveTeamTrainingContext(classGroup)
  → { hasGymAccess, integratedTrainingModel, resistanceTrainingProfile }

buildWeeklyIntegratedContext({ teamContext, weeklySessions, emphasis })
  → { weeklyPhysicalEmphasis, courtGymRelationship, gymSessionsCount, ... }

resolveSessionEnvironment({ teamContext, weeklySessions, sessionIndex })
  → "quadra" | "academia" | "mista" | "preventiva"

resolveResistanceTemplate(goal, profile, emphasis)
  → ResistanceTrainingPlan (A-E template)
```

### Dados salvos no DB:

```typescript
ClassPlan.weeklyIntegratedContextJson        // Contexto semanal
DailyLessonPlan.sessionEnvironment            // Onde a sessão acontece
DailyLessonPlan.sessionComponents             // Blocos de sessão
```

---

## 🎓 APRENDIZADOS IMPORTANTES

1. **Academia é lógica, não app** — ela serve a semana, não vive sozinha
2. **Render é primeiro** — QA observa depois, não impõe antes
3. **Templates controlados** — 5 opções bem pensadas melhor que 50 mal feitas
4. **Treinador sempre decide** — recommendation sugere, não força
5. **Tudo é quadra-first** — nada quebra o existente

---

## ✅ RESULTADO FINAL ESPERADO

Quando tudo estiver pronto:

- ✅ Treinador abre semana com academia
- ✅ Vê sessões claras: quadra | academia | mista
- ✅ Clica em academia, vê tabela de exercícios
- ✅ Lê topo: "Academia — Potência — Sustenta quadra — Salto/bloqueio"
- ✅ Entende que academia NÃO é anexo
- ✅ Sistema mostra sinais se houver interferência (observacional)
- ✅ Quadra continua funcionando igual
- ✅ Nada foi auto-recalibrado sem decisão humana

---

## 🚦 STATUS

- ✅ **Arquitetura validada** (R1-R6 passando)
- ✅ **Prompt final pronto** (3 ajustes embutidos)
- ✅ **Slices planejados** (5 slices claros)
- ✅ **Runbook pronto** (step-by-step)
- ✅ **Checklists pronto** (aceite por slice)

**Próximo passo:** Começar SLICE A1 usando RUNBOOK.md

---

## 📝 VERSÕES

| Versão | Data | Mudanças |
|--------|------|----------|
| v2.0 | 23/04/2026 | 3 ajustes finais embutidos |
| v1.0 | 23/04/2026 | Base pronta |

---

**Criado:** 23/04/2026  
**Pronto para:** Implementação imediata  
**Requer:** React Native/Expo dev com conhecimento de voleibol pedagógico
