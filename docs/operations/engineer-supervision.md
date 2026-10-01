# Go Atleta Engineer — benchmark e integração supervisionada

Estado em 01/10/2026: controles locais implementados e testados; quatro runs remotas anteriores preservadas. Este pacote não libera autonomia adicional, produção ou novos gastos acima do teto autorizado.

## Benchmark histórico

`docs/operations/engineer/benchmark.json` contém 24 casos de 12 áreas, cada um com commit-base, commit de referência, arquivos, hash do diff e caminhos de testes presentes na referência. As tarefas foram reconstruídas a partir dos commits; não são tickets originais recuperados. Não são 24 runs executadas.

```powershell
python scripts/engineer_benchmark.py validate
python scripts/engineer_benchmark.py score --case GA-001 --report CAMINHO/run-report.json --review CAMINHO/revisao-humana.json
```

O coletor recusa run com commit-base diferente. Registra modelo, skills, subagentes, turns/duração, uso, custo quando conhecido, arquivos, testes e atestação. Qualidade semântica, regressões e correção humana não recebem nota automática: sem avaliação ficam `null`/`UNSCORED`. Arquivo humano exige `diff_quality`, `regressions`, `human_correction`, `reviewer` e `rationale`; registro não é autenticação do avaliador.

Antes de cada replay, revisar os critérios específicos e dependências no commit-base. Preparar snapshot desse commit com preflight próprio; não usar o checkout atual como se fosse histórico. Commit/patch de referência ficam apenas com o avaliador. Não enviar o gabarito ao implementation agent. Os testes do patch de referência podem atuar como testes reservados, após revisão, sem exigir igualdade textual da solução. Cobrir isolamento em SQL local quando pertinente, nunca aplicar migrations remotas.

Uma comparação útil conserva tarefa, snapshot, runtime e critérios, variando apenas modelo, skills ou especialista. Resultados sem testes suficientes permanecem incompletos. Não há execução em lote automática nem alegação de produtividade comprovada.

## Gateway de integração

```text
turno concluído + teardown
          ↓
atestação PASS + testes independentes PASS
          ↓
diff + hashes de candidato, manifest, histórico e validação
          ↓
WAITING_FOR_HUMAN
     ┌────┴────┐
  APPROVED  REJECTED
     ↓          ↓
integrate    bloqueado
```

```powershell
python scripts/goatleta-engineer.py validate-candidate .tmp/engineer-runs/ID
python scripts/goatleta-engineer.py review .tmp/engineer-runs/ID
# Os dois próximos comandos são ações humanas separadas, depois de ler as evidências:
python scripts/goatleta-engineer.py decide .tmp/engineer-runs/ID
python scripts/goatleta-engineer.py integrate .tmp/engineer-runs/ID
```

`validate-candidate` executa os comandos previstos em container separado, somente leitura, sem rede e sem chaves. O gateway exige resultado de cada comando, não aceita apenas uma frase do modelo. Os testes podem ter sido editados no candidato: a revisão humana deve conferir se continuam relevantes.

`decide` exige terminal interativo e digitação de `APROVAR <fingerprint>` ou `REJEITAR <fingerprint>`; não tem `--yes`. O agente não deve responder no lugar de Gustavo. Recusa redirecionamento de stdin. A decisão fica fora dos mounts do executor. Mudança em candidato, histórico ou evidência de teste invalida a aprovação. Não é permitido aprovar retrospectivamente a Run 4, que já havia sido integrada antes de existir este gateway; ela foi reutilizada apenas para provar os testes independentes e a geração do pacote de revisão.

`integrate` confere todos os baselines locais antes de escrever, recusa links, mantém backups, serializa integrações do controlador, registra tentativa e faz substituição atômica por arquivo. Falha de escrita tenta reverter arquivos já aplicados; queda do processo exige reconciliação manual. Não há atomicidade transacional entre vários arquivos. Rejeição preserva evidências e não integra; o container já foi removido no gate anterior.

Esta barreira é real no CLI e separada do executor, mas **não é uma fronteira contra o dono do Windows, administrador ou outro processo com o mesmo acesso aos arquivos**. Não há identidade humana autenticada por serviço separado. Não se deve afirmar que é impossível contorná-la no host. Um recibo JSON editável pelo mesmo usuário não equivale a uma assinatura de autoridade externa.

## Prevenção, detecção e aprovação

| Camada | Implementação | Limite |
| --- | --- | --- |
| Prevenção | Mount de workspace somente leitura; mounts graváveis somente dos arquivos autorizados | Arquivos existentes; renomear/substituir por rename e criar caminhos ficam bloqueados |
| Detecção | Hashes, links, arquivos extras, exclusões e atestação final | Não detecta escrita transitória revertida nem rede |
| Aprovação | CLI `decide` e `integrate`, com fingerprint e baseline | Não autentica o humano contra processos com o mesmo usuário do host |

Smoke Docker real confirmou escrita no arquivo permitido e bloqueio dos demais, de novos arquivos/diretórios, rename e exclusão. Editores que salvam por rename precisarão usar escrita in-place nos arquivos autorizados. Não ampliar mount de diretório para contornar esse limite.

Git de publicação e Supabase/produção não são ferramentas do controlador. Push, deploy, migrations remotas e service_role continuam proibidos no executor. O bundle não contém `.git` nem credenciais do produto. Não existe ainda gateway por comando de shell ou filtro de saída de rede do container; instrução de não conectar externamente não deve ser apresentada como firewall. A conexão do executor à OpenAI permanece parte do fluxo autorizado.

## Limites operacionais e US$ 5

Política local padrão: 300 mil tokens por turn, 500 mil tokens totais observados, quatro turns de agentes, um especialista, 40 comandos e 300 segundos de executor. Valores de tokens incluem categorias informadas pela API; não representam custo uniforme.

O limite de concorrência vai à API. O prazo do processo é imposto com `timeout` dentro do container. Comandos, número total de subagentes/turns e tokens são observados ao reconciliar: violação registra `BUDGET_GATE`, pede cancelamento, remove o container e bloqueia integração. Sem reconciliação ativa, esses limites observados não se aplicam em tempo real. Desligar o executor não garante interrupção imediata da inferência nem da cobrança.

Gustavo autorizou **até US$ 5 para um piloto**. O contrato público consultado não expõe um teto em dólares, max_output_tokens ou max_turns para criação de sessão Agents API. Uso pode chegar tardiamente. Não enviar campos inventados, não converter timeout em suposta garantia de custo e não tratar alertas de orçamento como bloqueio financeiro.

`prepare --max-cost-usd 5` registra o teto estrito; `create --live` produz `BUDGET_GATE` antes de qualquer chamada quando não há mecanismo capaz de garanti-lo. Teste real confirmou ausência de sessão/marcador de criação. Nenhuma nova sessão paga foi iniciada neste pacote. A autorização de US$ 5 permanece registrada; uma estimativa não a transforma em autorização para ultrapassar esse valor.

Preços padrão consultados: gpt-6-astra por milhão, contexto curto US$ 10 entrada / US$ 1 cache lido / US$ 12,50 escrita de cache / US$ 50 saída; contexto longo US$ 20 / US$ 2 / US$ 25 / US$ 75. Runs anteriores usaram tier `auto`; sem confirmar tier e todas as categorias, custo real continua desconhecido. Fonte: [preços oficiais](https://developers.openai.com/api/docs/pricing). Consultar novamente antes de cálculo financeiro.

## Especialista e traces

Run 005 preparada com um Test Review, todos em somente leitura, duas skills e preflight com 26 testes aprovado. ID local `0288729eb85a4353aec6c3b6fbc59122`; teto US$ 5, nenhuma sessão criada, `BUDGET_GATE`. A preparação anterior `96a87d2eb399449b9c9c56615cfc2262` foi marcada superseded e não deve ser executada. A Run 005 é um teste de coordenação, não um replay do dataset histórico.

O especialista deve revisar casos independentemente, e o coordenador deve esperar e incorporar sua resposta. Ambos somente leitura neste primeiro teste. A API compartilha o filesystem entre subagentes: para implementation gravável e reviewer fisicamente somente leitura, usar fases/ambientes separados. Perfis distintos no mesmo ambiente não garantem permissões distintas.

`traces ID` exporta todas as páginas disponíveis, com cursor, para `remote-traces.json` e `traces.otlp.json`. Acesso negado/indisponível é registrado, sem ampliar permissões. Exportação realizada com as credenciais existentes nas quatro sessões: um trace em cada. Arquivos privados ficam em `.tmp`; não são publicados nem enviados a observabilidade de terceiros. Report associa estado de exportação à sessão e aos turns do histórico. Exportação é snapshot, não assinatura de eventos futuros.

Fontes oficiais: [tracing da Agents API](https://developers.openai.com/api/docs/guides/agents-api/tracing), [multiagente e filesystem compartilhado](https://developers.openai.com/api/docs/guides/agents-api/multi-agent), [guardrails e aprovação humana](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals), [avaliações](https://developers.openai.com/api/docs/guides/agent-evals), [schema público de criação](https://github.com/openai/openai-python/blob/main/src/openai/types/beta/agents/session_create_params.py). A página de aprovação demonstra também o Agents SDK; este projeto manteve a Agents API e implementou a fronteira de integração no controlador local.

## Validação

98 testes offline: 38 de ciclo de vida, 22 controles/gateway/budget/traces/dataset, quatro preflight, 26 roteador e oito helpers. Validação por comportamento e cenários negativos, sem aprovar candidato real em nome do usuário. Docker real nos modos somente leitura e escrita por arquivo; candidato histórico com 26 testes independentes. Dataset: 24 referências e hashes conferidos. Sem testes do app, migração, commit, push ou deploy: esta alteração afeta somente ferramentas de engenharia.

## Preparação local posterior

Com bloqueio estrito reafirmado pelo usuário, foi concluída a [revisão local dos 24 casos e calibração GA-018](engineer-benchmark-readiness.md). Nenhuma nova sessão paga. Os resultados dessa calibração não entram como notas de qualidade do Engineer.
