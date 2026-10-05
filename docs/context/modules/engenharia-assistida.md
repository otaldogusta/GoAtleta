# Engenharia assistida e seleção de contexto

Referência inspecionada: `d5120cff`, 05/10/2026. [Índice e regra de leitura](../README.md).

## Responsabilidade e implementação atual

Ferramentas de desenvolvimento para selecionar skills, preparar pacotes limitados,
validar candidatos e supervisionar runs. Go Atleta Engineer não é o Assistente
do produto, nem concede acesso ao banco ou autorização para publicar.

| Entrada | Responsabilidade |
| --- | --- |
| [explain-skill-selection.py](../../../scripts/explain-skill-selection.py), [skill-routing.json](../../operations/skill-routing.json) | Sugestão limitada por impacto e registro de uso efetivo |
| [goatleta-engineer.py](../../../scripts/goatleta-engineer.py) | CLI de preparação e ciclo de execução |
| [engineer_preflight.py](../../../scripts/engineer_preflight.py), [engineer_runtime.py](../../../scripts/engineer_runtime.py) | Pré-condições e runtime dedicado |
| [engineer_review.py](../../../scripts/engineer_review.py) | Atestação, decisão humana e integração vinculada ao baseline |
| [engineer_budget.py](../../../scripts/engineer_budget.py), [engineer_launch.py](../../../scripts/engineer_launch.py) | Políticas de uso e bloqueio financeiro |
| [engineer_vnext.py](../../../scripts/engineer_vnext.py), [engineer_ui_runtime.py](../../../scripts/engineer_ui_runtime.py) | Coordenação, evidência visual e runtime local |

## Contratos a preservar

- Até seis skills principais por etapa, sem mínimo: núcleo local, engenharia
  da tecnologia envolvida, auxiliares somente para necessidade concreta. Registrar
  apenas uso real; sugestão automática não obriga abrir o catálogo.
- Ler helpers e dependências antes da primeira execução ou após mudança de versão.
  Skill instalada, hash aprovado e bundle preparado não autorizam execução remota.
- Pacotes precisam de arquivos autorizados, baseline, validação isolada,
  atestação e revisão humana. Não copiar candidato por fora de `integrate`.
- Não executar `decide` ou `confirm-platform-budget`, nem fabricar consentimento
  ou recibos em nome do usuário. Fixtures sintéticas não são runs reais.
- `strict` e `BUDGET_GATE` permanecem limites operacionais. Implementação de
  `platform-hard-limit` e autorização histórica de uma run não liberam outra.
- Papéis/contexto separado não criam isolamento de filesystem. Somente evidência
  de runtime demonstra as restrições efetivas.
- Captura pronta, aparência aprovada e revisão completa de UX são estados
  diferentes. Falta de evidência permanece `UNVERIFIED`.

## Decisões e fontes existentes

- [Agent skills](../../operations/agent-skills.md) e
  [governança](../../operations/skill-governance.md): seleção e ativação de skills.
- [Engineer](../../operations/goatleta-engineer.md) e
  [supervisão](../../operations/engineer-supervision.md): fluxo operacional.
- [Launch pack](../../operations/engineer-launch-pack.md): a seção de estado
  vigente relata Run 005 `FAIL_MULTI_AGENT` e bloqueio das novas execuções.
  Instruções cronológicas anteriores de preparação são histórico, não próximo passo.
- [vNext](../../operations/engineer/vnext.md) e
  [runtime visual](../../operations/engineer/ui-runtime-validation.md): implementação
  local/evidência datada. Nada nesta documentação reabre autorização financeira.

## Validação relevante

Há testes offline de [controle](../../../scripts/test-engineer-controls.py),
[launch](../../../scripts/test-engineer-launch.py),
[vNext](../../../scripts/test-engineer-vnext.py) e
[runtime UI](../../../scripts/test-engineer-ui-runtime.py). Não executados nesta
rodada documental. Escolher somente a suíte do contrato alterado, após revisar
seus efeitos. Testes offline não certificam Agents API, custo, isolamento real,
qualidade de revisão ou integração de um candidato.
