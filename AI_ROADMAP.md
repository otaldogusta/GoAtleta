# Roadmap de IA Operacional + Compliance + Auto-fix

Plano de 6 PRs sequenciais para entregar valor incremental, reviewável e testável.

---

## 🎯 Princípios

- **Um objetivo por PR**: foco, baixo risco, alto valor
- **Sempre smoke test**: cada PR passa pelo checklist enterprise
- **Preview antes de merge**: EAS update channel preview
- **Audit trail**: ações críticas sempre logadas (a partir do PR4)
- **Zero invenção de dados**: IA só usa contexto real passado
- **Confirmação obrigatória**: nenhuma ação destrutiva sem consentimento

---

## PR 1 — Executive Summary (Daily/Weekly) + Cache Local

**Branch:** `feature/executive-summary`

### Objetivo
IA Ouro #3: Resumo executivo com custo baixo e alto valor para coordenadores.

### Escopo

**Backend/Serviços**
- [ ] `src/api/ai.ts` → `generateExecutiveSummary(payload, cadence)`
  - Input: métricas reais da org (pending attendance, reports, sync health)
  - Output: `{ headline, highlights[], risks[], recommendedActions[] }`
  - Cadence: "daily" | "weekly"
- [ ] Cache local: último resumo + timestamp por org
  - AsyncStorage ou SQLite: `ai_executive_summary_cache`
  - TTL: 6h (daily), 24h (weekly)

**UI**
- [ ] `app/coordination.tsx` → Card "Resumo IA"
  - Botão "Gerar agora" (skeleton loading)
  - Preview do resumo (headline + top 3 actions)
  - Botões: "Copiar", "Exportar Markdown", "Exportar JSON"
- [ ] Offline: mostra último resumo disponível + badge "(6h atrás)"

**Consolidação**
- [ ] `src/db/seed.ts` → `getOrgMetricsSnapshot(organizationId)`
  - Pending attendance count
  - Pending reports count
  - Recent activity (7d)
  - Sync health (pending writes, dead-letter, max retry)

### Aceite

✅ Gera resumo com dados reais da org  
✅ Cache evita chamadas repetidas (custo controlado)  
✅ Funciona offline mostrando último resumo  
✅ Export Markdown/JSON funciona  
✅ Não inventa números ou turmas  

### Smoke Test

**Checklist D1** (Diagnostic: Coordination health)
1. Abrir Coordination → ver snapshot real
2. Clicar "Gerar resumo" → aguardar resposta
3. Verificar headline + 3 ações fazem sentido
4. Copiar texto → colar no WhatsApp (evidência)
5. Exportar Markdown → verificar formato
6. Reabrir app sem rede → ver último resumo

---

## PR 2 — Copiloto de Comunicação (WhatsApp/Email) + Histórico

**Branch:** `feature/message-composer`

### Objetivo
IA Ouro #4: Geração contextual de mensagens para professores/estagiários com rastreabilidade leve.

### Escopo

**Backend/Serviços**
- [ ] `src/api/ai.ts` → `generateTrainerMessage(payload, tone)`
  - Input: contexto do membro (nome, role, turmas responsáveis, issues recentes)
  - Input: tom: "friendly" | "firm" | "formal" | "urgent"
  - Output: `{ subject, whatsapp, email, metadata }`
- [ ] Histórico local: últimas 3 mensagens por membro
  - AsyncStorage ou SQLite: `ai_message_history`
  - Schema: `{ memberId, tone, generatedAt, message }`

**UI**
- [ ] `src/screens/coordination/OrgMembersPanel.tsx` → Seção no detalhe do membro
  - Dropdown de tom (4 opções)
  - Botão "Gerar mensagem"
  - Preview: subject + texto WhatsApp + texto email
  - Histórico: últimas 3 mensagens (collapsible)
  - Botões: "Copiar WhatsApp", "Abrir WhatsApp", "Copiar Email", "Regenerar"

**Deep Link**
- [ ] `src/utils/whatsapp.ts` → `openWhatsAppWithMessage(phone, text)`
  - Usa número do membro + texto gerado
  - Fallback: copia se WhatsApp não abre

### Aceite

✅ Nunca inventa dados (turmas, datas, números)  
✅ Preview sempre antes de enviar  
✅ Clipboard funciona (WhatsApp e Email)  
✅ Deep link WhatsApp abre com texto pré-preenchido  
✅ Histórico armazena últimas 3 mensagens  
✅ Tons diferentes geram estilos diferentes  

### Smoke Test

**Exercício de comunicação**
1. Abrir membro professor com turmas
2. Gerar mensagem (tom "friendly")
3. Copiar e colar no WhatsApp (screenshot)
4. Regenerar com tom "firm"
5. Verificar diferença de estilo
6. Ver histórico (2 mensagens aparecem)
7. Abrir WhatsApp via deep link (evidência de texto pré-preenchido)

---

## PR 3 — Support Mode: Explicação Inteligente de Erros de Sync

**Branch:** `feature/sync-error-explainer`

### Objetivo
IA Ouro #5: Diagnóstico ops-centric que Sentry não faz (contexto de payload + org).

### Escopo

**Backend/Serviços**
- [ ] `src/api/ai.ts` → `classifySyncError(payload)`
  - Input: `{ classification, lastError, kind, payload (sanitizado), orgContext }`
  - Output: `{ probableCause, severity, recommendedAction, isBug: boolean, reasoning }`
- [ ] Sanitização: remover PII e dados sensíveis do payload

**UI**
- [ ] `app/coordination.tsx` → Seção "Saúde da Sincronização"
  - Lista de falhas recentes (já existente)
  - Botão "Explicar erro" em cada item
  - Modal: classificação + causa + ação + badge "possível bug"
  - Botão "Copiar relatório técnico" (formatado para suporte)

**Integração**
- [ ] Usa `listPendingWriteFailures()` e `getPendingWritePayloadById()` já existentes
- [ ] Classificação enriquece log de debugging

### Aceite

✅ Não sugere apagar dados  
✅ Não vaza info sensível (payload sanitizado)  
✅ Ajuda suporte sem abrir Sentry  
✅ Classificação é precisa (causa provável faz sentido)  
✅ Identifica bugs reais vs. erros de rede  

### Smoke Test

**Checklist B2/B3/B4** (Broken: Sync failures)
1. Forçar erro de sync (desconectar rede durante write)
2. Abrir Coordination → ver falha recente
3. Clicar "Explicar erro" → aguardar classificação
4. Verificar: causa provável faz sentido?
5. Copiar relatório técnico → colar no GitHub issue (evidência)
6. Tentar 2 tipos de erro diferentes (rede vs. validation)

---

## PR 4 — Audit Log (Ações Admin + IA) + Viewer

**Branch:** `feature/audit-log`

### Objetivo
Trilha Compliance: rastreabilidade de ações críticas (transformador para venda enterprise).

### Escopo

**Backend/Serviços**
- [ ] `src/db/audit-log.ts` (novo)
  - `logAction(organizationId, userId, action, metadata)`
  - `listAuditLogs(organizationId, filters)`
- [ ] `src/db/sqlite.ts` → Nova tabela `audit_log`
  - Schema: `{ id, org_id, user_id, action, metadata, timestamp }`
  - Índices: org_id, user_id, timestamp, action

**Ações Rastreadas**
- [ ] Sync: reprocess item, reprocess rede, clear dead-letter, export health report
- [ ] IA: gerar mensagem (metadata: tone, memberId), gerar resumo
- [ ] Admin: remover membro, alterar role, alterar permissões

**UI**
- [ ] `src/screens/coordination/AuditLogPanel.tsx` (novo)
  - Filtros: usuário, ação, período (7d/30d/90d)
  - Lista: timestamp + usuário + ação + detalhes (collapsible)
  - Export: CSV, JSON
- [ ] `app/coordination.tsx` → Nova aba "Auditoria"

**Integração**
- [ ] Instrumentar todos CTAs críticos em Coordination
- [ ] Org-scoped: só mostra logs da org ativa

### Aceite

✅ Cada ação crítica grava um evento  
✅ Log é org-scoped (não vaza entre orgs)  
✅ Export CSV/JSON funciona  
✅ Performance ok (índices corretos)  
✅ Offline: log local, sync depois  

### Smoke Test

**Exercício de auditoria**
1. Executar 3 ações: reprocess item, gerar mensagem, export health
2. Abrir aba "Auditoria"
3. Ver 3 logs aparecerem
4. Filtrar por ação "gerar mensagem"
5. Exportar CSV → abrir e verificar dados
6. Trocar org → ver logs diferentes

---

## PR 5 — Permissões Finas para Ações Enterprise

**Branch:** `feature/fine-grained-permissions`

### Objetivo
Evitar "qualquer admin faz qualquer coisa". Aumentar valor institucional.

### Escopo

**Backend/Serviços**
- [ ] `src/api/members.ts` → Definir novas permissões
  - `can_reprocess_sync`
  - `can_clear_dead_letter`
  - `can_export_health_report`
  - `can_view_audit_log`
  - `can_generate_ai_summary`
  - `can_generate_ai_message`
- [ ] Backend: enforcement nas RPCs (se políticas existem)

**Frontend**
- [ ] `src/providers/OrganizationProvider.tsx` → State de permissões
  - `usePermissions()` hook
  - `hasPermission(key)` checker
- [ ] UI: desabilitar CTAs e mostrar tooltip ("Sem permissão: [razão]")

**Defaults**
- [ ] Coordenação (role_level >= 50): todas permissões
- [ ] Professor (role_level >= 10): nenhuma ação de sync/health
- [ ] Estagiário (role_level < 10): nenhuma ação enterprise

### Aceite

✅ Usuário sem permissão não executa ação  
✅ UI clara: botão disabled + tooltip explicativo  
✅ Backend valida (se possível)  
✅ Não quebra fluxos existentes (defaults sensatos)  

### Smoke Test

**Checklist A3** (Access: Permission enforcement)
1. Login como Coordenação → todas ações disponíveis
2. Login como Professor → CTAs de sync disabled
3. Tentar executar via dev tools → backend bloqueia (se policy implementada)
4. Hover botão disabled → ver tooltip com razão
5. Alterar permissão de um usuário → ver mudança imediata

---

## PR 6 — Consistency Scanner + Auto-fix Suggestions + Incident Mode

**Branch:** `feature/consistency-scanner`

### Objetivo
IA Ouro #6 (diferencial): detecção + sugestão (confirmada) de fixes para inconsistências críticas.

### Escopo

**Backend/Serviços**
- [ ] `src/consistency/scanner.ts` (novo)
  - `scanOrganization(organizationId)` → retorna issues estruturadas
  - Issues detectadas:
    - Sessões duplicadas (mesmo class_id + date)
    - Sessão sem relatório mas com presença
    - Presenças fora de sessão válida
    - Gaps de SLA (>7d sem relatório)
    - Chamadas pendentes expiradas
- [ ] `src/api/ai.ts` → `suggestFix(issue)`
  - Input: issue estruturada
  - Output: `{ explanation, suggestedAction, impact, requiresConfirmation: true }`

**UI**
- [ ] `app/coordination.tsx` → Nova seção "Consistência de Dados"
  - Badge: "X inconsistências detectadas"
  - Lista de issues (por severidade: critical/high/medium/low)
  - Por issue:
    - Descrição humana (da IA)
    - Entidade afetada (link para abrir)
    - Botão "Sugerir correção" (chama IA)
    - Botão "Aplicar correção" (com confirmação modal)
- [ ] Modal de confirmação:
  - "Você está prestes a [ação]. Isso irá [impacto]."
  - "Esta ação será registrada no audit log."
  - Botões: "Cancelar", "Confirmar"

**Incident Mode**
- [ ] Se pendências > threshold (ex: 10 critical, 20 high):
  - Banner vermelho no topo: "Modo Incidente Ativado"
  - Botão "Gerar relatório de incidente"
  - Export: resumo + lista de issues + sugestões + plano de ação

**Integração**
- [ ] Cada fix aplicado gera audit log (PR4)
- [ ] Respeita permissões (PR5)

### Aceite

✅ Nunca aplica mudança sem confirmação explícita  
✅ Cada fix gera audit log  
✅ Funciona com org switch sem misturar dados  
✅ Scanner é rápido (<3s para org com 1000 registros)  
✅ IA não sugere deletar dados (apenas marcar/mover/corrigir)  
✅ Incident Mode ativa automaticamente em thresholds  

### Smoke Test

**Checklist E2/E3** (Enterprise: Consistency)
1. Criar inconsistência: sessão duplicada manualmente (dev tools)
2. Abrir Coordination → ver badge "1 inconsistência"
3. Clicar → ver issue listada
4. Clicar "Sugerir correção" → aguardar IA
5. Verificar sugestão faz sentido
6. Clicar "Aplicar correção" → confirmar no modal
7. Ver audit log da ação
8. Forçar Incident Mode (criar 15 issues) → ver banner + export

---

## 🔄 Branch & Release Flow

### Para cada PR

1. **Branch feature**
   ```bash
   git checkout -b feature/xxx
   git push -u origin feature/xxx
   ```

2. **Desenvolvimento**
   - Commits atômicos
   - Testes locais (smoke checklist)
   - TypeScript zero errors

3. **Preview Deploy**
   ```bash
   npm run update:preview
   # ou EAS update channel preview
   ```

4. **Smoke Test Completo**
   - Rodar checklist específico do PR
   - Evidências (screenshots + logs)
   - Validar org switch não quebra

5. **Pull Request**
   - Título: `[IA-1] Executive Summary + Cache`
   - Descrição: objetivos + aceite + smoke evidências
   - Request review

6. **Merge**
   ```bash
   git checkout main
   git pull origin main
   git merge feature/xxx
   git push origin main
   ```

### Release Final (após PR6)

```bash
# Promote preview to production
npm run update:promote

# Tag release
git tag -a v2.0.0-ai-enterprise -m "IA Operacional + Compliance + Auto-fix"
git push origin v2.0.0-ai-enterprise
```

---

## 📊 Smoke Test Master Checklist

| PR | Checklist | Foco |
|----|-----------|------|
| 1 | D1 (Diagnostic) | Executive summary real + cache + export |
| 2 | Manual (Comunicação) | 2 tons + deep link + histórico |
| 3 | B2-B4 (Broken sync) | Explain erro + relatório técnico |
| 4 | Manual (Auditoria) | 3 ações logadas + export CSV |
| 5 | A3 (Access) | Permissões bloqueiam CTAs + tooltip |
| 6 | E2-E3 (Consistency) | Issue detectada + fix aplicado + audit |

Cada PR deve passar seu checklist **antes de merge**.

---

## 🎯 Sequência Recomendada

**PR1 → PR2 → PR3** (valor imediato, valida contrato de IA)  
**PR4 → PR5** (blindagem enterprise/compliance)  
**PR6** (diferencial avançado, depends on 4+5)

### Por que essa ordem?

- **1-3**: Entregam valor rápido, testam infraestrutura de IA, baixo risco
- **4-5**: Cria fundação de compliance antes de features destrutivas
- **6**: Auto-fix precisa de audit log + permissões para ser seguro

---

## 📦 Dependências e Pré-requisitos

### Antes de começar PR1

- [ ] Definir chave de API (Anthropic/OpenAI)
- [ ] Criar `src/api/ai-client.ts` (wrapper com retry + timeout)
- [ ] Definir budgets/quotas por org (opcional mas recomendado)

### Antes de começar PR4

- [ ] Decidir: SQLite local ou Supabase remoto para audit log?
- [ ] Se remoto: criar tabela + RLS policies

### Antes de começar PR6

- [ ] Definir thresholds de Incident Mode
- [ ] Criar queries de scanning (podem ser lentas, otimizar)

---

## 🚀 Pronto para começar?

1. Review este roadmap com time
2. Ajustar prioridades se necessário
3. Criar issues/tasks no GitHub Projects
4. Começar pelo **PR1** (Executive Summary)

**Estimativa total**: 3-4 semanas (1 PR por 3-4 dias)

---

_Documento vivo: atualizar conforme PRs avançam._
