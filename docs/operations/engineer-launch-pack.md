# Go Atleta Engineer — Agent Launch Pack

## Estado vigente — 01/10/2026

Quatro agentes foram registrados e a Run 005 foi executada; o resultado permanece **FAIL_MULTI_AGENT**, com 715.514 tokens agregados. O aceite financeiro anterior valeu somente para essa run. Novas execuções vNext (005b e UI-001) continuam bloqueadas. A publicação do código na main não autoriza inferência paga, integração de candidatos nem ativação de novos agentes.

O [checklist central](../product/goatleta-checklist.html#alinhamento) reúne o estado atual, a aprovação humana limitada à aparência e os próximos passos. [Histórico das runs](engineer-run-history.md) e [runtime visual](engineer/ui-runtime-validation.md) contêm as evidências atuais. As etapas abaixo são registros cronológicos históricos, não comandos pendentes a executar automaticamente.

## Histórico da configuração remota — 01/10/2026

**Executor e pacote final:** chave de ambiente do projeto dedicado criada após confirmação e salva como `OPENAI_EXECUTOR_API_KEY` no arquivo local já autorizado. Launcher usa esse arquivo para o novo project_id, exige ambas as chaves e não recorre às credenciais antigas em caso de falha. Doctor confirma presença das duas chaves e quatro PASS_READ, mas conexão real continua NOT_TESTED. Run 005 `1c143e38ca0141e589f6b08056a822f5` preparada com IDs reais, somente leitura, um especialista e modo platform-hard-limit US$ 10; preflight offline READY, 26 testes PASS. Preparar não ativa o orçamento: sessão ausente e recibo humano ausente. O único próximo gate para iniciar a sessão é a confirmação humana interativa descrita abaixo, incluindo possível excedente. Não inferir aceitação financeira da autorização para criar a chave.

**Atualização de credenciais e definições:** chave controller criada pelo conector OpenAI Developers no projeto dedicado e salva no destino autorizado `.tmp/engineer-dedicated.env`, variável `OPENAI_API_KEY`. Arquivo ignorado pelo Git; credenciais DPAPI antigas preservadas. Quatro definições criadas e IDs reais registrados em `engineer/agents.json`. Doctor online confirmou os quatro perfis com PASS_READ; Docker/imagem/Codex PASS. Ajuste pontual no doctor preserva CRLF ao comparar o payload registrado, com teste de regressão (21 testes launch PASS). O executor ainda não tem chave no projeto novo. Formulário de chave de ambiente preparado no Chrome e não submetido; nenhuma sessão de inferência foi criada. A observação anterior sobre IDs nulos abaixo é histórica. O launcher DPAPI anterior não foi migrado e ainda carrega o projeto antigo.

Após autorização da sequência de configuração, projeto **Go Atleta Engineer** criado: `proj_r74GbuEXeHueUaVasyOi5EW8`. A interface de Limits confirmou `$0.00 / $10.00` e “Requests will start to fail when limit is reached” após salvar **Enforce a hard limit**. A plataforma avisa que o enforcement não é instantâneo e pode haver pequeno excedente. Billing consultado no navegador: saldo organizacional US$ 12,62, auto-reload OFF; nenhuma compra adicional.

Project ID registrado localmente; quatro agent IDs continuam nulos. Credenciais anteriores preservadas e vinculadas ao projeto anterior. Próxima etapa: seleção segura de nova chave pelo plugin OpenAI Developers, confirmação do destino local e configuração do executor. Nenhuma nova sessão/modelo executado. O recibo de confirmação financeira continua ausente; não ativar nem fabricar aceitação de possível excedente em nome do usuário. Os resultados abaixo descrevem a entrega local anterior.

Preparado em 01/10/2026. **Nenhum agente, projeto, chave ou sessão foi criado na plataforma nesta entrega. Nenhum crédito foi comprado. Run 005 não executada.** Os 98 testes anteriores foram preservados e 20 testes negativos/de contrato adicionados: 118 no total.

## Definições persistentes

`engineer/agents.json` guarda somente projeto, IDs e hashes dos quatro perfis. IDs permanecem `null` até registro real. Os arquivos `coordinator.md`, `implementation.md`, `security-review.md` e `test-review.md` continuam sendo a fonte das instruções. Não guardar chaves nesse JSON.

Prévia local de uma definição, sem rede:

```powershell
python scripts/goatleta-engineer.py agents-register --role coordinator --model gpt-6-astra
```

Os quatro nomes são Go Atleta Engineer — Coordinator, Implementation, Security Review e Test Review. Definições salvas têm delegação desabilitada por padrão; uma run habilita no máximo o especialista previsto. Registrar perfil não concede permissão de filesystem. Writer e reviewers devem usar fases/ambientes separados quando houver escrita.

Depois de configurar manualmente o projeto dedicado em `engineer/agents.json`, uma criação explícita futura usa:

```powershell
pwsh -NoProfile -File scripts/goatleta-engineer-local.ps1 agents-register --role coordinator --model gpt-6-astra --live
```

Repetir para implementation, security-review e test-review somente quando essa configuração remota estiver autorizada. O comando cria apenas a definição; não cria sessão nem executa modelo. `--agent-id agent_ID --live` registra uma definição existente após GET e comparação das instruções/modelo. Nenhum placeholder é aceito como sucesso. Agente já registrado não é recriado/substituído silenciosamente. Após falha ambígua no POST, o marcador exclusivo bloqueia repetição; inspecionar a plataforma e registrar o ID existente.

`prepare --saved-agents` vincula o snapshot do registro à run e usa o `agent_id` do Coordinator quando disponível. Perfis locais e restrições específicas da tarefa formam as instruções efetivas. Antes de sessão paga, o CLI confere os quatro IDs no projeto selecionado e compara os perfis/modelos remotos. Alterar registro ou perfil exige preparar outra run. Preparação com IDs ausentes é permitida para revisão local, mas não é executável.

**Persistência não prova delegação:** o contrato de `create_subagent_call` identifica em `agent_id` o solicitante, não o agente persistente selecionado para o filho. Este pacote não inventa uma opção de seleção de saved agent no spawn. O Test Review da Run 005 deve ler seu perfil local; sua identidade de subagente é registrada separadamente. Os outros perfis persistentes também podem iniciar sessões próprias em fases separadas. Não afirmar que todos os IDs salvos foram utilizados só por existirem.

## Prontidão sem falsos positivos

```powershell
pwsh -NoProfile -File scripts/goatleta-engineer-local.ps1 doctor --live-readiness --offline --image sha256:4290f6c7b74916aa606dd5419848543896c1f4afbc30fb4398806e0be0daf121
```

Com `--offline`, nenhuma chamada à API. Sem ele, somente GET das definições configuradas; nunca inferência ou criação. Presença de chave aparece como PRESENT, não como escopo aprovado. Um GET não comprova Agents Write, Responses Write ou conexão do executor. Finanças aparecem como MANUAL_CHECK_REQUIRED. Docker local, imagem e Codex CLI são conferidos sem rede e sem chaves dentro do container. Isolamento completo depende do preflight/smoke, não só de `codex --version`.

Resultado nesta máquina: chaves anteriores presentes; Docker/imagem/CLI PASS; projeto dedicado sem ID e quatro agentes MISSING_ID. Não reaproveitar as chaves do projeto anterior como se fossem do novo projeto. O fluxo de configuração das novas chaves fica para o usuário; nenhum segredo foi lido em texto aberto, impresso ou alterado nesta entrega.

## Orçamento: dois modos distintos

`strict` é o padrão do CLI, com US$ 5 quando não informado outro teto. Continua bloqueando antes de chamar a API. O screenshot enviado mostra saldo de US$ 12,62 e auto-reload OFF; é evidência visual daquele momento, não leitura atual da API nem confirmação de hard limit do projeto. **Não é necessário comprar US$ 10 adicionais para implementar ou testar localmente este pacote.**

`platform-hard-limit` é uma opção futura. A documentação oficial descreve bloqueio de novas requisições quando o gasto mensal contabilizado atinge o limite, com possível atraso/excedente. Isso não equivale ao teto estrito nem a US$ 10 por run. Alertas sozinhos não bloqueiam. Fonte: [Spend limits](https://developers.openai.com/api/docs/guides/spend-limits).

O novo modo exige projeto dedicado, agentes persistentes e confirmação humana explícita no terminal de: hard limit ativo, valor, auto-reload OFF e aceitação do possível excedente. O agente não deve executar essa confirmação em nome do usuário. Recibo local não secreto fica em `.tmp/engineer-platform-budget.json`, vence em 24 horas e precisa corresponder ao projeto e valor da run. É confirmação manual, não verificação de billing pela API, nem autenticação contra o administrador do host.

Sequência futura, **não autorizada/executada agora**:

1. Na conta correta, criar/selecionar o projeto **Go Atleta Engineer**, separado do projeto do produto. Conferir uso por projeto; saldo prepaid não deve ser interpretado como carteira exclusiva desse projeto.
2. Conferir saldo e manter auto-reload OFF. Se desejar adicionar US$ 10, fazer a compra manualmente; a imagem atual já mostra saldo. Compras nunca são automáticas aqui. [Prepaid billing](https://help.openai.com/en/articles/8264644-setting-up-and-managing-prepaid-api-billing).
3. Em Project Settings → Limits → Spend → Edit spend limit, informar US$ 10 e ativar **Enforce a hard limit**, salvar e conferir. Alertas de US$ 3/5/8 são opcionais conforme a interface. Não alterar o limite da organização inteira, que pode interromper outros projetos.
4. Criar chave de aplicação do projeto dedicado com Agents Read/Write e Responses Write; criar chave de ambiente correspondente para conexão do executor. Armazenar por canal local protegido, nunca no Git/chat. O launcher existente usa DPAPI; não sobrescrever credenciais sem decisão explícita sobre a troca de projeto.
5. Registrar o project_id não secreto e criar/registrar os quatro agentes; rodar doctor, preflight e smoke. Tratar campos financeiros/permissões não comprovadas como conferência manual, não PASS automático.
6. Somente se Gustavo decidir substituir o bloqueio estrito por enforcement com possível excedente, ele executa:

```powershell
python scripts/goatleta-engineer.py confirm-platform-budget --project-hard-limit-usd 10
```

7. Preparar **nova** run com `--saved-agents --budget-mode platform-hard-limit --project-hard-limit-usd 10`; não incluir `--max-cost-usd`. Fazer preflight e revisar o pacote. Futuro `create RUN --live --budget-mode platform-hard-limit` exige que o modo coincida com o manifest e a confirmação permaneça válida. Flags não convertem a Run 005 estrita já preparada nem removem seu teto. Sem recibo, projeto correto ou aceitação explícita, permanece BUDGET_GATE.

## Run 005 preparada, sem executar

Novo pacote local: `dd7b05a8ce1a49a29f72e934f6d41a44`; Coordinator + um Test Review, duas skills, perfil router e workspace somente leitura. `strict`, US$ 5, registro persistente ainda sem IDs. Nenhuma sessão criada. Pacotes anteriores ficam preservados como evidência; não usar um deles para contornar o bloqueio. Após configurar IDs reais, preparar novamente para fixar o registro correto.

Critérios verificáveis: chamada de delegação do coordenador; turn de filho concluído; comando bem-sucedido e resposta final do especialista; wait destinado ao filho; resposta final do coordenador; incorporação substantiva dos achados; zero writes; testes; atestação e teardown. Sem delegação real, uma boa resposta solo resulta em FAIL_MULTI_AGENT.

A incorporação não é provada por mencionar “Test Review”. Após inspecionar ambas as respostas, registrar `coordination-review.json` privado com `history_sha256`, `root_item_id`, `specialist_item_id`, `incorporated` booleano e `rationale`. IDs precisam existir no histórico correspondente; alteração do histórico invalida o registro. Sem análise, o estado é PENDING_INCORPORATION_REVIEW; estrutura completa sozinha não recebe PASS.

Run 006 e 007 continuam futuras; não habilitar dois especialistas automaticamente. O limite atual é um. Implementation com escrita continua separado dos ambientes de revisão e do gateway humano de integração.

## Relatórios

`report RUN` agora gera `run-summary.md` com status, coordenação, arquivos, testes, skills, orçamento e integração, além do JSON completo. O relatório guarda registro de agentes, session agent_id quando informado, IDs dos turns e itens do especialista, uso e `cost: {currency: USD, actual: null, source: platform_usage, complete: false}` quando o valor cobrado não foi disponibilizado/verificado. Tokens e estimativas não são custo real. Read-only mostra integração bloqueada.

Fontes de contrato: [Configuring Agents](https://developers.openai.com/api/docs/guides/agents-api/configuration), [schema de definição](https://github.com/openai/openai-python/blob/main/src/openai/types/beta/agent_create_params.py), [schema de sessão](https://github.com/openai/openai-python/blob/main/src/openai/types/beta/agents/session_create_params.py), [Multi-agent](https://developers.openai.com/api/docs/guides/agents-api/multi-agent).
