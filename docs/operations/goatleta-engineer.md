# Go Atleta Engineer — execução controlada

Ferramenta local de engenharia; não altera o runtime do produto. O controlador prepara arquivos selecionados e conversa com a Agents API. O executor trabalha em um container dedicado. A imagem local foi construída e a proteção de leitura testada. Credenciais próprias foram criadas com autorização em 01/10/2026; o primeiro teste real está registrado no relatório da execução.

Controles atuais de benchmark, aprovação humana, mounts por arquivo, orçamento e traces: [integração supervisionada](engineer-supervision.md).

Agentes persistentes, modos financeiros e doctor de prontidão: [Agent Launch Pack](engineer-launch-pack.md). Nenhuma ativação remota nesta entrega.

## Credenciais e limites

- `OPENAI_API_KEY`: somente no controlador, com `api.agents.read`, `api.agents.write` e `api.responses.write`.
- `OPENAI_EXECUTOR_API_KEY`: chave de ambiente criada na plataforma, da mesma organização/projeto/proprietário da sessão; demais permissões em None. O provisionador a transmite ao container exclusivamente como `CODEX_API_KEY`.
- Não usar credenciais de produção, colar chaves no chat ou gravá-las no repositório. O CLI não lê `.env.local`. `doctor` mostra apenas presença/ausência.
- O código executado pode ler a chave restrita do executor. Administradores do Docker também podem inspecioná-la. O controlador não imprime o ambiente ou o inspect completo.

O pacote é privado e fica em `.tmp/engineer-runs/ID`. Inclui só arquivos explícitos, até seis skills locais e perfis. Não inclui `.git`, dependências ou o catálogo pessoal. Há triagem básica de credenciais, não uma auditoria exaustiva. O texto da tarefa também precisa estar livre de dados privados desnecessários.

## Primeiro ciclo: somente leitura

```powershell
python scripts/goatleta-engineer.py doctor
python scripts/goatleta-engineer.py prepare "Revisar o roteador sem editar arquivos e executar as validações dos requirements." --model gpt-6-astra --profile router --read-only --subagents 0 --skill goatleta-security --skill goatleta-testing
python scripts/goatleta-engineer.py verify .tmp/engineer-runs/ID
python scripts/goatleta-engineer.py stage .tmp/engineer-runs/ID
python scripts/goatleta-engineer.py create .tmp/engineer-runs/ID
```

`prepare` usa leitura e zero subagentes por padrão. `--read-only` torna a intenção explícita. `bundle/` é a referência imutável; `runtime/` é a cópia de execução. `stage` nunca sobrescreve uma cópia existente. O modelo é uma escolha explícita para engenharia, não uma troca no produto.

Construção da imagem (sem credenciais ou fontes do projeto no contexto):

```powershell
docker build --tag goatleta-engineer-runtime:v1 docs/operations/engineer
$engineerImage = docker image inspect --format '{{.Id}}' goatleta-engineer-runtime:v1
python scripts/test-engineer-docker.py --image $engineerImage
python scripts/goatleta-engineer.py preflight .tmp/engineer-runs/ID --image $engineerImage
```

O Dockerfile instala os certificados CA, fixa o digest do Node e `@openai/codex@0.161.0-alpha.11`, desabilita scripts npm e verifica `exec-server --help`. O provisionador exige ID sha256 local, usa `--pull=never`, usuário 1000, root filesystem somente leitura, capabilities removidas, limites de memória/CPU/processos, tmpfs e nenhum socket Docker ou diretório pessoal montado. Capabilities e perfis sempre são somente leitura; `/workspace` também no primeiro ciclo. A imagem v1 inclui Python 3.12, Node 22, Git, ripgrep e certificados CA.

Com as credenciais presentes, o teste pela API já autorizado segue:

```powershell
pwsh -NoProfile -File scripts/goatleta-engineer-local.ps1 create .tmp/engineer-runs/ID --live
pwsh -NoProfile -File scripts/goatleta-engineer-local.ps1 provision .tmp/engineer-runs/ID --image $engineerImage --live
pwsh -NoProfile -File scripts/goatleta-engineer-local.ps1 reconcile .tmp/engineer-runs/ID
```

`created_executor_not_started` e `started_not_connected` não comprovam conexão nem conclusão. `reconcile` consulta a sessão e pagina todos os turns/items, preservando os resultados em `history.json`. Repetir após a execução para obter o resultado durável; não há watcher infinito. `requires_action` lista a ação pendente; `environment_connection` é atendida pelo provisionamento explícito. Outras ações são registradas, nunca executadas automaticamente.

Após obter o turno raiz concluído e revisar a resposta:

```powershell
python scripts/goatleta-engineer.py teardown .tmp/engineer-runs/ID --live
python scripts/goatleta-engineer.py attest .tmp/engineer-runs/ID
python scripts/goatleta-engineer.py report .tmp/engineer-runs/ID
```

`teardown` confere nome e label de propriedade, remove somente o container da execução e preserva arquivos de evidência. Não exclui a sessão na API. Para interromper trabalho antes da conclusão, `cancel ID --live` solicita cancelamento do turno; ainda é preciso observar o estado e fazer teardown. Parar de consultar a API não desliga o container nem cancela o turno.

## Recuperação e relatório

A criação usa marcador exclusivo para impedir duplicação após timeout. Se a resposta se perder antes de salvar a sessão, localize o ID da sessão correspondente na plataforma e execute `reconcile ID --session-id sess_...`. Não apague marcadores para repetir criação. Uma sessão já vinculada não pode ser substituída. Falha de provisionamento também deixa marcador; após diagnosticar a falha e confirmar teardown, `provision --retry-after-teardown` permite conectar novamente a mesma sessão, arquivando o marcador anterior; o nome determinístico e a label permitem teardown mesmo se o controlador caiu antes de salvar o ID do container. Reiniciar uma execução ambígua requer investigação, não repetição automática.

`attest` compara hashes antes/depois e relata arquivos inesperados, excluídos, binários, links, arquivos excessivos e escritas esperadas ausentes. FAIL retorna código 1. PASS comprova somente o snapshot final do pacote, não detecta escrita transitória revertida nem ações de rede. Para uma atestação final, desligue primeiro o executor. `run-report.md` e `run-report.json` registram sessão, turns, modelo, skills selecionadas, subagentes observados, datas, uso informado pela API, arquivos e estado de atestação. Histórico bruto preserva mensagens e ferramentas para revisão.

O relatório conta comandos e falhas a partir dos itens persistidos, calcula duração dos turns e reconhece resultados unittest somente em comandos Python bem-sucedidos. A contagem é de execuções de testes, não de testes únicos quando há repetição. Uma skill só conta como aberta quando o comando bem-sucedido referencia seu caminho e a saída contém seu texto integral; os IDs de evidência são preservados. Isso comprova leitura, não compreensão. Campos sem evidência continuam `null`, inclusive custo; `null` não significa zero. Uso por sessão e por turno são apresentados separadamente, sem soma duplicada. O gateway de integração está implementado no controlador; não há teto financeiro remoto garantido nem filtro de saída de rede. Um teto estrito em dólares bloqueia novas sessões até existir enforcement compatível. Configure limites da conta; o Docker de execução permite rede de saída para conectar o executor. O smoke e o preflight locais usam `--network=none`.

## Runtime e preflight antes da API

O manifest v3 contém requisitos de Python >=3.12, Node >=22, comandos, arquivos e skills obrigatórios. `workspace/runtime/task-requirements.json` os torna legíveis para o agente. O perfil `router` inclui código, testes, configuração e um índice portátil de nomes/camadas; não copia todo o catálogo nem certifica sua instalação. O Python fica na imagem, nunca no bundle.

`preflight` prepara a cópia, verifica seus hashes e executa as validações em container sem rede, sem credenciais e com mounts somente leitura. Arquivo, skill, ferramenta ou teste ausente/falho produz `BLOCKED_RUNTIME`; o CLI retorna erro e `create --live` não chama a API. READY fica vinculado ao hash do manifest e ao ID imutável da imagem. Alterar o pacote exige nova preparação. A cópia de runtime é conferida novamente antes de criar a sessão. Tentativas ficam preservadas em `preflight-attempt-*.json`.

O provisionador injeta apenas as variáveis de tarefa previstas: `PYTHONDONTWRITEBYTECODE` e, no perfil router, `GOATLETA_SKILL_REGISTRY`. O segundo aponta para o índice portátil; o roteador continua usando o catálogo local quando essa variável não existe. O preflight executa os testes do roteador e uma seleção RLS; não executa a suíte completa do produto nem a auditoria das 853 raízes.

## Gates de aceitação

1. Conexão: prepare → verify → create → environment_connection → executor conectado → turno raiz concluído. Primeiro ciclo aprovado; ver evidência real.
2. Leitura com testes: Run 2 executou 23 testes, abriu as duas skills selecionadas, não alterou arquivos e terminou com teardown. Evidências no histórico abaixo.
3. Escrita mínima: sequência expressamente autorizada pelo usuário, Run 3 para uma frase e Run 4 para uma regra isolada. Usar `--allow-write caminho` para cada arquivo previsto. O provisionador atual monta `/workspace` somente leitura e sobrepõe apenas arquivos existentes autorizados como graváveis. `attest` continua conferindo o resultado; as runs 003/004 precederam esta proteção por arquivo. Revisar o diff e conferir o baseline local antes de integrar.
4. Especialistas: primeira tarefa preparada, ainda não executada. Gateway humano implementado e testado localmente; decisão humana real ainda não exercitada. Perfis não criam isolamento entre agentes; todos compartilham o mesmo filesystem.

Preflight e integração são bloqueantes em código. A revisão semântica pertence ao humano; `decide` registra decisão vinculada às evidências e `integrate` confere o baseline. Cenários sintéticos não contam como execuções reais. Commit, push, deploy e operações remotas no produto continuam dependendo de autorização própria. Ver [histórico das execuções e limites](engineer-run-history.md).

## Evidência local em 01/10/2026

- 38 testes offline de ciclo de vida, integridade, credenciais, paginação, relatórios e propriedade do container; quatro testes específicos do preflight.
- Imagem construída com Codex CLI e smoke Docker real aprovado: leitura funciona, criar/alterar/renomear/excluir é bloqueado, temporários funcionam, nenhuma chave presente.
- Chaves próprias autorizadas e guardadas com Windows DPAPI em `%LOCALAPPDATA%/GoAtletaEngineer/`, fora do repositório. Controlador com validade de um dia, Agents e Responses; executor restrito a conexão. Carregar somente no processo que invoca o CLI, sem gravar variáveis globais nem imprimir valores.
- Primeira sessão real: ver [evidência da execução](engineer-live-validation.md).

## Contratos consultados

- [Self-hosted e separação das chaves](https://developers.openai.com/api/docs/guides/agents-api/environments/self-hosted).
- [Reconciliação e required_actions](https://developers.openai.com/api/docs/guides/agents-api/sessions/manage).
- [Histórico, turns e uso best-effort](https://developers.openai.com/api/docs/guides/agents-api/observability).
- [Ciclo de vida do ambiente](https://developers.openai.com/api/docs/guides/agents-api/environments/lifecycle).

## Apoio do plugin OpenAI Developers

As skills `agents` e `openai-api-troubleshooting` apoiam contratos, diagnóstico e ciclo de vida. `openai-platform-api-key` oferece fluxo seguro para novas credenciais de aplicação; a chave de executor tem permissões específicas e usa o fluxo de ambientes. Preservar as chaves já autorizadas nesta execução, sem duplicá-las. O plugin não substitui autorização, sandbox, limites de gastos ou validação real.
