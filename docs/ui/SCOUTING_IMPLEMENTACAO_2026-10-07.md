# Scouting — implementação e ativação do banco

Aplicação autorizada do [mockup](SCOUTING_MOCKUP_2026-10-06.md), iniciada em
06/10 e validada em 07/10/2026. **Migration aplicada no Supabase em 07/10, após
autorização explícita. Pacote validado para revisão e prévia; produção pendente.**

## Experiência

- Treinos e Jogos com o mesmo destaque. Continuação da análise em andamento,
  histórico paginado, busca por título/adversário, filtros de ano/mês e contexto.
- Leitura de um fundamento por vez, distribuição, critérios e denominadores.
  Somente análises concluídas carregadas entram no recorte. Contextos diferentes
  pedem filtro antes de comparar. Ausência de observação não vira erro.
- Jogo: escolha de atleta/equipe, fundamento e resultado; contatos em sequência,
  edição/remoção, zona e fase opcionais. Fechamento atribui o ponto explicitamente.
  Placar e botões permanecem visíveis durante a rolagem.
- Reabrir o último ponto do set recupera contatos, placar anterior, saque e
  posição do levantador. R1→R6 quando recupera o saque; rodízio desconhecido fica
  desconhecido. Formatos diferentes de 6×6 não recebem rodízio presumido.
- Treino: resultado registra uma repetição. Desfazer remove a última observação.
- Set e placar iniciais são explícitos; próximo set é manual, sem impor regra de
  25 pontos a atividades adaptadas. Sessões concluídas ficam em consulta.
- Sugestão de próximo fundamento é determinística e substituível. Não há modelo
  de IA executando, vídeo, súmula oficial ou atribuição automática de atleta.

## Implementação e dados

Rotas finas usam `src/screens/scouting/ScoutingScreen.tsx`, `ScoutingCollector.tsx`
e `use-scouting-collection.ts`. Primitives: `ModalSheet`, `Pressable`, `Button`,
`DateInput`, tema e ícones existentes. Foco web contido no modal, Escape e retorno
ao acionador quando ainda existe; se a conclusão remover esse acionador, retorno
à aba de visão geral/histórico.

`src/db/scouting-collection.ts` usa RPCs com organização explícita e identidade
capturada. A visão geral carrega 50 sessões por página e contagens agregadas,
evitando baixar contatos de todas as análises. Histórico anterior fica acessível
com **Carregar análises anteriores**; filtros/indicadores descrevem o recorte carregado.

[Migration aditiva](../../supabase/migrations/20261007112922_scouting_rallies.sql):

- Sessões recebem formato opcional, revisão e estado do jogo. Ações recebem
  vínculo ao ponto, ordem, zona e versão da rubrica. Nenhum backfill inventa
  contatos, atletas, contexto, placar ou rodízio de registros antigos.
- O preflight remoto encontrou `rally_id` e `zone` textuais anteriores ao contrato
  local. A nova coleta usa `rally_event_id` e `capture_zone`, sem reinterpretar os
  campos antigos. Guardas executam depois dos triggers de compatibilidade existentes.
- `scouting_rallies` guarda pontos e contatos, com RLS de leitura. Reabertura
  anula o ponto, remove suas ações ativas e restaura o rascunho na sessão.
- `apply_scouting_command` verifica organização/turma/equipe autorizada e vínculo
  do atleta; bloqueia sessão para serializar comandos, exige revisão e recibo de
  idempotência. Placar, ações e contagens legadas são gravados na mesma transação.
- Recibos privados guardam hash do comando, sem duplicar nomes/contatos no recibo.
  Não há escrita direta de cliente nas novas tabelas. Funções auxiliares não são
  executáveis pelo cliente. Campos de autoria não impedem remoção da conta.
- Guardas preservam ações avulsas legadas, mas bloqueiam alteração direta de
  pontos vinculados/placar, mudança de contexto após coleta e edição de concluídos.
- Rubrica v2 distingue ataque bloqueado que encerrou o ponto (`bloqueio_ponto`,
  nível 0) de continuidade. `bloqueado` antigo não é reinterpretado nem incluído
  silenciosamente como erro na eficiência de ataque.

Rascunhos locais incluem usuário, organização e sessão na chave. O recibo é
persistido **antes** da requisição. Toques repetidos são bloqueados; falha ou
resposta perdida conserva o mesmo comando para confirmação idempotente.
Conflitos de revisão exigem conferir o placar atual, preservando os contatos.
Não há promessa de sincronização automática offline: o professor confirma o reenvio.

## Validação inicial, antes da ativação

Nível 3 da [escada](../operations/validation-ladder.md):

- 22 testes Jest em cinco suítes: domínio, compatibilidade, adaptação de API e
  hook de coleta. Incluem toque duplo, envio incerto, falha de storage antes/depois
  do servidor, conflito de revisão, recuperação do rascunho e mudança de identidade.
- `scripts/validation/scouting-rallies-sql.mjs`: PostgreSQL PGlite isolado, com
  migrations e funções de permissão reais e identidades sintéticas. Verifica
  rollback, replay, acesso negado, atleta de outra organização, escopo divergente,
  reabertura, imutabilidade, agregados, contagens legadas e exclusão em cascata.
- `typecheck:app`, `check:org-scope` e `check:perf-hygiene` passaram. Diff conferido.
- No app autenticado em localhost:8081: leitura real do histórico e estado de
  atualização pendente. Supabase configurado é remoto; nenhuma escrita de QA foi
  enviada a ele.
- Em aba separada no mesmo localhost, RPCs do scouting interceptadas com fixtures:
  12–10→13–10→reabrir12–10, três contatos recuperados, correção de recepção, resposta
  perdida/reenvio com mesmo ID mantendo um ponto; treino 0→1→0 e conclusão.
  Desktop e 390×844 no tema escuro; foco contido por Shift+Tab, Escape, sem overflow
  horizontal. Essa simulação exercita UI/adaptador; não certifica PostgREST remoto.

## Ativação remota — 07/10/2026

Nível 4 da escada, autorizado pelo usuário ao continuar a aplicação da migration:

- Destino conferido com a configuração local: projeto `hgmdpetpwclucvquoklv`.
  Migration `scouting_rallies`, versão **20261007112922**, aplicada com sucesso.
  Arquivo local renomeado para a versão registrada pelo serviço; conteúdo preservado.
- Preflight de colunas, constraints, triggers, permissões e histórico de migrations.
  Compatibilidade reproduzida sem dados pessoais em
  `scripts/validation/fixtures/scouting-hosted-compat.sql`. SQL passou tanto no
  schema limpo quanto com `node scripts/validation/scouting-rallies-sql.mjs --hosted-compat`.
- **23 testes Jest** em cinco suítes, `typecheck:app`, `check:org-scope`, diff e
  `npm run build -- --max-workers 2` passaram após o ajuste de compatibilidade.
  O build manteve avisos de resolução de exports do Expo/React DOM, sem falha.
- RPCs remotas disponíveis ao papel autenticado, indisponíveis a `anon`;
  auxiliares privados, RLS nas tabelas novas e escrita direta de cliente revogada.
- Smoke pelo app autenticado em **localhost:8081**, sem interceptar RPCs:
  criação de jogo 6×6, placar 12–10, recepção Boa na zona 5, levantamento Organizou
  e ataque Ponto. Salvar gerou 13–10, saque nosso e R6; reabrir restaurou 12–10,
  saque adversário, R1 e os três contatos. Novo fechamento e conclusão passaram.
  Tentativa de atribuir ponto contraditório ficou desabilitada na UI.
- Treino 3×3: repetição 0→1→desfazer0 e conclusão. Conferidos estado, vínculos,
  zona, revisões, contagens legadas e indicadores da análise concluída no banco/app.
- As duas sessões temporárias e seus dados dependentes foram removidos por IDs
  exatos. Contagens retornaram a 5 sessões, 3 ações e 3 logs anteriores; hashes dos
  campos preexistentes coincidiram antes da migration, após ela e após o smoke.
  Nenhum contato foi atribuído a um atleta real durante o teste.

O app local está apto a gravar a nova coleta no banco remoto. Publicação do código
do app continua separada. O fallback anterior permanece somente para leitura caso
a mesma versão do app seja executada contra um banco que ainda não tenha as RPCs.

Não foram certificados dispositivo nativo, concorrência multi-conexão no serviço
hospedado, tema claro ou uma partida em campo.

## Entrega em branch e prévia — 07/10/2026

Após autorização de commit e push, pacote separado em
`codex/scouting-rallies-release`, partindo da `main` `2fe4c659`. Destino desta etapa:
PR para revisão e deploy de prévia; merge e distribuição de produção ficam separados.

`PERF_BASE_REF=origin/main npm run build:verified` passou em 122 segundos:
562 suítes / 3.153 testes, lint sem erros/avisos, tipos, encoding, marca, JWT,
escopo, assets, arquitetura, performance estrita e export web. A suíte SQL foi
reaproveitada pelo executor por conteúdo idêntico, após aprovação das 9 suítes na
execução anterior. O CI continua executando seus próprios gates.

O gate estrito identificou a instrumentação retirada das rotas ao simplificá-las.
Marcadores foram restaurados nas rotas e nos carregamentos reais de visão geral
e detalhe, sem incluir dados pessoais nos breadcrumbs. A regressão do schema
legado entra agora no runner SQL/CI via `scouting-hosted-compat-sql.mjs`.

Smoke real de jogo/treino registrado acima reaproveitado; leitura autenticada da
tela conferida novamente após instrumentação. Alterações documentais posteriores
ao executor exigem geração do checklist e diff, sem repetir testes do runtime.

## Correção de fidelidade ao mockup — 07/10/2026

A primeira implementação preservou a coleta, mas divergiu da composição aprovada.
Esta revisão usa o mockup `scouting-2026-10-06.html?coleta=jogo` como referência
visual, sem alterar RPCs, migration, rubricas ou isolamento de organização.

- Modal de 640px, placar central com equipes identificadas e cabeçalho/rodapé fixos.
- Contatos em sequência horizontal editável, desfazer o último contato e confirmação
  do ponto no rodapé. Atletas e resultados lado a lado no desktop; resultados abaixo
  da grade no celular. Mobile usa a altura disponível para acomodar turmas maiores.
- Atleta ou “Sem atleta” é uma escolha explícita; fechar ponto fica bloqueado enquanto
  falta o resultado do contato. Treino mantém a seleção para repetições sucessivas.
- Nomes curtos são desambiguados; o nome completo permanece no rótulo acessível.
  Números de camisa fictícios do mockup não são inventados para atletas reais.
- Quadra opcional em posições 4–3–2 / 5–6–1, critérios sob demanda, fundo sólido e
  links discretos. Abas, contexto/período em dropdown e distribuição dos resultados
  recuperam a hierarquia visual da referência.

Validação visual/interativa no app autenticado em localhost, com respostas de
scouting substituídas somente na aba de QA: editar contato, registrar ponto
12–10 → 13–10, reabrir e recuperar três contatos/saque/rodízio, zona, filtros,
Tab/Shift+Tab e retorno de foco. Nenhuma gravação remota nesta revisão.
Conferidos desktop 1055×704, tablet 834×1194 e mobile 390×844 em tema escuro;
desktop 1440×1024 e mobile 390×844 em tema claro. Evidência visual privada em `.tmp/`.
Cinco testes de interação novos cobrem seleção explícita, contato pendente,
edição/desfazer, repetição de treino e próximo set sem pontos registrados. Aprovação estética final e uso em campo
continuam pendentes; esta revisão não certifica dispositivo nativo.

Release desta revisão aprovado em 138s: 563 suítes / 3.158 testes, lint sem
avisos, tipos, escopo, arquitetura, performance e export web. SQL reutilizado
pelo executor por inputs inalterados. Na tentativa anterior, um teste de
redelivery concorrente de webhook Asaas falhou ao presumir qual chamada seria
a duplicada; passou isoladamente e na repetição completa, sem mudanças nesse módulo.
Também exercitados treino registrar/desfazer/concluir, distribuição dos resultados
e início do set 2 no browser de QA. Respostas simuladas removidas e tema original
restaurado ao terminar; o app real continua conectado normalmente.

## Integração com os perfis — 08/10/2026

O usuário autorizou o fechamento na `main` pelo [PR #98](https://github.com/otaldogusta/GoAtleta/pull/98),
incluindo os dois commits de scouting e a unificação das configurações de perfil.
O [padrão de configurações](FORM_SETTINGS_PATTERNS.md) descreve esse segundo fluxo.
Checks e estado de integração são rastreáveis no PR; o deploy utiliza as filas
existentes de Vercel e EAS. Este fechamento não acrescenta novas migrations nem
certifica uso em campo, dispositivo nativo ou atualização aplicada ao aparelho.
