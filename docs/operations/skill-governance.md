# Governança de skills — Go Atleta

Disponibilidade não implica seleção, substituição da stack ou autorização de execução. Novas instalações ficam suspensas até uma solicitação concreta. Esta governança orienta o agente no projeto; não altera o mecanismo global de descoberta do Codex nem desabilita instalações pessoais.

## Três camadas

| Camada | Conteúdo | Critério |
| --- | --- | --- |
| Core Go Atleta | Dez skills em `.agents/skills/`, com extensões especializadas em `.codex/skills/` | Preferência para arquitetura, domínio, UX, dados, segurança e regras do produto |
| Trusted engineering | Expo, Supabase, Playwright, GitHub, React Native, composição e testes pertinentes | Tecnologia efetivamente envolvida; “trusted” é prioridade de seleção, não aprovação irrestrita de helpers |
| Catálogo auxiliar | Demais skills do manifesto | Necessidade concreta identificada; nunca carregar por afinidade vaga |

O núcleo mantém os nomes reais `goatleta-volleyball-domain` e `goatleta-courtside-ux`; não criar aliases duplicados para os nomes ilustrativos. A [matriz](agent-skills.md) continua sendo a referência de impacto e a [escada](validation-ladder.md), a de validação.

Regras locais precedem recomendações genéricas sobre o produto, respeitando instruções do usuário e de maior prioridade. Uma skill de Prisma, AWS, Azure ou outro framework não justifica adoção dessa tecnologia. Migração arquitetural precisa fazer parte da tarefa autorizada.

## Roteamento explicável

```powershell
python scripts/explain-skill-selection.py "Corrigir isolamento de workspace no scouting"
python scripts/explain-skill-selection.py "Corrigir convite de professor no fluxo web" --json
python scripts/explain-skill-selection.py "Investigar a rotina" --area database
python scripts/explain-skill-selection.py "Avaliar propriedades do parser" --include property-based-testing
```

O [registro de regras](skill-routing.json) é pequeno, versionado e independente das descrições de centenas de skills. A recomendação usa termos delimitados, normalização de acentos e áreas confirmadas pelo agente. Não interpreta toda a linguagem natural, negações ou intenção; a leitura do código e a matriz podem corrigir a sugestão. `--area` informa impacto confirmado, não autorização para executar ações.

Selecionar no máximo seis skills principais **por etapa**, sem completar uma cota mínima. Mudanças pequenas podem usar uma ou duas. Quando houver candidatas excedentes, a saída marca `requires_staging: true` e `needs_inspection: true`. Se o trabalho exigir mais, dividir em etapas coerentes e registrar a justificativa; não omitir revisão necessária apenas para cumprir o limite.

`SELECTED` explica as áreas que motivaram cada sugestão. `REJECTED` contém candidatas excedentes. Skills sem relação ficam **não consideradas**; o comando não inventa nomes como `aws-database` nem afirma ter auditado e rejeitado o catálogo inteiro. Catálogo auxiliar entra via `--include` após justificar a necessidade. O argumento precisa corresponder a uma skill registrada.

`expo` é uma referência ao provedor: resolver a skill específica disponível no turno e ler apenas a pertinente. O roteador não comprova instalação, disponibilidade no turno ou leitura de uma skill. Ele não executa helpers, shell, rede ou instalação.

## Métricas reais

Depois do trabalho, registrar somente skills realmente lidas/utilizadas, inclusive quando a escolha final diferir da sugestão:

```powershell
python scripts/explain-skill-selection.py "Corrigir isolamento de workspace no scouting" --record-used goatleta-security goatleta-data-model goatleta-testing supabase:supabase
python scripts/explain-skill-selection.py --metrics
```

O comando normal não grava nada. `--record-used` acrescenta um evento local em `.tmp/skill-selection/events.jsonl`, ignorado pelo Git, sem o texto da tarefa, caminhos de arquivos, dados do produto ou credenciais. Conta candidatas das regras, sugestões, uso efetivo, locais e externas; não usa 853 como número fictício de candidatas de toda tarefa. Uma chamada representa uma etapa concluída; evitar registrar a mesma etapa novamente.

As métricas são declarações do agente, não telemetria automática de invocações do Codex. Revisar frequências após 20–30 tarefas reais; testes do roteador usam arquivos temporários e não contam como uso de desenvolvimento. Os logs pessoais não acompanham a sincronização do repositório.

## Execução de helpers

Ler o `SKILL.md` selecionado e revisar o helper antes da primeira execução ou quando sua versão mudar. Conferir dependências relevantes, argumentos, arquivos alterados, operações Git, destinos de rede, tokens, acesso a Supabase, processos shell e instalações. A verificação por hash demonstra integridade em relação ao manifesto, não segurança do código.

Reutilizar uma revisão registrada para a mesma versão; não repetir pedidos de autorização já concedida nem exigir aprovação para toda leitura local. A execução deve ser necessária à tarefa e compatível com sua autorização e com as permissões do ambiente. Instalar uma skill não autoriza publicação, mensagens externas, alteração de credenciais ou gravação remota.

## Validação desta camada

21 testes focados aprovados, incluindo uma matriz de 16 cenários: `python scripts/test-skill-selection.py`. Eles verificam isolamento, convites, alterações cosméticas, planejamento, limite, seleção auxiliar explícita e separação entre sugestão e uso. Não são prova de seleção semântica perfeita nem substituem avaliação em tarefas reais.

A validação ampliada e os defeitos corrigidos estão em [skill-governance-validation.md](skill-governance-validation.md).
