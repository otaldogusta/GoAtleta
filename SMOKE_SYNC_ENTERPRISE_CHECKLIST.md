# Smoke Test Checklist — Sync Enterprise (P0/P1/P2)

Data: ____/____/______
Build/Canal: __________________________
Executor: _____________________________

## Build Metadata (obrigatório)
- Commit SHA / Tag: __________________________________________
- `runtimeVersion`: __________________________________________
- Canal: `preview` / `production` / outro: ____________________
- Plataforma: `android` / `ios` / `web`
- Device modelo: _____________________________________________
- OS versão: _________________________________________________
- Modo: `dev` / `release`
- Ambiente: `staging` / `prod` / outro: _______________________

## Critérios de aprovação
- [ ] Todos os cenários P0 aprovados
- [ ] Nenhum loop de sync em pausas `auth`/`permission`
- [ ] Nenhum dado “misturado” após troca de organização
- [ ] Replay por item e por rede funcionando
- [ ] Export JSON de health report funcionando
- [ ] `npm run release:check` ✅
- [ ] `npm run check:org-scope` ✅
- [ ] `get_errors` ✅ (sem erros)
- [ ] Zero crashes durante smoke
- [ ] Fila **não cresce indefinidamente** em 10 min de uso normal
- [ ] Export JSON anexado nas evidências

## Regra de evidência (obrigatória)
- Cada bloco **A/B/C/D** deve ter **pelo menos 1 evidência** anexada.
- Formato recomendado por evidência:
	- Screenshot (tela + horário)
	- Log recortado (breadcrumb/erro/flush)
	- JSON do Health Report (arquivo anexado)
	- `pendingWriteId` do item reprocessado

---

## A) Sync + Pause global (auth/permissão/org switch)

### A1 — Pausa por `auth`
**Pré-condição:** sessão expirada ou token inválido.
**Passos:**
1. Ficar offline.
2. Criar uma escrita pendente (ex.: salvar sessão/chamada).
3. Voltar online com sessão inválida.
4. Abrir Coordination > Saúde da Sincronização.

**Esperado:**
- [ ] Fila cresce (`pendingCount > 0`)
- [ ] `syncPausedReason = auth`
- [ ] CTA de retomada/reauth aparece
- [ ] Não há storm de tentativas (sem loop infinito)

**Evidência:** ______________________________________________

### A2 — Troca de organização com pending writes
**Pré-condição:** duas orgs disponíveis (A e B).
**Passos:**
1. Na org A, criar 2–3 writes offline.
2. Trocar para org B.
3. Navegar em telas de classes/coordination.
4. Retomar sync.

**Esperado:**
- [ ] `handleOrganizationSwitch()` pausa sync/timer
- [ ] caches locais são limpos
- [ ] não há dados misturados entre A/B
- [ ] `resumeSync()` retoma de forma controlada

**Evidência:** ______________________________________________

### A3 — Pausa por `permission`
**Pré-condição:** role sem permissão/RLS negando operação.
**Passos:**
1. Disparar write que resulte em erro de permissão.
2. Abrir Coordination.

**Esperado:**
- [ ] `syncPausedReason = permission`
- [ ] UI sugere ação (trocar org/conta, tentar novamente)
- [ ] sem retries agressivos em loop

**Evidência:** ______________________________________________

---

## E) Casos negativos obrigatórios

### E1 — `organizationId` vazio (fail-closed)
**Passos:**
1. Abrir app sem org selecionada (ou reset de org ativa).
2. Navegar para telas org-scoped (classes, reports, coordination).

**Esperado:**
- [ ] não mostra dados indevidos
- [ ] app orienta próximo passo (sem silêncio)
- [ ] há alerta dev/telemetria para missing org

**Evidência:** ______________________________________________

### E2 — Replay de item que vira `bad_request`
**Passos:**
1. Gerar item inválido para reprocesso.
2. Executar “Reprocessar item”.

**Esperado:**
- [ ] item não entra em martelo infinito
- [ ] item vai para estado permanente/dead-letter com mensagem clara

**Evidência:** ______________________________________________

### E3 — Troca de org durante sync ativo
**Passos:**
1. Disparar sync manual com fila pendente.
2. Trocar organização durante sync.

**Esperado:**
- [ ] sync pausa com `org_switch`
- [ ] sem mistura de dados
- [ ] retomada controlada após troca

**Evidência:** ______________________________________________

---

## B) Pending writes (ordenação por stream + replay)

### B1 — Ordem por stream em writes dependentes
**Passos:**
1. Gerar writes encadeados para mesma entidade (ex.: sessão -> presença -> log).
2. Fazer online após backlog.

**Esperado:**
- [ ] processamento respeita ordem por stream + tempo
- [ ] sem inconsistência funcional no resultado final

**Evidência:** ______________________________________________

### B2 — Replay por item
**Passos:**
1. Gerar falha de item (payload inválido controlado).
2. Em Falhas recentes, clicar “Reprocessar item”.

**Esperado:**
- [ ] retryCount/lastError resetam
- [ ] item tenta novamente
- [ ] se falhar de novo, volta para falhas recentes corretamente

**Evidência:** ______________________________________________

### B3 — Replay só de falhas de rede
**Passos:**
1. Gerar falhas `[network]...` e também outras categorias.
2. Clicar “Reprocessar falhas de rede”.

**Esperado:**
- [ ] só itens com erro de rede entram no replay
- [ ] itens de outras categorias permanecem

**Evidência:** ______________________________________________

### B4 — Copiar payload
**Passos:**
1. Em falha recente, clicar “Copiar payload”.
2. Colar em editor e validar JSON.

**Esperado:**
- [ ] payload corresponde ao item selecionado
- [ ] funciona com payload grande

**Evidência:** ______________________________________________

---

## C) Coordination (escala/virtualização)

### C1 — Lista com volume alto (200+)
**Passos:**
1. Popular pendências/falhas com alto volume.
2. Fazer scroll rápido e acionar CTAs em itens fora de viewport.

**Esperado:**
- [ ] sem travamentos críticos
- [ ] render estável
- [ ] CTAs funcionam com item virtualizado

**Evidência:** ______________________________________________

---

## D) Governance de release

### D1 — Checks locais
Rodar:
- `npm run check:org-scope`
- `npm run release:check`

**Esperado:**
- [ ] `check:org-scope` passa
- [ ] `release:check` passa (ou falhas documentadas fora do escopo)

**Evidência:** ______________________________________________

### D2 — Fluxo de canal
**Passos:**
1. Publicar preview.
2. Validar smoke.
3. Promote para production (ou publish production conforme necessidade).

**Esperado:**
- [ ] fluxo preview -> promote/production executável
- [ ] checklist de release preenchido

**Evidência:** ______________________________________________

---

## Resultado final
- [ ] APROVADO para produção
- [ ] REPROVADO (abrir correções)

## Go / No-Go (assinaturas)

| Campo | Valor |
|---|---|
| Responsável QA | __________________________ |
| Responsável Tech | ________________________ |
| Data/Hora decisão | ________________________ |
| Decisão (`Go`/`No-Go`) | __________________ |
| Motivo resumido | __________________________ |
| Link/ID das evidências | ___________________ |

Observações finais:
______________________________________________________________
______________________________________________________________
