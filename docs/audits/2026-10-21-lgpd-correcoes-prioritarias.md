# Go Atleta — correções prioritárias de LGPD

21/10/2026, America/Sao_Paulo. Continuação local da
[fase 1](2026-10-21-juridico-lgpd-diagnostico.md), sobre `af5913c4`, na branch
`codex/auditoria-juridica-lgpd-2026-10`. Escopo autorizado: JUR-01, JUR-02 e JUR-03,
com testes e checklist, sem alterar produção.

## Estado da entrega

| Risco | Implementação local | Verificação | Ativação |
| --- | --- | --- | --- |
| JUR-01 | Nova migration amplia saneamento das cópias estruturadas e torna a descrição da conclusão precisa | PostgreSQL isolado com rollback, retry, grants, outras identidades e replay de vídeo | Não aplicada remotamente; não reprocessa pedidos concluídos |
| JUR-02 | Exportação paginada sob JWT/RLS, projeções explícitas e falha segura | 41 testes do handler/helper reais com serviços simulados | Edge não publicada; Auth/PostgREST/RLS hospedados pendentes |
| JUR-03 | Insight proativo usa somente categorias permitidas e números da turma | Payload final ao fornecedor verificado com fetch simulado, incluindo entradas adversariais | Edge não publicada; nenhuma chamada de IA real |

Isso mitiga os defeitos identificados no escopo descrito. Não fecha toda a auditoria,
não demonstra anonimização irreversível nem atendimento integral de todo direito
de titular. As demais fases e os riscos residuais do diagnóstico permanecem abertos.

## JUR-01 — saneamento estruturado e novas tentativas seguras

A [nova migration](../../supabase/migrations/20261021153000_complete_lgpd_student_copies.sql)
substitui a preparação do job sem reescrever migrations históricas:

- limpa endereço, identidade de gênero e curso, além dos campos que o worker já tratava;
- remove `athlete_intakes` vinculados pelo ID do atleta **e** pela organização, sem alterar registros sem vínculo ou de outras pessoas;
- substitui snapshots de nome em `scouting_actions`, contatos de `scouting_rallies` e `match_state.recoveredDraft`;
- saneia contatos vinculados nos documentos editáveis de vídeo: nome genérico e `studentId: null`, preservando mídia, análise e ações dos demais atletas;
- incrementa as revisões afetadas e descarta recibos somente dos documentos alterados, para um replay antigo atingir o conflito de revisão;
- executa as etapas novas mesmo quando um job antigo já tem `anonymized_at`, preservando seu alvo persistido de limpeza de foto.

Locks de sessão precedem as alterações de scouting/documento, acompanhando a
serialização usada pelas RPCs de escrita. Estatísticas, placares e registros
institucionais são preservados. Leases, limite de tentativas, atomicidade,
privilégios exclusivos do worker e conclusão posterior à limpeza do avatar continuam.
O texto de sucesso passa a ser “Saneamento dos dados estruturados concluído e
consentimentos removidos”. A migration apenas define funções; não executa jobs.

O [harness LGPD](../../scripts/validation/lgpd-deletion-sql.mjs) usa as migrations
reais de perfil, intakes, scouting e vídeo, com base local sintética. Cobre:
rollback após falha tardia, restauração de recibos/revisões, isolamento entre
atletas/organizações, acesso negado às RPCs, lease vencido, conclusão antecipada,
limpeza nova em checkpoint legado e retry sem nova revisão. Chama a RPC real de
salvamento de vídeo e verifica `VIDEO_DOCUMENT_CONFLICT` para o payload anterior.

**Limites:** IDs institucionais estáveis e vínculos históricos permanecem; isso
é saneamento/pseudonimização das cópias delimitadas, sem prova de anonimização
irreversível. Mídia visual, projeções publicadas sem vínculo individual, menções
em texto livre, intakes sem vínculo, dados de outros fluxos, rascunhos, downloads
e backups exigem inventário/decisão próprios. Pedidos já concluídos precisam de
remediação separada e autorizada. O custo de locks em organizações grandes não
foi medido. Não foi alterada a política de retenção desses outros conjuntos.

## JUR-02 — exportação com escopo e conclusão verificáveis

O [endpoint](../../supabase/functions/lgpd-export/index.ts) valida a identidade com
`auth.getUser`, mantendo o mesmo JWT em todas as leituras. O
[coletor](../../supabase/functions/_shared/lgpd-export-data.ts) declara projeções
de cadastro e 12 conjuntos: consentimentos, check-ins, chamada, presença de treino,
intakes, scouting legado, ações de scouting, matrículas, capacidades de vínculos,
avisos de ausência, eventos de contexto e logs de acesso à saúde.

Corrige `studentid` do scouting legado e retira a consulta inválida de
`session_logs.student_id`. Relatórios coletivos não entram no arquivo, pois não
têm projeção segura por titular e podem conter dados/fotos de colegas. Não são
exportados CPF cifrado/HMAC, UIDs de tags ou identidades/metadados técnicos
desnecessários de terceiros.

A paginação usa ordenação por ID e contagem exata. Continua após páginas menores
que 500 impostas pelo servidor; recusa contagem ausente/divergente, falta de
progresso, IDs repetidos, registros fora do escopo e limites excedidos. Há limites
de 10 mil linhas por conjunto, 50 mil totais e 10 MiB; excedê-los exige atendimento
gerenciado, sem devolver arquivo truncado. Leituras paginadas não formam snapshot
transacional: substituições concorrentes com total estável ainda podem passar.

Serialização, tamanho e construção da resposta antecedem o recibo `completed`.
Service role é usado somente para gravar esse recibo, nunca para completar leituras
ocultas por RLS. Se consulta, configuração, montagem ou recibo falhar, a resposta
não contém arquivo parcial. Headers incluem `no-store` e `nosniff`; mensagens de
erro não retornam dados ou detalhes do banco.

**Limites explícitos no arquivo/recibo:** é um snapshot estruturado visível ao
solicitante, não exportação universal ou encerramento de solicitação integral de
acesso. RLS pode esconder registros, e `[]` não comprova inexistência. Mídia,
contas/provedores, financeiro, convites, históricos adicionais e cópias locais
precisam de atendimento próprio. Não foi ampliada nenhuma permissão para contornar
essas restrições. O endpoint ainda não é uma nova jornada de autosserviço na UI.

O [teste do handler real](../../supabase/functions/_shared/__tests__/lgpd-export-handler.test.ts)
substitui o reprodutor que demonstrava o defeito antigo. Este continua disponível
no histórico do commit `af5913c4`; não deve ser executado como teste da correção.

## JUR-03 — minimização no contexto proativo

O [novo compositor](../../supabase/functions/assistant/proactive-insight.ts) recebe
apenas a turma já autorizada e consulta seus campos canônicos. Emite constantes
de modalidade/objetivo/nível, faixa etária numérica, frequência, duração e contagem
de atletas por HEAD, sem carregar lista de nomes ou dados clínicos.

O [ramo proativo](../../supabase/functions/assistant/index.ts) não anexa memória,
perfil institucional, calendário, documentos, histórico livre ou snapshots do
cliente. Textos inseridos nos campos conhecidos também são descartados quando
não correspondem exatamente a uma categoria permitida. Falha nas fontes impede
o envio. `planningContext` não pode desviar esse modo para outro compositor.

Modelo, `store:false`, formato da resposta e fronteiras JWT/organização/turma
foram preservados. `action` é forçado a `null`: o modo coletivo não recebe
destinatários e deixa de oferecer lembretes individuais baseados em dados médicos
ou contatos. A consequência funcional é intencional; sugestões coletivas continuam.

Os [testes de composição](../../supabase/functions/assistant/__tests__/proactive-insight.test.ts)
e do [handler](../../supabase/functions/assistant/__tests__/proactive-handler.test.ts)
inspecionam o corpo final de `fetch` à API simulada, com nomes, telefones, IDs,
dados médicos e instruções injetados em múltiplas fontes. Nenhum request foi enviado
à OpenAI. Outros modos de IA e retenção/contratos do fornecedor permanecem sujeitos
à auditoria própria; `store:false` não é uma declaração de retenção externa zero.

## Validação executada

Classificação inicial: nível 3, dados/segurança; fechamento para publicação da
branch/PR no nível 4, pela
[escada canônica](../operations/validation-ladder.md). Sem mudança de tela ou
renderização; perf-hygiene visual e matriz de viewports não se aplicam a este diff.

| Verificação | Resultado e limite |
| --- | --- |
| Jest de exportação | 1 suíte / 41 testes PASS, handler e coletor reais com API simulada |
| Jest proativo, model-policy e ai-workspace-scope | 4 suítes / 19 testes PASS; as 2 novas / 11 testes foram repetidas após o último ajuste no ramo |
| Jest lgpd-deletion-worker e account-deletion-contract | 2 suítes / 11 testes PASS |
| `node scripts/validation/lgpd-deletion-sql.mjs` | PASS; PostgreSQL isolado; repetido após ajuste do texto de conclusão |
| `node scripts/validation/scouting-rallies-sql.mjs` | PASS; preservação de save/replay/revisão/escopo e estatísticas |
| `node scripts/validation/scouting-video-documents-sql.mjs` | PASS; regressão dos contratos de sync e autorização em PostgreSQL isolado |
| `npm run typecheck:app` | PASS; sua configuração exclui Edge Functions |
| TypeScript isolado de `proactive-insight.ts` e imports locais | PASS com ES2022, bundler e allowImportingTsExtensions; não equivale a Deno check do entrypoint |
| `node scripts/check-org-scope.js`, `node scripts/check-edge-jwt.js` | PASS; guardrails estáticos |
| Geração e referências documentais | PASS; 124 links locais verificados, 29 módulos/380 itens/121 rotas, IDs e armazenamento de revisão pessoal preservados; somente o item pendente pertinente e quatro itens novos mudaram |
| `git diff --check` e formato dos arquivos novos | PASS; lockfile confirmado sem alteração |
| `npm run build:verified` no fechamento para publicação | PASS: 12 checks e exportação web; 633 suítes/3.999 testes Jest, 12 suítes PostgreSQL isoladas e 58 testes Node do runtime da quadra |

Total Jest único: **71 testes em 7 suítes**. Os três harnesses SQL são evidência
separada, sem inflar a contagem Jest. Dependências foram instaladas neste worktree
com o lock existente e scripts inicialmente desabilitados; patches locais
revisados foram aplicados pelo postinstall. Não houve atualização de pacote/lock.

`dev:doctor` encontrou dependências, mas falta configuração Supabase local. Não
foi iniciado smoke autenticado com backend hospedado, nem substituído por uma
sessão fictícia apresentada como real. Runtime Deno não está instalado; não houve
check/deploy Deno. O build web e os gates automatizados de publicação passaram.
Navegador autenticado, concorrência de conexões reais, Auth/PostgREST/Storage
integrados e produção permanecem pendentes. PGlite e mocks não validam todos os
serviços hospedados. A PR permanece em rascunho com esses limites explícitos.
Metro registrou avisos de resolução alternativa de exports em `expo-font` e
`react-dom`; a exportação concluiu, sem mudanças de dependências neste pacote.

## Continuidade e ativação

Entrega para revisão na branch `codex/auditoria-juridica-lgpd-2026-10`, PR de
rascunho #106. A autorização desta etapa abrange validação, commit/push e
atualização da PR. Merge, deploy, publicação de Edges, migrations remotas,
alterações de segredos e processamento de dados reais permanecem fora do escopo.
O checklist distingue implementação/teste local de ativação pendente.

O Git integrado da Vercel já havia criado um Preview para o commit documental
anterior. Para respeitar o pedido de publicar a branch **sem deploy**, o
`vercel.json` desabilita deployments automáticos exclusivamente para esta branch,
usando [git.deploymentEnabled](https://vercel.com/docs/project-configuration/git-configuration).
Não houve alteração de configuração remota ou de variáveis de ambiente.

Para futura ativação: revisar impacto/retenções e remediação dos pedidos antigos,
validar em backend isolado, concluir o smoke pertinente e os gates então aplicáveis, e
obter autorização explícita para aplicar a nova migration e publicar as Edges.
Reverter funções não restaura dados já saneados quando jobs forem executados;
restauração/retenção e backups precisam de decisão operacional própria.

Referências técnicas conferidas: [auth.getUser](https://supabase.com/docs/reference/javascript/auth-getuser),
[range](https://supabase.com/docs/reference/javascript/range) e
[changelog Supabase](https://supabase.com/changelog.md). As fontes jurídicas e a
gravidade original permanecem no diagnóstico; nenhuma política foi reescrita
para declarar conformidade nesta correção.
