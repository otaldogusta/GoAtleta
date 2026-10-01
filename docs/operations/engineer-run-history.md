# Go Atleta Engineer — histórico real de validação

Evidências de 01/10/2026. Modelo `gpt-6-astra`, zero subagentes. Duração corresponde ao turno da API, não inclui preparação, preflight ou teardown. Os números de testes vêm da saída de comandos unittest concluídos, não do resumo do modelo.

| Run | Tipo | Turno | Arquivos alterados | Testes remotos | Comandos / falhas | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | Revisão somente leitura | 65s | 0 | Não executados | 9 / 4 | Aprovada com limitação de runtime |
| 002 | Leitura e testes do roteador | 74s | 0 | 23 | 13 / 0 | PASS |
| 003 | Uma frase da documentação | 42s | 1 esperado | 23 | 10 / 1 | PASS após revisão do diff |
| 004 | Validação de max_primary | 52s | 2 esperados | 26 | 11 / 1 | PASS após revisão e teste local |

Todos os quatro containers foram removidos; snapshots finais passaram na atestação. Nenhum commit, push, deploy ou acesso ao Supabase foi executado por estas runs. As sessões permanecem na API para auditoria.

## Pacote e runtime

Bundle: arquivos selecionados, configuração, índice portátil de skills, capabilities, profiles e requisitos. Imagem: Python 3.12.14, Node 22.23.3, Git, ripgrep, certificados CA e Codex CLI `0.161.0-alpha.11`. Python não é empacotado com a tarefa.

Imagem das runs 002–004: `goatleta-engineer-runtime:v1`, ID `sha256:4290f6c7b74916aa606dd5419848543896c1f4afbc30fb4398806e0be0daf121`. Bases do Dockerfile fixadas por digest; o registro do ID identifica os bytes efetivamente usados, sem prometer rebuild bit a bit dos pacotes apt.

O preflight executou 23 testes baseline e a consulta de seleção RLS antes de cada sessão. A tentativa com a imagem antiga sem Python foi bloqueada antes da criação da sessão. Preflight sem rede/chaves, somente leitura e vinculado ao manifest e à imagem. Não é a suíte inteira do app nem uma auditoria remota do catálogo instalado.

## Rastreabilidade

Artefatos privados em `.tmp/engineer-runs/<run>/`: `manifest.json`, `preflight.json`, `history.json`, `attestation.json`, `run-report.json`, `agent-response.md` e cópias baseline/candidata. Não publicar o histórico bruto indiscriminadamente.

| Run | ID local | Sessão |
| --- | --- | --- |
| 001 | fe144a6cd4394d11b5ef482d7d04f0bf | sess_023a282e2086586b006abe66824b28819cb8744ba8eab93a74 |
| 002 | 13297c3f668844f2a6977ea4e537de99 | sess_0f9723bb9144102b006abe6ce025f0819d90f0cb6550c0a83d |
| 003 | ea13a06ba7854af98321cf4dd24b8a66 | sess_0c3fbcf6d9facdf5006abe6d889e288192855ba51f68604f07 |
| 004 | 95de05665bbf4e479e94d7f0a5d12ab6 | sess_09ed7eb1bd165581006abe6ede76e0819faba4b3e0c45baeb4 |

Run 002: leitura comprovada de security/testing pelo item `exec_9f29d9c38d652ec9e649b5f0bda7b74d5df0f186420149f30c`; testes pelo item `exec_6d88004506f3a3ae55895334fb03cebee43af2433a9d5f06f5`.

Run 003: única alteração foi substituir a frase sobre imagem inicial pela descrição da v1, em `docs/operations/goatleta-engineer.md`. Comparação de bytes confirmou substituição exata; baseline local conferido antes da integração. Uma busca inicial com rg retornou 1, sem resultado; não afetou os testes, comprovados por `exec_d5cbe93ea7fc438f0d64cd40c51444d169e626e8728817f608`. Documentação foi ampliada localmente depois dessa integração, fora do escopo da run.

Run 004: três linhas na função `select` rejeitam max_primary ausente, booleano, não inteiro e fora de 1–6. Três testes novos cobrem inválidos e limites válidos. Somente `scripts/explain-skill-selection.py` e `scripts/test-skill-selection.py` mudaram no executor. Uma tentativa de `git status` falhou porque o bundle não contém `.git`; o agente recuperou-se por comparação direta. Testes remotos: `exec_3e1a5b9b5aaee349a3472cea3673c7094348260bf4ca80ea95`. Os 26 testes também passaram no host com o índice portátil, e novamente após integração com o catálogo local. Ambos os baselines locais conferidos antes de copiar os candidatos.

## Validação local e limites

76 testes aprovados: 38 do Engineer, quatro do preflight, 26 do roteador e oito dos helpers. Smoke da imagem v1 sem rede/chaves: usuário não root, escrita/criação/renomeação/exclusão bloqueadas, temporários permitidos. O índice portátil mantém a seleção equivalente ao catálogo local e rejeita schema inválido.

O início do histórico está validado, mas quatro tarefas não constituem benchmark representativo de produtividade. Uso total informado pela API: Run 001 130.888 tokens; Run 002 157.261; Run 003 103.839; Run 004 135.098. Incluem cache conforme os relatórios; não são todos tokens cobrados à tarifa integral. Custo financeiro permanece desconhecido, sem estimativa inventada.

`quality_gate: pending_human_review` permanece no relatório automático: a revisão do agente controlador documentada aqui não substitui aprovação humana nem um gateway implementado. A allowlist de escrita é auditada no final, não imposta por arquivo no mount gravável. Atestação não detecta escritas transitórias revertidas nem ações de rede. Coordenação de especialistas, orçamento automático, filtro de saída de rede e gateway humano continuam fora da validação feita. Nenhuma liberação para produção.
# Run 005 — 01/10/2026: concluída, gates pendentes

## Auditoria offline posterior — sem novas chamadas pagas

Os traces exportados esclarecem a soma: span `af496076c0195f2f` atribui ao Coordinator 446.993 tokens de entrada + 3.832 de saída = **450.825** diretos. Span `57a35625db132b0f` atribui ao especialista 261.950 + 2.739 = **264.689**. Total **715.514**, igual ao agregado da sessão. O valor 980.203 da primeira reconciliação duplicava o especialista e está corrigido no relatório. O agregado inclui 632.459 tokens de entrada em cache, 76.484 de entrada sem cache e 6.571 de saída; tokens não são dólares. Ambos os critérios locais continuam excedidos: total >500.000 e Coordinator direto >300.000. A avaliação genérica preserva o maior uso reportado por turn, que pode incluir descendentes, e documenta essa limitação.

O budget agora prefere o agregado reportado pela sessão, sem acrescentar os turns dos filhos; na ausência dele usa soma conservadora com possível sobreposição explicitamente marcada. Valores inválidos não viram zero, e agregado inferior a um turn conhecido não reduz silenciosamente o uso observado. O registro anterior foi preservado em `budget-result-before-usage-audit.json`; nenhuma autorização/gate foi removido.

Os dois spans de espera (`d62c4adcf0e90aa6` e `255390f202f7f821`) contêm argumentos reais `{"agent_ids":[]}`. Portanto, não foi apenas omissão da listagem REST: o alvo estava vazio também na chamada registrada pelo trace. As duas esperas existiram e duraram aproximadamente 10s e 2,45s, mas não demonstram destinatário explícito. O relatório agora preserva os IDs dessas chamadas em observed_wait_item_ids/unattributed_wait_item_ids e informa WAIT_TARGET_NOT_PROVEN. Mantido FAIL_MULTI_AGENT; delegação, execução independente e incorporação seguem comprovadas. Não se mudou o critério para obter aprovação retrospectiva.

Validação offline desta correção: **85 testes PASS** (40 controlador, 23 controles e 22 launch), sem API, novo executor, sessão ou alteração dos perfis remotos. O gasto de US$ 1,91 permanece a observação anterior do painel, não uma nova consulta nem fatura final. Antes de qualquer futuro piloto, reduzir contexto/probes redundantes e instruir o coordenador a esperar pelo ID explícito do filho; exigir nova autorização de execução.

### Registro inicial (valores corrigidos na auditoria acima)

Executada uma única sessão após recibo humano de platform-hard-limit US$ 10: `sess_0f214fc00155dd84006abe8e41207c819ea24b3c403c55e5b1`, pacote `1c143e38ca0141e589f6b08056a822f5`. Coordinator persistente registrado; um subagente Test Review (`subagent_44173bf4cbee1d3fc3dbfb08452f6733`) confirmado pela API de subagentes. Não inferir que o saved ID Test Review foi selecionado no spawn.

- Coordinator concluído em 123 segundos; especialista em 66 segundos, com histórico próprio recuperado.
- 21 comandos observados, dois com falha no Coordinator. 26 testes unittest executados por cada agente: 52 execuções, não 52 testes distintos.
- Ambas as skills incluídas abertas; revisão final incorporou os 22 probes e cinco cenários de main() do especialista, suas limitações e o achado de mensagens fixas em seis para max_primary menor. Nenhuma correção do roteador aplicada.
- Zero alterações no snapshot final; atestação PASS e container removido. Sessão idle; nenhum replay, Run 006, push, deploy ou acesso Supabase.
- Gate operacional BUDGET_GATE: Coordinator/usage da sessão reporta 715.514 tokens (632.459 de entrada em cache), especialista 264.689; soma conservadora dos turns 980.203. Não somar esse agregado novamente ao uso da sessão nem convertê-lo em custo real. Limites locais de tokens foram excedidos e detectados na reconciliação, após conclusão.
- Painel Limits do projeto dedicado mostrou **US$ 1,91 / US$ 10,00** após a execução; antes mostrava US$ 0. Valor contabilizado no projeto naquele momento, sujeito a atualização, não fatura definitiva nem custo por sessão fornecido pela API.
- Duas chamadas wait_for_subagents_call concluídas vieram com recipient_agent_ids vazio. Delegação, conclusão independente e incorporação estão comprovadas, mas o gate estrutural estrito mantém FAIL_MULTI_AGENT por não comprovar o destinatário da espera. Não relaxar esse gate para produzir PASS. coordination-review.json contém avaliação positiva de incorporação ligada ao hash do histórico.

Fechamento corrigiu dois defeitos locais observados: aceitar resposta vazia de sucesso apenas no POST de eventos, e recuperar turns/items por `/subagents/{id}` na reconciliação. A listagem principal não incluía o especialista. Evidência e contrato: [Multi-agent](https://developers.openai.com/api/docs/guides/agents-api/multi-agent) e [SDK oficial](https://github.com/openai/openai-python/tree/main/src/openai/resources/beta/agents/sessions/subagents). 40 testes focados do controlador passaram. Traces exportados; evidências privadas em `.tmp/engineer-runs/1c143e38ca0141e589f6b08056a822f5/`. Custo da API continua null no relatório; screenshot do gasto do projeto em `.tmp/engineer-run005-spend.png`.
