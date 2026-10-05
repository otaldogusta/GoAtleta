# Continuidade — 05/10/2026

## Contexto técnico, consultoria e ambiente local — 05/10/2026

O [índice técnico](../context/README.md) reúne 16 guias para consulta seletiva antes
de editar; AGENTS e o checklist foram alinhados, preservando IDs/títulos anteriores.
[Correções locais](consultation-and-rules-sync-local.md): `req` consistente no
handler de regulamentos; consultoria por usuário/organização, vínculo próprio do
atleta, contexto capturado, legado preservado e guardas de notificação.

O [smoke autenticado](consultation-authenticated-local-smoke-2026-10-05.md) validou
perfil → prescrição → execução do atleta sem membership → revisão, erro 403 sem
sucesso local, fallback de rede e isolamento entre contas/organizações. Auth,
PostgREST/RLS e Edge Runtime reais em banco descartável; sem dados reais ou envio
externo. Serviços temporários encerrados e processo 8081 preservado.

[Preparação permanente](worktree-local-ready-2026-10-05.md): dependências próprias,
patches existentes, configuração pública local ignorada e doctor aprovado. A
stack compartilhada continua sem alterações; paridade de suas três migrations
pendentes é uma decisão própria. Após a revisão dos 47 arquivos, o usuário
autorizou commit e push para `codex/contexto-tecnico-consultoria`. A branch foi
criada a partir de `d5120cff`; a validação de publicação usa `build:verified`.
Confirmar o envio pelo SHA remoto e pelo histórico do commit. Core CI é acionado
por PR/manual/workflow; EAS publica apenas em main/master. Esta autorização não
inclui PR, merge, main, migrations ou deploy manual. Conferir resultados e limites
nos relatórios, sem assumir estado remoto a partir do checklist.

## Publicação do pacote Engineer e alinhamento central — 01/10/2026

Gustavo autorizou publicar o pacote e alinhar a main. Escopo: skills locais, governança/manifesto, ferramentas e testes Engineer, documentação e checklist; sem mudança funcional do app ou banco. O [checklist](../product/goatleta-checklist.html#alinhamento) é a entrada central para acompanhar validações, decisões e pendências. Caches Python, chaves, capturas e runs privadas permanecem ignorados. A autorização de publicação não libera novas sessões pagas.

Validação de publicação: 164 testes focados (158 Python + 6 Node), typecheck:app e check:org-scope aprovados. Build web aprovado com dois workers (`npm run build -- --max-workers 2`), além de encoding, marca, diff e 849 registros do manifesto. A primeira tentativa de build foi interrompida por pressão de memória. O check de encoding agora ignora `.tmp`, como os demais diretórios temporários; a serialização de um escape no lockfile foi normalizada com igualdade JSON conferida, sem alterar os patches. Smoke do checklist em localhost confirmado; não há fluxo autenticado do app alterado neste pacote.


## Runtime visual local validado — 01/10/2026

UI_RUNTIME_READY com captura real do `/login`, 18 artefatos, Node 24/Playwright/Chromium e teardown concluído em container sem rede. UI-001 ganhou evidência **local**, não uma sessão de agente. Galeria privada em `.tmp/engineer-ui-local/review.html`; 126 testes PASS. Gustavo aprovou explicitamente **apenas a aparência das seis imagens**; recibo com hashes em `human-appearance-review.json`. Revisão completa/UI_UX_GATE permanece UNVERIFIED; 1 erro de recurso por cenário sem origem identificada, zero exceções JavaScript. Detalhes e limites em `docs/operations/engineer/ui-runtime-validation.md`. Run 005b e UI-001 remotas continuam bloqueadas, sem nova autorização de gasto.

## Engineer vNext local — 01/10/2026

Pedido atual: Multi-Agent + UI/UX/Motion, **sem chamadas pagas e sem executar os pilotos**. Implementação, contratos e limitações em `docs/operations/engineer/vnext.md`; pacotes finais em `vnext-runs.json`. 005b `a8e3c193250a4a13990b0b1e99e36636` (preflight core local READY, 26 testes); UI-001 `b1b2f6a0a19f404889c5a87835c5765e` (UI_UNVERIFIED). Ambos sem sessão. Coordinator com cerca de 26 KB de contexto atribuído; partição instrucional, não isolamento entre papéis. Quinto perfil UI/UX Motion apenas local. Na preparação inicial, imagem/harness ainda não tinham sido executados; a seção de runtime visual acima registra a validação real posterior. `create --live` de vNext bloqueia antes da API. Preservar histórico Run 005 e todos os gates; não usar pacotes intermediários desta preparação como pilotos adicionais.

## Run 005 encerrada — 01/10/2026

Auditoria posterior, totalmente offline: o trace comprova total agregado **715.514**, incluindo especialista; 980.203 era dupla contagem e foi corrigido. Coordinator direto 450.825, especialista 264.689. BUDGET_GATE permanece. Os traces também contêm wait_for_agents com agent_ids vazio: não apenas metadado omitido; WAIT_TARGET_NOT_PROVEN explicitado sem aprovar o gate. Budget prioriza session_usage e relata fallback conservador; relatório preserva chamadas de espera não atribuídas. 85 testes locais PASS (40 controlador, 23 controles, 22 launch). Sem nova sessão/rede/inferência nesta auditoria. Custo anterior observado US$ 1,91 não foi consultado novamente. Histórico detalha fórmulas, spans e limitações; não usar a antiga soma 980.203 como total.

Gustavo registrou confirmação financeira humana; somente Run 005 foi executada. Sessão `sess_0f214fc00155dd84006abe8e41207c819ea24b3c403c55e5b1`, pacote `1c143e38ca0141e589f6b08056a822f5`: root concluído em 123s, um especialista concluído em 66s, 26 testes cada, zero writes, atestação PASS, container removido, sessão idle. Incorporação revisada e confirmada, mas gate estrito FAIL_MULTI_AGENT por waits sem recipient_agent_ids; não inventar destinatários. BUDGET_GATE por tokens excedidos (715.514 root/sessão, 264.689 especialista; soma conservadora 980.203). Projeto mostrava US$ 1,91 contabilizado de US$ 10 no painel, sujeito a atualização. Não iniciar outras runs nem repetir esta. Relatório detalhado em engineer-run-history.md. Corrigidos ack vazio de eventos e coleta separada de histórico do subagente; 40 testes controlador PASS. Traces e provas locais preservados. Próximo trabalho possível é diagnóstico offline dos metadados de espera/custo; nenhuma nova inferência está autorizada.

## Configuração remota do Engineer — 01/10/2026

Executor concluído após confirmação: chave de ambiente `Go Atleta Engineer executor`, tracking `key_NdRvPWcBxNqQP73U`, Active no projeto dedicado, salva como `OPENAI_EXECUTOR_API_KEY` no mesmo `.tmp/engineer-dedicated.env`. Launcher agora seleciona esse arquivo para o project_id dedicado e falha se faltar uma chave; preserva DPAPI do projeto antigo e restaura variáveis após execução. Doctor: duas chaves PRESENT, quatro PASS_READ, Docker/imagem/CLI PASS; conexão do executor ainda NOT_TESTED e finanças manuais. Nova Run 005 `1c143e38ca0141e589f6b08056a822f5`, perfis persistentes reais, read-only, um Test Review, platform-hard-limit US$ 10 **somente preparada**, preflight READY com 26 testes. Nenhuma sessão criada. Próximo gate exclusivo de Gustavo: `python scripts/goatleta-engineer.py confirm-platform-budget --project-hard-limit-usd 10`; não executar nem digitar por ele. Após recibo válido, executar somente essa Run 005 e fazer teardown/atestação/traces/revisão qualitativa. Não iniciar Run 006. Registros abaixo preservam etapas anteriores.

Atualização: chave controller criada pelo conector criptografado no projeto dedicado e salva, após autorização do destino, em `.tmp/engineer-dedicated.env` (`OPENAI_API_KEY`, ignorado pelo Git). Não imprimir esse arquivo. Os quatro agentes foram criados e registrados em `engineer/agents.json`; doctor online confirmou PASS_READ para todos. Docker, imagem e CLI PASS. Corrigida falsa divergência CRLF no doctor; 21 testes launch aprovados. Executor permanece MISSING; formulário de criação `Go Atleta Engineer executor` preparado no Chrome, ainda não submetido. Navegador do Codex apresentou timeout. Nenhuma sessão paga, recibo financeiro, compra, commit, push ou deploy. Launcher DPAPI anterior continua apontando às credenciais do projeto antigo: não usá-lo para ativar o novo projeto sem configurar o carregamento dedicado.

Projeto dedicado criado sob autorização: `proj_r74GbuEXeHueUaVasyOi5EW8`, Go Atleta Engineer. Hard limit mensal US$ 10 salvo e confirmado na interface (não apenas alerta). Saldo organizacional US$ 12,62 e auto-reload OFF conferidos; nenhuma compra. Registry atualizado somente com project_id. Quatro agentes ainda sem IDs; novas credenciais e executor pendentes, credenciais antigas preservadas. Run 005 não iniciada e nenhuma confirmação financeira humana criada. Próximo passo é seleção segura da chave pelo OpenAI Developers e destino local confirmado. A confirmação humana de possível excedente continua necessária antes de ativar platform-hard-limit. Não executar confirm-platform-budget pelo usuário. As seções anteriores abaixo são históricas.

## Agent Launch Pack — 01/10/2026

Suporte local a agentes persistentes e dois modos financeiros implementado. `engineer/agents.json` tem quatro IDs e project_id nulos: nenhum agente/projeto/chave foi criado remotamente. Perfis Markdown continuam canônicos. `agents-register` é dry-run por padrão; `--live` futuro registra/cria definições com projeto explícito, comparação de perfil e proteção contra duplicação ambígua.

Modo strict segue padrão US$ 5 e bloqueado. Modo platform-hard-limit exige nova preparação e confirmação humana interativa do projeto/valor, auto-reload OFF e possível excedente; recibo vence em 24h. Não executar confirm-platform-budget em nome de Gustavo. Implementar a opção não autoriza ativá-la. Imagem enviada mostrou saldo US$ 12,62 e auto-reload OFF, não hard limit do projeto; nenhuma compra efetuada.

Run 005 atual preparada: `dd7b05a8ce1a49a29f72e934f6d41a44`, persistent IDs ainda ausentes, strict, read-only e preflight com 26 testes PASS. Nenhuma sessão criada. Doctor offline verificou Docker/imagem/Codex e presença das credenciais antigas, sem validar permissões no novo projeto. 118 testes: 98 anteriores + 20 novos. Relatório agora inclui coordenação baseada em itens/turns, custo real desconhecido e `run-summary.md`. [Sequência manual, contratos e limitações](engineer-launch-pack.md). Sem commit, push, deploy ou Supabase.

## Benchmark offline — 01/10/2026

Usuário reafirmou o bloqueio financeiro estrito: continuar somente localmente, sem novas sessões pagas. Run 005 permanece bloqueada. Revisados os 24 casos, com rubrica específica e dependências históricas em `engineer/benchmark-readiness.json`; 11 patches não alteram testes reconhecidos no catálogo, o que não prova ausência de testes no repositório.

GA-018 calibrado sem rede/chaves no Docker: baseline falha nos três cenários esperados (7/10), referência histórica passa 10/10. Harness avaliador em `scripts/validation/engineer-phone-regression.mjs`. Não é execução de modelo nem avanço do benchmark pago. [Critérios, lacunas e evidência](engineer-benchmark-readiness.md). Checklist atualizado; sem commit, push ou deploy.

## Engineer supervisionado — 01/10/2026

24 casos históricos em 12 áreas catalogados com commits-base/referência e hashes; nenhum replay pago novo. Gateway `validate-candidate → review → decide → integrate` exige decisão humana vinculada ao diff/testes, recusa baseline concorrente e mantém backup. Agentes não podem preencher aprovação em nome de Gustavo. Montagem gravável por arquivo testada no Docker; proteção diferente da atestação final. 98 testes offline aprovados.

Traces das quatro sessões anteriores exportados com as permissões existentes, privados em `.tmp`. Política de tokens/comandos/turns observada ao reconciliar, timeout do executor em 300s. Usuário autorizou até US$ 5 para piloto; como não há teto financeiro garantido no contrato consultado, Run 005 `0288729eb85a4353aec6c3b6fbc59122` ficou preparada/preflight READY e `BUDGET_GATE`, sem sessão paga. Não usar a preparação superseded sem teto. Não remover o cap nem iniciar lote para contornar o gate. [Estado, comandos e limites](engineer-supervision.md).

## Go Atleta Engineer — 01/10/2026

Runtime v1 com Python 3.12/Node 22 e preflight bloqueante antes da API. Perfil router inclui código, testes, configuração e índice portátil; imagem separada do bundle. 76 testes locais e smoke Docker aprovados. Usar `goatleta-engineer-runtime:v1` e resolver seu ID imutável antes do preflight. Instruções em [goatleta-engineer.md](goatleta-engineer.md).

Runs reais concluídas: 002 leitura + 23 testes, zero alterações (74s); 003 uma frase + 23 testes (42s); 004 validação max_primary + 26 testes (52s), exatamente dois arquivos. Atestações PASS e todos os containers removidos. Candidatos revisados, baselines conferidos e mudanças integradas localmente. [Histórico e evidências](engineer-run-history.md). O relatório automático mantém revisão humana pendente; não existe gateway de aprovação implementado.

Credenciais DPAPI fora do repositório; usar `scripts/goatleta-engineer-local.ps1`, sem imprimir valores. Controlador expira em 02/10/2026. Checklist regenerado. Sem commit, push, deploy ou alteração no runtime do produto.

## Governança de skills — 01/10/2026

Camadas Core Go Atleta, trusted engineering e catálogo auxiliar registradas em [skill-governance.md](skill-governance.md). Precedência local e revisão de helpers em `AGENTS.md`. `scripts/explain-skill-selection.py` oferece recomendações limitadas e explicáveis; métricas de uso real são opcionais via `--record-used` e ficam em `.tmp/skill-selection/`, sem texto de tarefas. Validação ampliada: 21 testes do roteador, matriz de 16 cenários e oito regressões dos helpers; corrigidos os falsos enquadramentos de campo textual e copy de login, além do aviso de divisão em etapas. Evidências em [skill-governance-validation.md](skill-governance-validation.md). Não houve nova instalação. Regras heurísticas precisam ser confirmadas no código; não são interceptador de execução do Codex.

## Skills de desenvolvimento — 01/10/2026

Instalação ampliada concluída por solicitação do usuário: 194/194 entradas disponíveis, 853 raízes resolvidas, 849 skills fixadas por hash e quatro instalações existentes preservadas. Os dois helpers GitHub foram corrigidos e têm oito regressões offline. [Relatório atual](skills-package-review.md), inventário e manifesto em `docs/operations/`; reprodução por `scripts/install-reviewed-skills.py`. Marca pública **Go Atleta** e seleção contextual reforçadas em `AGENTS.md`. Sem dependências do app, push ou deploy.

Complemento: adicionada `goatleta-feature-workflow`, totalizando dez skills novas. `AGENTS.md` exige seleção por impacto e impede carregar o catálogo inteiro; matriz em `agent-skills.md`. A avaliação independente de triagem dos três exemplos e um controle de microajuste foram concluídos e registrados em [agent-skills-evaluation.md](agent-skills-evaluation.md). Uma rodada contaminada foi descartada e repetida. Seleção/investigação observadas; implementação e testes reais ainda dependem de requisitos concretos e execução.

Nove skills específicas adicionadas em `.agents/skills/`, com roteamento em `AGENTS.md`, preservando as nove skills existentes em `.codex/skills/`. Catálogo, versões externas, reinstalação em outra máquina e limites de validação em [agent-skills.md](agent-skills.md). Expo oficial e Playwright instalados nesta máquina; Supabase já disponível. Arquivos locais, sem commit/push. O worktree ainda exige dependências/configuração para executar o aplicativo; esta entrega valida as skills, não os fluxos E2E.

## Assistente unificado e densidade — 30/09/2026

Pacote preparado para commit/push em branch `codex/`, sem merge em `main` ou deploy de produção. Inclui revisão de densidade, editor de periodização compacto e conversa contextual compartilhada entre chatbot, planejamento e modais. Ver `planning-assistant-local.md` e `../ui/DENSITY_AUDIT.md` para escopo e evidências.

- Função `assistant` publicada na versão 87, ativa e com JWT. Smoke autenticado com modelo real concluído; nenhuma migração aplicada.
- Ajustes finais: launcher em portal fora da rolagem; painel lateral usa a altura disponível; resumo mensal lateral em largura intermediária, removido da coluna de detalhes da aula; PDF usa professor configurado por turma e rótulo canônico de nível.
- `build:verified` passou com 529 suites / 2.914 testes e sete suites PostgreSQL antes dos microajustes finais. Após eles, 15 testes de PDF/nível, tipos, org-scope, perf-hygiene e smoke de abertura do modal passaram. O Metro precisou de reinício com `--clear` após cache de módulos inválido.
- Capturas e artefatos privados permanecem ignorados e fora do commit. Planos existentes não são reescritos pela conversa.


## Perfil pedagógico inteligente — publicação de 29/09/2026

Pacote autorizado para `main`. O diagnóstico da turma passa a ser um perfil pedagógico persistente, versionado e auditável, compartilhado pelo assistente e pelos geradores mensal, semanal e diário. Relatos são salvos independentemente das configurações do ciclo; planos existentes só mudam após revisão explícita.

- Perfil canônico isolado por organização e turma, com revisões, origem, autor, histórico, idempotência, controle de concorrência, desfazer e RLS.
- Diagnóstico compacto em seis etapas, acesso a **Perfil da turma**, quadras proporcionais por formato, altura de rede coerente e agenda no padrão do editor de turma.
- Para as Raposas, o perfil vigente registra 6x6, até três quiques opcionais por rally, manchete/toque após o quique, proibição de dois contatos consecutivos pela mesma pessoa e três contatos não obrigatórios.
- O perfil influencia objetivos, progressões, regras adaptadas e critérios de observação; cada plano guarda a versão usada. Alterações futuras geram revisão seletiva, sem sobrescrever aulas realizadas ou edições manuais.
- Migração `20260929025310_class_pedagogical_profiles.sql` aplicada e alinhada no projeto remoto. Função Edge `assistant` ativa na versão 86 com JWT verificado.
- Validação de publicação: `build:verified` aprovado com 524 suítes Jest / 2.894 testes, 7 suítes PostgreSQL isoladas, typecheck, lint sem avisos, escopo de organização, arquitetura, performance de release e export web de 117 rotas. Smoke autenticado do perfil das Raposas concluído no localhost antes do fechamento.
- Screenshots, logs, `artifacts/` e `test-results/` permanecem apenas locais e não devem acompanhar o commit.

## Publicação de turmas e assistente — 21/09/2026

Pacote autorizado para `main`, com o editor moderno de turma compartilhado entre detalhe e listagem, correções de presença/relatório de aula e evolução do assistente. Os arquivos locais de QA em `artifacts/` e `test-results/` não fazem parte da publicação.

- A equipe da turma ganhou vínculos temporais, substituições agendadas, retorno, autoria, resumos de transição baseados em evidências e correções versionadas. `class_staff` permanece como projeção compatível; as alterações do editor usam a RPC versionada e idempotente quando o histórico está disponível.
- O editor preserva estagiários e pré-cadastros, confirma a troca de responsável, usa busca/badge para unidade e quadra, distingue vôlei de quadra e de areia e só alerta ao fechar quando o estado normalizado realmente mudou.
- O assistente ganhou ranking determinístico de faltas por chamadas efetivamente realizadas, fontes confiáveis, progresso e propostas de memória de turma limitadas por organização e turma.
- Migrações remotas necessárias: `20260920213000`, `20260920220833` e `20260921114136`. A função Edge `assistant` deve acompanhar o mesmo pacote. Conferir o histórico remoto antes de reaplicar.
- Na outra máquina: `git switch main`, `git pull --ff-only origin main`, `npm run dev:setup`, configurar `.env.local` por canal privado, `npm run dev:doctor` e `npm run dev:web`. Não copiar `node_modules`, `.git`, screenshots, resultados de teste nem credenciais.

Validação e publicação efetivas devem ser confirmadas no fechamento desta sessão e pelo status do commit no GitHub/Vercel; este registro não substitui a conferência do deploy.

## Pacote de continuidade — 16/09/2026

Publicação em main autorizada pelo usuário nesta sessão. O status efetivo do push/deploy deve ser conferido no GitHub/Vercel; este registro não certifica produção.

- Ajustes de navegação do aluno, agenda isolada pela instituição, layout de perfil, menus nativos e espaço da barra inferior; salvar chamada flutuante.
- Aprovação de atleta/responsável pode criar cadastro sem turma. Migrações `20260916131459` e `20260916134009` já foram aplicadas na sessão de aprovação; conferir histórico remoto antes de qualquer nova aplicação. Não remover RLS nem criar membership administrativo para atleta.
- Perfil resolve instituição pelo vínculo do atleta. Refresh reconsulta vínculos e turmas no escopo da instituição, preservando confirmação para rascunhos pendentes. Gesto Android usa feedback global acima do cabeçalho.
- Permissão nativa de notificações solicitada depois de autenticar; toggle reflete o sistema e sincroniza no retorno das configurações. Entrega remota do push de aprovação continua pendente: permissão concedida não prova registro de token nem envio.
- Variante **Go Atleta Perf** isolada: instruções em `scripts/validation/android-perf/README.md`. Usa bundle embarcado, login separado e o backend configurado (não é sandbox de dados). OTA usa o canal `perf`, mapeado ao branch de updates `production`; mudanças nativas ou de runtime ainda exigem novo APK.
- Auditoria e limitações: `android-performance-audit-2026-09-16.md`. Screenshots, APKs, logs, credenciais e resultados de teste locais não devem acompanhar o commit.

Na outra máquina: `git switch main`, `git pull --ff-only origin main`, `npm run dev:setup`, configurar `.env.local` por canal privado, `npm run dev:doctor`, `npm run dev:web`. Não aplicar migrações nem publicar durante o setup. Preservar alterações locais antes do pull; não usar reset/force-push.

### Validação do pacote

- Jest completo: 478 suítes / 2651 testes passaram; seis suítes PostgreSQL isoladas passaram.
- Typecheck, lint (zero avisos/erros), escopo da organização, arquitetura estrita, performance de release, diff e build web passaram. Exportação limitada a dois workers por memória disponível na máquina.
- Smoke autenticado do build exportado em localhost:8081: painel da coordenação, abertura do perfil e retorno ao painel. A sessão web é de coordenação; não certifica a turma do atleta no Android.
- APK Perf `1.0.3-perf` reconstruído com runtime `1.0.3`, OTA habilitado e canal `perf` verificados no manifesto compilado. Instalação `adb install -r` continua pendente porque o aparelho desconectou do ADB; o APK anteriormente instalado ainda não contém o patch nem o bootstrap OTA.
- Depois da instalação, validar o gesto físico e a atualização da turma com a conta fictícia, além da entrega remota de notificações.
- Histórico Supabase remoto conferido: ambas as migrações de aprovação já alinhadas; nenhuma reaplicação necessária.

## Histórico — estado publicado em 08/09/2026

- Base publicada no GitHub: `0da61bc53916a64b523fb863b1c4609b48ea8585` em main.
- Card sem plano: ícone e texto formam uma ação única, discreta e centralizada. O botão verde e a descrição foram removidos; callback de montar plano preservado.
- Botão compartilhado do assistente: arraste web por Pointer Events, gesto nativo por PanResponder, encaixe lateral, posição por dispositivo, Alt + setas no web, proteção contra abertura ao soltar.
- Validação anterior: 27 testes focados, tipos, lint, escopo da organização e exportação web passaram. Smoke autenticado no localhost confirmou clique, arraste, persistência e limites após redimensionamento. Não equivale a teste em aparelho nativo nem confirma o estado atual da produção.

## Branch de continuidade

`codex/workstation-setup` inclui preparação da segunda máquina e a modificação de código que estava apenas local:

- `ClassOperationsWorkspace.tsx`: compact usa os wrappers de conteúdo com estilos condicionais, preservando a montagem do conteúdo ao alternar layouts. Essa alteração estava fora da publicação anterior; revisar antes de integrar em main.

A alteração de espaço em branco em `2026-09-05-code-audit-closeout.md` foi preservada no patch do backup, sem incluí-la no commit.

Artefatos privados não foram enviados ao GitHub. Um backup separado no computador de origem guarda os arquivos locais selecionados. Credenciais e histórico pessoal do Codex não foram transferidos.

## Próxima sessão

1. Ler AGENTS.md e workstations.md.
2. Verificar branch, `git status` e `npm run dev:doctor`.
3. Configurar o `.env.local` e autenticar contas na nova máquina.
4. Rodar o localhost e validar a turma/assistente antes de novas alterações.
5. Não publicar nem aplicar migrações como parte da instalação. Atualizar este documento quando a tarefa mudar.

## Atualização local — Quadra Visual (08/09/2026)

O usuário aprovou o mockup e autorizou aplicar o pacote. Implementação local na branch existente, sem commit/push/deploy/migração. Alterações anteriores do FAB da turma foram preservadas no index; a navegação da turma ganhou somente contexto de data/plano para a quadra.

- Editor de tela inteira, piso azul, marcações de ataque/saque, painéis recolhíveis e orientação responsiva.
- Equipes, banco, materiais/desenhos, seleção múltipla, bloqueios/alinhamento/camadas, animação de jogadores e bola, etapas e biblioteca.
- Versões imutáveis, rascunhos isolados por usuário/organização/turma, backup ao trocar e proteção de saída. Serializer/parser mantém a extensão `editor` e rótulos personalizados.
- PNG/PDF no navegador e JSON editável. Vínculo com aula/bloco na biblioteca; planos aplicados preservados. Importação em outra turma permite reutilizar sem transportar IDs de alunos ou vínculo de aula.
- Detalhes e limites: `docs/operations/visual-court-workspace-proposal.md`. Vídeo/GIF, sugestões de IA, validação regulamentar automática e exportação PNG/PDF nativa continuam separados.
- Validação: 65 testes focados (comandos, histórico, persistência, autorização e adapter do banco), typecheck, lint, org-scope e perf-hygiene com `--worktree --base HEAD`. Smoke autenticado em localhost:328×912, 390×844, 844×390, 834×1194 e 1440×1024; seleção, movimento por teclado/desfazer, saída e recuperação de rascunho, geração PNG/PDF/JSON. Sem escrita remota de teste ou validação em aparelho nativo.
- Exportadores devem manter a mesma extensão `.tsx` em `court-export.tsx` e `court-export.web.tsx`, para resolução correta do Metro. Após adicionar o módulo web, foi necessário reiniciar o Metro com cache limpo.
- Servidor local usa Node 24.13.0 em `%LOCALAPPDATA%\Programs\GoAtletaNode\node-v24.13.0-win-x64`; não imprimir arquivos de ambiente. A instalação global de Node difere da versão escolhida para o projeto.

### Refinamento local dos controles — 08/09/2026

- Ferramentas agrupadas em materiais de treino e desenho/anotações, com ícones próprios. Estilo aparece no contexto da ferramenta selecionada.
- Engrenagem superior abre configurações da quadra: exibição, orientação, auxílios e camadas com interruptores. Zoom, deslocamento e ajuste à tela ficam junto de desfazer/refazer.
- Propriedades reservadas à seleção; jogadores/banco e edição de etapa têm painéis próprios. Etapas separam detalhes, ordem, animação e exclusão.
- Ícones têm rótulos flutuantes ao passar o mouse ou receber foco. Painéis e sequência inferior alternam visibilidade para evitar sobreposição dos controles.
- Validação desta rodada: 21 testes focados, typecheck, lint, perf-hygiene estrito e diff check passaram. Conferência autenticada no localhost em 390×844, 834×1194, 1440×1024 e desktop; camadas ocultam/restauram jogadores e tooltip aparece por foco. Tema claro e aparelho nativo não foram exercitados nesta rodada. Sem publicação ou escrita remota de teste.

### Biblioteca local — abas e lixeira

- Biblioteca separada em Jogadas, Sistemas, Dados e Lixeira. Novo sistema cria documento independente com tag sistema; metadados e vínculo de aula ficam em Dados.
- Lixeira reversível é uma preferência local isolada por usuário/organização/turma. Não exclui registros remotos, modelos do app, vínculos de aulas ou a cópia aberta. Restauração pela própria aba.
- Validação: 11 testes do controller (incluindo persistência/restauração da lixeira), tipos, lint, org-scope, perf-hygiene estrito e diff check. Painel Sistemas conferido no localhost autenticado. Nenhuma publicação.

## Publicação e continuidade — 09/09/2026

O usuário autorizou publicar e alinhar main. O pacote inclui preparação Node 24, FAB arrastável da turma, novo editor Quadra Visual e correção de rejeição não tratada ao expirar a sessão no carregamento da turma.

### Comportamento consolidado

- Painéis por contexto; ferramentas com ícones e rótulos; configurações com interruptores; tamanhos por lista e digitação; elenco por busca e pill.
- Seleção por retângulo, ações em grupo, V para selecionar, Espaço + arraste para pan, Ctrl + rolagem para zoom. Grade quadrada de 0,5 m com encaixe correspondente.
- Animação Livre/Reta, prévia do trajeto, seta que acompanha a borda do jogador; repetição da etapa atual; miniaturas na posição inicial. Limpar animação restaura a formação legal da etapa e a bola ao início.
- Compatibilidade dos materiais antigos; remoção dos alvos automáticos conhecidos dos presets. Correção do líbero restrita à adaptação do editor de recepção, preservando o contrato de rodízio e saque do núcleo legado.
- Biblioteca Jogadas/Sistemas/Dados/Lixeira. Lixeira é local e reversível; não apaga registros remotos ou vínculos com aulas.

### Outra máquina

Use main como base, preserve alterações antes de atualizar e rode dev:setup/dev:doctor com Node 24. Configure .env.local por canal privado. Nenhum segredo acompanha o commit.

Código no GitHub não transporta rascunhos, lixeira local ou versões ainda pendentes de sincronização. Para levar uma jogada, use Salvar versão e confirme a mensagem de salvamento na turma; para conteúdo apenas local, exporte JSON e importe na outra máquina. Mantenha a mesma conta e backend.

### Limites e revisão

Validação nativa e tema claro ainda exigem revisão específica. GIF/vídeo/IA e sincronização offline automática não fazem parte deste pacote. Nenhuma migração foi aplicada. A aprovação do build não substitui a confirmação da publicação Vercel/EAS; consulte o status do commit no GitHub.

### Validação de publicação

Código funcional: 58fb55b5933d256ec589f95b68303877ca2584c2. validate:app completo aprovado: 443 suítes Jest / 2.505 testes, 5 suítes PostgreSQL isoladas, zero erros/avisos de lint, tipos, escopo, encoding, assets, arquitetura e performance. Build web concluído; dev:doctor aprovado com Node 24. Smoke autenticado após novo login confirmou abertura da quadra, seleção, movimento por teclado, desfazer e configurações. Nenhuma escrita remota de teste. Integração em main via fast-forward; acompanhar Vercel e EAS no commit da publicação.

## Refinamentos de interface — publicação de 09/09/2026

- Quadra: materiais arrastáveis com prévia, botão + funcional, lista por equipe/quadra/banco, função com rótulo/cor, régua de animação, remoção de etapas com desfazer, miniaturas completas e repetição de etapa com indicador 1.
- Responsivo: controles reorganizados, propriedades recolhidas abaixo de 768px, atalhos suavizados durante interação e percentual de zoom temporário. Avisos usam o toast compartilhado.
- Turma: contexto com três informações, títulos locais por temas no histórico, hover da chamada separado dos botões e menu de PDF compacto. Prévia HTML do PDF com pan e zoom no web.
- Limites: modo Tela limpa apenas proposto; análise tática por IA e inversão de lados ainda pendentes. Arraste de materiais do painel usa API web; revisão nativa continua pendente. Rascunhos locais não são transportados pelo Git.
- Validação: typecheck:app, check:org-scope, 62 testes focados, build web e conferência da quadra autenticada no localhost aprovados. Sem migrações ou mudanças de credenciais.
