# AI Features Smoke Test Checklists

Checklists detalhados para validação de cada PR do roadmap de IA.

---

## PR1: Executive Summary — Checklist D1 (Diagnostic)

### Setup

- [ ] Org tem pelo menos 3 turmas ativas
- [ ] Existem chamadas pendentes (2+)
- [ ] Existem relatórios pendentes (1+)
- [ ] Sync queue tem items (5+ pending writes)

### Testes Funcionais

**1. Geração Inicial**
- [ ] Abrir Coordination dashboard
- [ ] Ver snapshot de métricas (números corretos?)
- [ ] Clicar botão "Gerar resumo executivo"
- [ ] Ver skeleton loading (~2-5s)
- [ ] Resumo aparece com:
  - [ ] Headline relevante
  - [ ] 3-5 highlights
  - [ ] 2-3 risks
  - [ ] 3-5 recommended actions
- [ ] Números mencionados batem com dashboard?
- [ ] Não há menção a turmas/alunos inventados?

**2. Cache**
- [ ] Fechar e reabrir Coordination
- [ ] Resumo aparece instantaneamente (cache hit)
- [ ] Badge mostra tempo desde geração ("há 1min")
- [ ] Clicar "Gerar novamente" → novo resumo vem diferente

**3. Export**
- [ ] Clicar "Copiar" → texto vai para clipboard
- [ ] Colar no WhatsApp → formatação ok?
- [ ] Clicar "Exportar Markdown" → arquivo baixa
- [ ] Abrir .md → estrutura legível (# headings, bullets)
- [ ] Clicar "Exportar JSON" → arquivo baixa
- [ ] Abrir .json → estrutura válida (`{ headline, highlights[], ... }`)

**4. Offline**
- [ ] Desconectar rede (airplane mode)
- [ ] Fechar e reabrir app
- [ ] Abrir Coordination → resumo aparece (último cache)
- [ ] Badge mostra "(offline, há Xmin)"
- [ ] Botão "Gerar novamente" está disabled com tooltip

**5. Org Switch**
- [ ] Trocar para outra org (sem resumo gerado ainda)
- [ ] Gerar resumo → dados corretos da nova org
- [ ] Voltar para org original → resumo anterior aparece (cache isolado)

### Aceite

✅ Gera resumo com dados reais
✅ Cache evita chamadas repetidas
✅ Offline mostra último resumo
✅ Export funciona (Markdown + JSON)
✅ Org switch não mistura dados

### Evidências Obrigatórias

1. Screenshot do resumo gerado
2. Conteúdo copiado (texto no WhatsApp)
3. Arquivo .md exportado (anexar)
4. Cachepreview (reabrir app, resumo instantâneo)

---

## PR2: Message Composer — Checklist de Comunicação

### Setup

- [ ] Org tem 2+ membros (1 professor, 1 estagiário)
- [ ] Professor tem turmas responsáveis (2+)
- [ ] Estagiário tem 0 turmas

### Testes Funcionais

**1. Geração de Mensagem (Friendly)**
- [ ] Abrir painel de membros
- [ ] Selecionar professor com turmas
- [ ] Abrir detalhe do membro
- [ ] Selecionar tom "Amigável"
- [ ] Clicar "Gerar mensagem"
- [ ] Ver skeleton loading
- [ ] Preview aparece com:
  - [ ] Subject (para email)
  - [ ] Mensagem WhatsApp (informal, sem saudação corporativa)
  - [ ] Mensagem Email (mais formal que WhatsApp)
- [ ] Contexto correto? (turmas responsáveis mencionadas)
- [ ] Não inventa números ou datas?

**2. Tom Diferente (Firm)**
- [ ] Sem fechar detalhe, selecionar tom "Firme"
- [ ] Clicar "Regenerar"
- [ ] Nova mensagem vem diferente?
- [ ] Tom é mais assertivo/direto?
- [ ] Histórico mostra 2 mensagens (friendly + firm)

**3. Tom Formal e Urgente**
- [ ] Gerar com tom "Formal" → linguagem corporativa?
- [ ] Gerar com tom "Urgente" → call-to-action claro?
- [ ] Histórico mostra 4 mensagens (ou apenas últimas 3)

**4. Ações de Cópia**
- [ ] Clicar "Copiar WhatsApp" → clipboard tem texto
- [ ] Abrir WhatsApp Web → colar mensagem (evidência)
- [ ] Voltar ao app → clicar "Copiar Email"
- [ ] Abrir Gmail → colar (subject + body separados?)

**5. Deep Link WhatsApp**
- [ ] Clicar "Abrir WhatsApp"
- [ ] WhatsApp abre (mobile) ou web (desktop)
- [ ] Número do professor está preenchido
- [ ] Mensagem está pré-preenchida no campo de texto
- [ ] (Opcional) Enviar mensagem de teste

**6. Histórico Persistente**
- [ ] Fechar e reabrir painel de membros
- [ ] Abrir mesmo professor
- [ ] Histórico mostra últimas 3 mensagens
- [ ] Datas/timestamps corretos

**7. Contexto Diferente (Estagiário sem turmas)**
- [ ] Abrir estagiário
- [ ] Gerar mensagem (tom friendly)
- [ ] Mensagem menciona que não há turmas responsáveis?
- [ ] Ou foca em outro contexto (onboarding, tarefas gerais)?

### Aceite

✅ Nunca inventa dados (turmas, datas)
✅ Preview sempre antes de enviar
✅ Clipboard funciona (WhatsApp + Email)
✅ Deep link WhatsApp abre com texto pré-preenchido
✅ Histórico armazena últimas 3 mensagens
✅ Tons diferentes geram estilos diferentes

### Evidências Obrigatórias

1. Screenshot de preview (friendly)
2. Screenshot de preview (firm) — lado a lado com friendly
3. Screenshot do histórico (3 mensagens)
4. Screenshot do WhatsApp com texto colado
5. Video/GIF do deep link abrindo WhatsApp (opcional mas recomendado)

---

## PR3: Sync Error Explainer — Checklist B2/B3/B4 (Broken)

### Setup

- [ ] Forçar erro de sync (2 métodos):
  1. **Erro de rede**: desconectar durante write
  2. **Erro de validação**: editar payload no dev tools para quebrar schema

### Testes Funcionais

**1. Erro de Rede**
- [ ] Desconectar rede
- [ ] Criar nova sessão (ou editar presença)
- [ ] Tentar salvar → erro
- [ ] Reconectar rede
- [ ] Abrir Coordination → Seção "Saúde da Sincronização"
- [ ] Ver item na lista de falhas
- [ ] Clicar "Explicar erro"
- [ ] Modal carrega (~2-3s)
- [ ] Classificação aparece:
  - [ ] **Causa provável**: "Falha de rede temporária"
  - [ ] **Severidade**: "baixa" ou "média"
  - [ ] **Ação recomendada**: "Reprocessar item"
  - [ ] **Possível bug?**: não (com reasoning)

**2. Erro de Validação**
- [ ] Via dev tools ou script: quebrar payload de um pending write
  - Ex: mudar `class_id` para UUID inválido
- [ ] Forçar reprocess → falha
- [ ] Abrir Coordination → ver falha
- [ ] Clicar "Explicar erro"
- [ ] Classificação:
  - [ ] **Causa provável**: "Dados inconsistentes" ou "Validação falhou"
  - [ ] **Severidade**: "alta"
  - [ ] **Ação recomendada**: "Revisar payload" ou "Contatar suporte"
  - [ ] **Possível bug?**: sim (com reasoning: "payload não deveria ter UUID inválido")

**3. Relatório Técnico**
- [ ] No modal de explicação, clicar "Copiar relatório técnico"
- [ ] Abrir editor de texto → colar
- [ ] Verificar estrutura:
  ```
  === RELATÓRIO TÉCNICO DE ERRO DE SYNC ===
  Organização: [nome]
  Timestamp: [ISO]

  CLASSIFICAÇÃO
  - Causa provável: ...
  - Severidade: ...
  - Ação recomendada: ...
  - Possível bug da aplicação: ...

  CONTEXTO
  - Kind: ...
  - LastError: ...
  - Payload (sanitizado): { ... }
  ```
- [ ] Nenhum dado sensível exposto? (emails, phones, etc.)

**4. Sanitização de Payload**
- [ ] Inserir pending write com dados sensíveis (email, phone)
- [ ] Explicar erro → copiar relatório
- [ ] Verificar payload sanitizado (emails mascarados: `u***@example.com`)

**5. Múltiplos Erros**
- [ ] Criar 3 erros diferentes (rede, validação, timeout)
- [ ] Explicar cada um → classificações diferentes?
- [ ] Batch: explicar todos de uma vez (se implementado)

### Aceite

✅ Não sugere apagar dados
✅ Não vaza info sensível
✅ Ajuda suporte sem Sentry
✅ Classificação precisa
✅ Identifica bugs vs. erros transientes

### Evidências Obrigatórias

1. Screenshot da lista de falhas
2. Screenshot da classificação (erro de rede)
3. Screenshot da classificação (erro de validação)
4. Relatório técnico copiado (texto completo)
5. Evidência de sanitização (payload com email mascarado)

---

## PR4: Audit Log — Checklist Manual

### Setup

- [ ] Org ativa
- [ ] Usuário é coordenador (role_level >= 50)
- [ ] Sync queue tem items pendentes

### Testes Funcionais

**1. Log de Ações de Sync**
- [ ] Abrir Coordination → Seção "Saúde da Sincronização"
- [ ] Clicar "Reprocessar item" → confirmar
- [ ] Clicar "Reprocessar rede" → confirmar
- [ ] Clicar "Limpar dead-letter" → confirmar
- [ ] Abrir aba "Auditoria"
- [ ] Ver 3 logs:
  - [ ] Ação: "reprocess_pending_write"
  - [ ] Ação: "reprocess_network_failures"
  - [ ] Ação: "clear_dead_letter_candidates"
- [ ] Cada log mostra:
  - [ ] Timestamp (preciso, não "há X minutos" genérico)
  - [ ] Usuário (nome + email ou ID)
  - [ ] Metadata (ex: "itemId: 123" ou "count: 5")

**2. Log de Ações de IA**
- [ ] Gerar resumo executivo
- [ ] Gerar mensagem para professor (tom friendly)
- [ ] Abrir "Auditoria" → ver 2 novos logs:
  - [ ] Ação: "ai_generate_executive_summary"
  - [ ] Ação: "ai_generate_trainer_message"
  - [ ] Metadata: `{ cadence: "daily" }` ou `{ tone: "friendly", memberId: "..." }`

**3. Log de Ações Admin**
- [ ] Remover membro (se implementado)
- [ ] Alterar role de membro
- [ ] Alterar permissão de membro
- [ ] Ver logs correspondentes na auditoria

**4. Filtros**
- [ ] Filtrar por usuário (dropdown ou search) → ver apenas ações desse usuário
- [ ] Filtrar por ação (dropdown: "Todas", "Sync", "IA", "Admin")
- [ ] Filtrar por período:
  - [ ] Últimos 7 dias (default)
  - [ ] Últimos 30 dias
  - [ ] Últimos 90 dias
  - [ ] Custom range (se implementado)

**5. Export**
- [ ] Clicar "Exportar CSV"
- [ ] Arquivo baixa: `audit-log-[org]-[date].csv`
- [ ] Abrir no Excel/Sheets → colunas corretas:
  - `timestamp, user_id, user_name, action, metadata`
- [ ] Clicar "Exportar JSON"
- [ ] Arquivo baixa: `audit-log-[org]-[date].json`
- [ ] Abrir no editor → estrutura válida (array de objetos)

**6. Org Isolation**
- [ ] Executar 2 ações na org A
- [ ] Trocar para org B
- [ ] Executar 1 ação na org B
- [ ] Ver auditoria org A → apenas 2 logs
- [ ] Ver auditoria org B → apenas 1 log
- [ ] Não há vazamento entre orgs

**7. Performance**
- [ ] Gerar 50+ logs (script ou manual)
- [ ] Abrir auditoria → carrega rápido (<1s)?
- [ ] Scroll suave (virtualização se lista grande)

### Aceite

✅ Cada ação crítica grava evento
✅ Log org-scoped
✅ Export CSV/JSON funciona
✅ Performance ok (índices corretos)
✅ Offline: log local, sync depois

### Evidências Obrigatórias

1. Screenshot da lista de logs (3+ ações)
2. Screenshot de filtro aplicado (por ação ou usuário)
3. Arquivo CSV exportado (anexar)
4. Arquivo JSON exportado (anexar)
5. Screenshot de org switch (logs isolados)

---

## PR5: Fine-Grained Permissions — Checklist A3 (Access)

### Setup

- [ ] Org tem 3 usuários:
  1. Coordenador (role_level 50)
  2. Professor (role_level 10)
  3. Estagiário (role_level 5)
- [ ] Permissões configuradas:
  - Coordenador: todas
  - Professor: nenhuma ação de sync/health
  - Estagiário: nenhuma ação enterprise

### Testes Funcionais

**1. Coordenador (Full Access)**
- [ ] Login como coordenador
- [ ] Abrir Coordination
- [ ] Todos botões de sync habilitados:
  - [ ] "Reprocessar item"
  - [ ] "Reprocessar rede"
  - [ ] "Limpar dead-letter"
  - [ ] "Exportar relatório de saúde"
- [ ] Todos botões de IA habilitados:
  - [ ] "Gerar resumo executivo"
  - [ ] "Gerar mensagem" (no painel de membros)
- [ ] Aba "Auditoria" visível e acessível

**2. Professor (Limited Access)**
- [ ] Login como professor
- [ ] Abrir Coordination (se acessível)
- [ ] Botões de sync desabilitados (disabled):
  - [ ] "Reprocessar item" — hover mostra tooltip: "Sem permissão: can_reprocess_sync"
  - [ ] "Limpar dead-letter" — tooltip: "Sem permissão: can_clear_dead_letter"
- [ ] Botões de IA (depende da config):
  - [ ] Se AI habilitado para professores: "Gerar mensagem" funciona
  - [ ] Se AI restrito: "Gerar mensagem" disabled com tooltip
- [ ] Aba "Auditoria" oculta ou disabled

**3. Estagiário (Minimal Access)**
- [ ] Login como estagiário
- [ ] Abrir Coordination → redireciona para "/" (sem acesso)
  - Ou mostra mensagem: "Você não tem permissão para acessar Coordination"
- [ ] Não consegue acessar painel de membros
- [ ] Não consegue acessar auditoria

**4. UI de Permissões**
- [ ] Login como coordenador
- [ ] Abrir painel de um professor
- [ ] Seção "Permissões" mostra checkboxes:
  - [ ] `can_reprocess_sync` (unchecked)
  - [ ] `can_generate_ai_message` (checked ou unchecked)
- [ ] Marcar `can_reprocess_sync` → salvar
- [ ] Logout → login como esse professor
- [ ] Botão "Reprocessar item" agora habilitado

**5. Backend Enforcement (se implementado)**
- [ ] Login como professor
- [ ] Via dev tools ou Postman: tentar chamar RPC de reprocess
- [ ] Receber erro 403: "Forbidden: missing permission can_reprocess_sync"
- [ ] (Se não houver backend enforcement, pular este teste)

**6. Tooltips Claros**
- [ ] Hover em cada botão disabled
- [ ] Tooltip mostra:
  - "Sem permissão: [permission_key]"
  - Ou mensagem humanizada: "Apenas coordenadores podem reprocessar a fila de sync"

### Aceite

✅ Usuário sem permissão não executa ação
✅ UI clara: botão disabled + tooltip
✅ Backend valida (se implementado)
✅ Defaults sensatos (coordenador tem tudo)

### Evidências Obrigatórias

1. Screenshot de coordenador (todos botões habilitados)
2. Screenshot de professor (botões disabled + tooltip)
3. Screenshot de estagiário (sem acesso a Coordination)
4. Video/GIF de hover nos tooltips (opcional mas útil)
5. Screenshot de painel de permissões (checkboxes)

---

## PR6: Consistency Scanner + Auto-Fix — Checklist E2/E3 (Enterprise)

### Setup

- [ ] Org com dados inconsistentes (forçar manualmente):
  1. **Sessão duplicada**: criar 2 sessões no mesmo `class_id` e `date`
  2. **Sessão sem relatório**: criar sessão com presenças mas `reportText = null`
  3. **Presença órfã**: criar presença com `session_id` que não existe
  4. **Gap de SLA**: turma sem relatório há 10+ dias

### Testes Funcionais

**1. Detecção de Inconsistências**
- [ ] Abrir Coordination → Seção "Consistência de Dados"
- [ ] Badge mostra: "4 inconsistências detectadas"
- [ ] Lista mostra 4 issues:
  - [ ] **Critical**: Sessão duplicada
  - [ ] **High**: Presença órfã
  - [ ] **Medium**: Sessão sem relatório
  - [ ] **Low**: Gap de SLA

**2. Detalhes de Issue (Sessão Duplicada)**
- [ ] Clicar na issue "Sessão duplicada"
- [ ] Ver detalhes:
  - [ ] Descrição: "Existem 2 sessões para a turma [Nome] no dia [Data]"
  - [ ] Entidades afetadas:
    - [ ] Link para abrir turma
    - [ ] Link para abrir sessão 1
    - [ ] Link para abrir sessão 2
- [ ] Clicar "Sugerir correção" → aguardar IA (~3-5s)
- [ ] Sugestão aparece:
  - [ ] **Explicação**: "Sessões duplicadas causam confusão e inconsistências em relatórios..."
  - [ ] **Ação sugerida**: "Manter sessão mais recente, mover presenças da antiga, deletar antiga"
  - [ ] **Impacto**: "5 presenças serão movidas, 1 sessão será deletada"
  - [ ] **Confirmação obrigatória**: sim

**3. Aplicar Correção (com Confirmação)**
- [ ] Clicar "Aplicar correção"
- [ ] Modal de confirmação aparece:
  ```
  Você está prestes a: Mover 5 presenças e deletar 1 sessão duplicada.

  Impacto:
  - Sessão de 2025-01-15 será deletada
  - Presenças serão consolidadas na sessão de 2025-01-16

  Esta ação será registrada no audit log.

  [Cancelar] [Confirmar]
  ```
- [ ] Clicar "Confirmar"
- [ ] Ver skeleton loading (~2-3s)
- [ ] Issue desaparece da lista
- [ ] Toast: "Correção aplicada com sucesso"

**4. Verificar Correção Efetiva**
- [ ] Abrir turma → ver apenas 1 sessão na data
- [ ] Abrir sessão → ver 5 presenças consolidadas
- [ ] Abrir Auditoria → ver log:
  - [ ] Ação: "consistency_fix_applied"
  - [ ] Metadata: `{ issueType: "duplicate_session", ... }`

**5. Issue Sem Correção Automática (Gap de SLA)**
- [ ] Abrir issue "Gap de SLA"
- [ ] Clicar "Sugerir correção"
- [ ] Sugestão:
  - [ ] **Ação sugerida**: "Enviar lembrete ao professor responsável"
  - [ ] **Impacto**: "Nenhum dado será alterado"
  - [ ] Botão: "Enviar lembrete" (chama action de IA de mensagem)
- [ ] Clicar "Enviar lembrete" → gera mensagem automática ao professor

**6. Incident Mode**
- [ ] Forçar threshold: criar 15 issues (10 critical + 5 high)
- [ ] Reabrir Coordination
- [ ] Banner vermelho no topo:
  ```
  ⚠️ MODO INCIDENTE ATIVADO
  15 inconsistências críticas detectadas.
  [Gerar Relatório de Incidente] [Resolver Todas]
  ```
- [ ] Clicar "Gerar Relatório de Incidente"
- [ ] Modal carrega (~5-10s)
- [ ] Relatório aparece:
  - [ ] Executive summary do incidente
  - [ ] Lista de issues por severidade
  - [ ] Plano de ação sugerido (priorizado)
- [ ] Clicar "Exportar" → baixa `incident-report-[date].md`

**7. Resolver Todas (Batch)**
- [ ] Clicar "Resolver Todas" (no banner de incidente)
- [ ] Modal lista todas as 15 correções
- [ ] Checkboxes para selecionar quais aplicar
- [ ] Clicar "Aplicar selecionadas" (com confirmação final)
- [ ] Progress bar mostra 1/15, 2/15, ...
- [ ] Ao fim: toast "15 correções aplicadas"
- [ ] Badge atualiza: "0 inconsistências"

**8. Permissões (Integration com PR5)**
- [ ] Login como professor (sem `can_apply_consistency_fix`)
- [ ] Abrir Consistency Scanner
- [ ] Ver issues listadas
- [ ] Botão "Aplicar correção" disabled com tooltip:
  - "Sem permissão: can_apply_consistency_fix"

**9. Org Switch**
- [ ] Criar issue na org A
- [ ] Trocar para org B (sem issues)
- [ ] Org B mostra: "0 inconsistências"
- [ ] Voltar para org A → issue ainda aparece

**10. Performance**
- [ ] Org com 1000+ registros (sessões, presenças)
- [ ] Executar scan completo
- [ ] Scanner termina em <5s
- [ ] Lista renderiza suavemente (virtualização)

### Aceite

✅ Nunca aplica mudança sem confirmação
✅ Cada fix gera audit log
✅ Org switch não mistura dados
✅ Scanner rápido (<5s)
✅ IA não sugere deletar dados (apenas mover/corrigir)
✅ Incident Mode ativa em thresholds

### Evidências Obrigatórias

1. Screenshot da lista de issues (4 issues)
2. Screenshot da sugestão de correção (IA)
3. Screenshot do modal de confirmação
4. Screenshot do audit log (fix aplicado)
5. Screenshot do banner de Incident Mode
6. Relatório de incidente exportado (.md anexado)
7. Video/GIF do "Resolver Todas" (batch, opcional)

---

## 🎯 Critérios Gerais para Passar Smoke Test

**Todos os PRs devem:**

1. ✅ Zero erros de TypeScript
2. ✅ Build web passa (npm run build)
3. ✅ App não crasha em nenhum fluxo testado
4. ✅ Org switch funciona (dados isolados)
5. ✅ Offline graceful (cache ou mensagem clara)
6. ✅ Performance ok (nenhum loader >10s)
7. ✅ UI responsiva (mobile + web)
8. ✅ Evidências coletadas (screenshots + arquivos)

**Extras (Nice to Have):**

- [ ] Animações suaves (skeleton, fade-in)
- [ ] Feedback imediato (toasts, loading states)
- [ ] Accessibility (aria-labels, keyboard nav)
- [ ] Dark mode ok (se app suporta)

---

## 🚨 Red Flags — Quando NÃO Passar

**Falhas Críticas (Blocker):**

- ❌ IA inventa dados (turmas, alunos, datas que não existem)
- ❌ Ação destrutiva sem confirmação
- ❌ Dados de org A aparecem na org B
- ❌ Crash ao trocar org
- ❌ Payload com info sensível (emails, phones) sem sanitização
- ❌ Permissões não são respeitadas (professor consegue executar ação de admin)

**Falhas Menores (Fix Before Merge):**

- ⚠️ Loading eterno (>30s sem timeout)
- ⚠️ Clipboard não copia
- ⚠️ Export gera arquivo vazio
- ⚠️ UI quebrada em mobile (overlaps, scroll infinito)
- ⚠️ Toast não aparece após ação
- ⚠️ Histórico não persiste após reabrir app

---

## 📊 Template de Evidência (para PR)

```markdown
## Smoke Test — PR[X]: [Nome]

### Executado em
- Data: YYYY-MM-DD
- Plataforma: Web / iOS / Android
- Build: [hash do commit]

### Checklist
- [x] Teste 1
- [x] Teste 2
- [ ] Teste 3 (falhou, ver issue #123)

### Evidências
1. Screenshot 1: [descrição]
   ![screenshot1](./evidence/pr1-screenshot1.png)
2. Arquivo exportado: [link para .md ou .json]
3. Video: [link para Loom ou YouTube se aplicável]

### Issues Encontrados
- [ ] Nenhum ✅
- [ ] Issue #123: [descrição breve]

### Aprovação
✅ Smoke test passou — pronto para merge
```

---

_Use estes checklists como guia. Adapte conforme necessário._
