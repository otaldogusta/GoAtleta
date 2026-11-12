# Equipe local do Codex para o Go Atleta

Configurada e ampliada em 11/11/2026. São **16 perfis por especialidade**, além
do coordenador da conversa. Os agentes trabalham sob demanda; ter um perfil
disponível não inicia uma tarefa nem exige convocar toda a equipe.

## Papéis e divisão do trabalho

| Papel | Perfil | Responsabilidade | Entrega |
| --- | --- | --- | --- |
| Coordenador | Conversa principal | Entender pedido, dividir arquivos, acompanhar, conciliar resultados e registrar entrega | Resultado consolidado e próximos passos reais |
| Designer UI | [`goatleta_ui`](../../.codex/agents/goatleta_ui.toml) | Composição visual, tokens, componentes, estados e responsividade | Especificação visual e comparação com referências aprovadas |
| Designer UX | [`goatleta_ux`](../../.codex/agents/goatleta_ux.toml) | Jornada, navegação, pesquisa, acessibilidade e operação com uma mão | Fluxo, problemas observados e plano de validação de uso |
| Produto | [`goatleta_produto`](../../.codex/agents/goatleta_produto.toml) | Problema, público, prioridade, escopo e critérios de aceite | Brief com evidências, hipóteses, recorte e aceite |
| Arquitetura | [`goatleta_arquitetura`](../../.codex/agents/goatleta_arquitetura.toml) | Fronteiras, contratos e impacto técnico | Mapa de dependências e plano de implementação/validação |
| Segurança e privacidade | [`goatleta_seguranca`](../../.codex/agents/goatleta_seguranca.toml) | Revisão por leitura de autenticação, organização, RLS e dados privados | Achados com evidência, impacto e correção proposta |
| Dados e métricas | [`goatleta_dados`](../../.codex/agents/goatleta_dados.toml) | Métricas de produto e marketing, qualidade e interpretação de dados | Definições, cálculos reproduzíveis e limites da análise |
| Domínio esportivo | [`goatleta_dominio_esportivo`](../../.codex/agents/goatleta_dominio_esportivo.toml) | Pedagogia, planejamento, voleibol e treino no contexto do produto | Regras, cenários e critérios de aceite do domínio |
| Estratégia de marketing | [`goatleta_marketing`](../../.codex/agents/goatleta_marketing.toml) | Público, proposta de valor, posicionamento e campanhas | Brief e plano com objetivo, mensagens, canais e medida |
| Marca | [`goatleta_marca`](../../.codex/agents/goatleta_marca.toml) | Coerência da identidade verbal e visual existente | Direção criativa e critérios de consistência |
| Conteúdo e redes sociais | [`goatleta_conteudo`](../../.codex/agents/goatleta_conteudo.toml) | Pautas, calendário, roteiros e comunidade | Calendário editorial e rascunhos por canal |
| Copywriting | [`goatleta_copy`](../../.codex/agents/goatleta_copy.toml) | Texto de páginas, campanhas, e-mails e chamadas para ação | Peças e variantes com objetivo e afirmações verificadas |
| SEO | [`goatleta_seo`](../../.codex/agents/goatleta_seo.toml) | Intenção de busca, conteúdo público e indexação | Auditoria ou brief com prioridades e evidências |
| Crescimento | [`goatleta_crescimento`](../../.codex/agents/goatleta_crescimento.toml) | Aquisição, ativação, retenção, experimentos e planejamento de mídia | Hipótese, funil, métricas e desenho do experimento |
| Implementação | `goatleta_implementacao` | Alterações locais nos arquivos atribuídos | Diff, resumo e checagens já executadas |
| Revisão | `goatleta_revisao` | Inspeção independente, somente por leitura | Achados com cenário, impacto e arquivo/linha |
| Testes | `goatleta_testes` | Validação proporcional da revisão entregue | Comandos, resultados, evidências e limites |

Definições: [implementação](../../.codex/agents/goatleta_implementacao.toml),
[revisão](../../.codex/agents/goatleta_revisao.toml),
[testes](../../.codex/agents/goatleta_testes.toml).
[Configuração](../../.codex/config.toml): até três subagentes simultâneos além
da conversa principal, preservada nesta expansão. Modelo, esforço e permissões
são herdados. O tamanho do catálogo não aumenta a concorrência.

### Como escolher e combinar

**A escolha e a convocação são responsabilidade automática do coordenador.**
O usuário descreve o resultado desejado, sem precisar nomear funções ou confirmar
a delegação. O coordenador considera objetivo, impacto e risco, aciona os perfis
pertinentes e informa brevemente quem está participando. Uma preferência explícita
do usuário prevalece; microajustes podem ser resolvidos diretamente. Essa regra
coordena a equipe dentro do escopo pedido e não amplia autorizações externas.

| Pedido | Especialistas úteis | Continuidade |
| --- | --- | --- |
| Corrigir aparência de tela | UI; UX se mudar fluxo ou interação | Implementação → Revisão e Testes do recorte |
| Criar um fluxo ou funcionalidade | Produto + UX; UI e Arquitetura conforme o impacto | Domínio/Segurança quando necessários → Implementação → Revisão/Testes |
| Planejar lançamento | Marketing + Marca + Produto | Conteúdo/Copy; SEO e Crescimento conforme os canais |
| Preparar posts ou uma página pública | Conteúdo + Copy; Marca/UI quando necessário | Revisão editorial; Implementação/Testes se houver código |
| Entender conversão ou retenção | Dados + Crescimento | UX/Produto conforme o problema encontrado |
| Alterar planejamento ou scouting | Domínio esportivo + especialidade técnica afetada | Implementação → Revisão/Testes |

Use no máximo três subagentes simultâneos e organize as demais contribuições em
etapas. O coordenador resolve sobreposições: UX define o fluxo; UI sua composição;
Marca mantém a identidade; Produto delimita o problema; Marketing define campanha
e público; Conteúdo organiza pauta/canal; Copy redige a peça; Crescimento desenha
o experimento; Dados verifica a medida. Implementação integra o código atribuído.

Especialistas podem produzir análises, especificações e arquivos locais
explicitamente atribuídos. Segurança e Revisão atuam somente por leitura.
Nenhum perfil autoriza publicação, envio de mensagens, contratação, gasto em
mídia, ativação de campanha, instalação de rastreio ou uso de dados privados.
Rascunhos separam fatos, hipóteses e pendências; não inventar pesquisa, métricas,
depoimentos ou capacidades do produto. Autorização específica continua necessária
para executar ações externas; preparar uma campanha não a coloca no ar.

## Fluxo por tarefa

1. Coordenador lê status/diff, identifica o módulo e classifica a validação.
   Define objetivo, critérios de aceite, especialidades, arquivos e dependências.
2. Especialistas produzem as decisões e artefatos do recorte. Em mudanças de
   código, Implementação integra; Revisão pode mapear riscos enquanto Testes
   prepara o plano. Apenas um agente edita cada arquivo por vez.
3. Com o diff estável, Revisão inspeciona e Testes executa os checks pertinentes.
   Não validar como final uma revisão que ainda muda.
4. Implementação corrige achados concretos. Revisão e Testes conferem o delta
   afetado, reaproveitando evidência ainda válida conforme a escada canônica.
5. Coordenador confere o fechamento, atualiza a documentação/checklist afetados
   e registra resumo útil no Obsidian, quando o cofre local estiver disponível.

Em mudanças substantivas do produto, manter Implementação, Revisão e Testes.
Em pesquisa, marketing ou documentação, usar especialidades e validação
proporcionais: checar fontes, afirmações, links e artefatos, sem iniciar gates do
app por hábito. Em microajuste ou pergunta simples, usar o fluxo compacto e dizer
quais papéis participaram. Subagentes não delegam por rotina: pedem ao coordenador
quando a divisão precisa mudar.

Contrato de delegação: **objetivo, arquivos permitidos, limites, dependências,
aceite e formato de entrega**. Um worktree não é uma sandbox. Escrita paralela
em checkouts diferentes exige divisão explícita e integração cuidadosa; o
procedimento não concede autorização de commit, push, PR, deploy ou banco remoto.

## Carregamento dos perfis

Os TOML em `.codex/agents/` são descobertos pelo Codex em projeto confiável.
Selecione o tipo pelo nome do perfil quando a ferramenta oferecer `agent_type`.
`task_name` identifica a tarefa; não seleciona um perfil por si só.

Em um chat aberto antes desta configuração, a ferramenta pode ainda não expor
`agent_type`. Nesse caso, o coordenador lê o TOML, transmite explicitamente
`developer_instructions` na delegação e identifica o papel no nome da tarefa.
Esse modo usa as mesmas instruções, mas não comprova descoberta nativa do perfil.
Uma nova conversa carrega a configuração atual; conferir os tipos disponíveis
antes de afirmar ativação nativa. Não reiniciar o desktop durante outras tarefas.

Os agentes herdam as permissões do coordenador. O revisor atua sem escritas por
instrução; o perfil não cria uma sandbox isolada. Nenhuma configuração aqui
altera a confiança dos hooks, permissões da conta ou limites do Engineer remoto.

## Acompanhamento pelo Habblaud

Abra [Habblaud local](http://localhost:4747/) e a sala **Go Atleta**. Selecione
a conversa principal e expanda seus subagentes. Os personagens são apelidos de
sessões: confirme o projeto, pai e tarefa antes de interpretar o papel.

Perfis selecionados nativamente fornecem o papel técnico observado no ensaio
abaixo. No modo de leitura explícita, o painel pode mostrar `Default`: use o
prefixo do papel, como **Designer UI —**, **Marketing —** ou **Testes —**, nas
atualizações e confira a tarefa no terminal ao vivo. Não renomear uma sessão de
outra tarefa para simular um papel. Habblaud observa atividade; não gerencia locks
de arquivos ou Git.

Os exemplos **Joaquim — Designer UI** e **Bruna — Designer UX** expressam a
composição desejada, mas nomes fixos por especialidade não são configuração
suportada no Habblaud v1.0.3 inspecionado. `NameStore.assign` escolhe/preserva
apelidos por ID de sessão; o papel vem de `agent_role` e recebe apenas a primeira
letra maiúscula. **Editar personagem** é restrito ao agente principal; o servidor
recusa edição de subagentes. Assim, `goatleta_ui` identifica a especialidade real
mesmo quando o personagem recebe outro nome. Nenhum personagem foi renomeado.

Evidência local por leitura em 11/11/2026: instalação em
`%LOCALAPPDATA%/Habblaud/source`, arquivos `server/model/names.ts`,
`server/model/office.ts`, `server/sources/codex/rollout.ts`,
`server/sources/codex/source.ts`, `client/src/ui/character-model.ts` e contrato de
`PUT /api/agents/:id/character` em `server/README.md`. Fixar nomes por perfil
exigiria uma mudança no Habblaud, fora desta configuração da equipe.

Para iniciar nesta máquina:

```powershell
& "$env:LOCALAPPDATA\Habblaud\Start-Habblaud.ps1" -Open
```

**Reinício do Windows:** a escolha automática de especialistas pelo Codex não
inicia o servidor do Habblaud. Em 12/11/2026, após reinício, a porta 4747 estava
sem listener e não havia startup do painel. O usuário escolheu início no login
em segundo plano, sem abrir navegador. Foi preparado
`%LOCALAPPDATA%/Habblaud/Manage-Startup.ps1` (`status`, `install`, `uninstall`):
atalho `Habblaud.lnk` na pasta Startup do usuário, Windows PowerShell estável,
janela oculta e launcher existente sem `-Open`; sem admin, bypass ou alteração
de hooks/permissões. Uninstall local passa a remover seu próprio atalho.

A revisão automática bloqueou o comando de instalar/iniciar antes da execução,
informando apenas bloqueio de política. Leitura posterior: atalho ausente e
servidor parado. Sintaxe e revisão por leitura conferidas; ativação, saúde,
idempotência em execução e próximo login permanecem pendentes. Para o usuário
ativar manualmente no PowerShell, conforme sua preferência já expressa:

```powershell
& "$env:LOCALAPPDATA\Habblaud\Manage-Startup.ps1" -Action install
& "$env:LOCALAPPDATA\Habblaud\Start-Habblaud.ps1"
```

Hooks e mensagens continuam funcionando com acesso completo. Um aviso nativo de
aprovação depende de uma ação que realmente peça autorização; para testar isso,
usar **Solicitar aprovação** no Codex. O usuário decide. O hook espera até 25 s
e então retorna ao mecanismo nativo. Não registrar eventos sintéticos como prova.

## Obsidian como registro da equipe

Nesta máquina: `C:/Users/10for/OneDrive/Documentos/Obsidian Vault`, nota
`10 Projetos/Go Atleta/Equipe de agentes.md`. O painel contém papéis, links,
modelo de tarefa e resultados resumidos. Código, documentos e checklist da branch
continuam sendo a fonte técnica. O cofre não inicia agentes nem acompanha
execuções automaticamente; o coordenador atualiza o registro ao fechar a tarefa.

Registrar apenas objetivo, estado, responsáveis, decisões, arquivos/revisão,
checks realmente executados e pendências. Não copiar conversas completas,
credenciais, logs autenticados, dados de atletas ou screenshots privados ao cofre.
Em outra máquina, descobrir o caminho local antes de escrever; sem cofre,
guardar a entrega no repositório e informar a pendência. OneDrive não comprova
sincronização concluída nem Obsidian Sync ativo.

## Validação e limites

Configuração local e instruções: validação de formato, referências, geração e
diff, mais ensaio delimitado de delegação. Usar também a skill
`goatleta-testing`; não iniciar Expo nem executar release do produto por hábito.

O ensaio de instalação e a descoberta nativa devem ser registrados separadamente.
Não confundir esta equipe de subagentes locais com os agentes persistentes do
**Go Atleta Engineer**: executor remoto, orçamento, BUDGET_GATE, decisões humanas
e autorização de integração continuam regidos pelos documentos próprios.

### Ensaio local de 11/11/2026

- Quatro TOML parseados com Python/tomllib: três nomes únicos, campos obrigatórios,
  limite de três e nenhum override de modelo/esforço/permissões.
- 22 referências locais resolvidas; diff sem erros de whitespace. Checklist
  regenerado após atualização dos itens desta equipe, preservando IDs existentes.
- Três subagentes reais receberam explicitamente os perfis: implementação criou
  a nota do Obsidian; revisão inspecionou o pacote sem achados; testes executou
  as verificações documentais. Habblaud exibiu os três ligados ao coordenador,
  com papéis `Default` neste chat anterior à instalação; captura local privada.
- Nota **Equipe de agentes** criada e vinculada ao painel **Go Atleta** do cofre.
  Formato e referências conferidos por leitura. A inspeção visual da conta e do
  aplicativo Obsidian não foi autorizada pelo controle de acesso; não houve
  autenticação, instalação de plugin, configuração de Sync ou contorno por UI.
- Uma verificação Python adicional do cofre foi rejeitada antes da execução;
  não foi repetida. Leitura existente e destinos explícitos sustentam somente
  a validação documental, sem alegar renderização ou sincronização.
- Pendente naquele ensaio: comprovar seleção nativa por `agent_type`; resolvida
  na verificação abaixo. Nenhum teste do produto, publicação ou executor remoto
  foi iniciado.

### Seleção nativa confirmada em 11/11/2026

Nova conversa, ensaio iniciado às 10:57 (America/Sao_Paulo), Codex Desktop com
runtime `0.167.0-alpha.4.1`. A ferramenta real `collaboration.spawn_agent`
expôs `agent_type` e os três perfis; cada chamada selecionou seu tipo, sem copiar
as instruções do TOML como fallback e sem alterar configuração ou confiança.

| Tarefa | `agent_role` nos metadados | Apelido Codex | Nome e papel exibidos no Habblaud |
| --- | --- | --- | --- |
| `/root/nativo_implementacao` | `goatleta_implementacao` | Kant | Isabela — `Goatleta_implementacao` |
| `/root/nativo_revisao` | `goatleta_revisao` | Hypatia | Kátia — `Goatleta_revisao` |
| `/root/nativo_testes` | `goatleta_testes` | Poincare | Vicente — `Goatleta_testes` |

- Metadados reais dos rollouts locais: `session_meta.agent_role` e
  `source.subagent.thread_spawn.agent_role` coincidiram com os tipos solicitados;
  os três `parent_thread_id` apontaram para esta conversa, com `depth = 1` e
  os caminhos de tarefa acima. IDs e logs completos não são copiados ao cofre.
- Os `turn_context` dos filhos e do coordenador registraram o mesmo modelo
  `gpt-6-astra`, esforço `ultra`, `approval_policy = never` e sandbox
  `danger-full-access`. Isso confirma a herança observada; revisão somente por
  leitura continua sendo instrução, sem isolamento adicional.
- A interface do Habblaud v1.0.3 em `http://localhost:4747/` mostrou a sala
  **Go Atleta**, coordenador **Ricardo** e os três subagentes aninhados sob ele,
  com os nomes/papéis da tabela. Conferência pela árvore de acessibilidade da
  página conectada; os apelidos Codex e Habblaud são diferentes. Não houve
  renomeação nem eventos simulados.
- Implementação mapeou configuração e referências; Revisão conferiu limites e
  herança sem achados acionáveis; Testes validou quatro TOML, três nomes únicos,
  campos obrigatórios, limite três e ausência de overrides. O recorte atual
  resolveu oito links Markdown locais do guia; os 22 do ensaio anterior são
  evidência histórica de outro recorte. Todos atuaram somente por leitura.
- Validação documental: checklist regenerado, títulos/IDs e armazenamento de
  revisão pessoal preservados; referências e diff conferidos. Resumo da equipe
  atualizado no arquivo local do Obsidian, sem acessar sua interface.
- Pendências deste escopo: nenhuma para seleção nativa e exibição dos papéis.
  O ensaio não testa bloqueio de um quarto subagente, carregamento em outra
  máquina ou persistência após reinício. Obsidian UI, conta e Sync continuam
  sem validação. Sem commit, push, worktree, publicação, app ou Engineer remoto.

### Expansão por especialidades em 11/11/2026

Treze perfis novos ampliam o catálogo para 16. Os três TOML originais e
`.codex/config.toml` permanecem preservados; a equipe continua com até três
subagentes simultâneos. O catálogo acima define acionamento, entregas e fronteiras.
Nenhum especialista recebe novo modelo, permissão ou fornecedor.

Validação documental final: 17 TOML válidos (configuração + 16 perfis), nomes
únicos iguais aos arquivos e campos exatos sem overrides. SHA-256 da configuração
e dos três perfis originais idênticos ao baseline desta etapa. Resolvidos 71
links Markdown locais dos documentos e 68 referências explícitas dos perfis
(18 destinos únicos). Revisão independente sem achados; checks Python inline
com exit 0. Checklist regenerado: 29 módulos, 380 itens, 124 rotas; três detalhes
atualizados e um item de pendência acrescentado, preservando títulos/IDs anteriores
e armazenamento da revisão pessoal. `git diff --check` passou. Sem testes do app.

A evidência de seleção nativa da seção anterior vale para os três perfis
originais. Para os 13 novos, conferir a disponibilidade de `agent_type`, executar
uma tarefa curta de seu recorte e confrontar `agent_role`, pai e papel exibido no
Habblaud antes de declarar ativação validada. Arquivo TOML válido e instrução
transmitida manualmente não substituem essa prova. Não reiniciar desktop/daemon
nem abrir outra conversa automaticamente para atualizar o catálogo.

Na rodada de criação dos arquivos, a tentativa de `spawn_agent(agent_type="goatleta_ui")`
retornou `unknown agent_type 'goatleta_ui'`: a conversa continuou com o catálogo
dos três perfis originais. Nenhum especialista foi criado por essa chamada;
não houve fallback manual. A configuração dos 13 arquivos está concluída, mas
seu ensaio nativo e exibição no Habblaud permanecem pendentes em conversa que
carregue os novos tipos. Em turno posterior de 11/11/2026, o schema real da
ferramenta passou a anunciar os 16 perfis nesta conversa, também observado pelo
revisor. Isso comprova disponibilidade anunciada; criação nativa e exibição dos
13 novos no Habblaud ainda dependem de ensaio executado.

Exemplos de pedido: “Arrume este modal”; “Monte o plano de lançamento”; “Prepare
rascunhos para redes sociais”; “Analise este funil”. O coordenador escolhe as
especialidades da tabela, seleciona os tipos técnicos e distribui as etapas.
O usuário pode indicar funções se quiser, mas isso não é requisito de acionamento.

Fontes: [subagentes do Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents),
[AGENTS.md](../../AGENTS.md), [validação](validation-ladder.md),
[seleção de skills](agent-skills.md), [supervisão do Engineer](engineer-supervision.md).
