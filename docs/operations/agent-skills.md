# Skills de desenvolvimento do Go Atleta

Preparação local em 01/10/2026, baseada no checkout `924970c8`. As skills orientam o Codex; não são funcionalidades carregadas automaticamente pelo assistente dentro do aplicativo.

A [governança em três camadas](skill-governance.md) define precedência local, seleção de até seis skills por etapa, explicação pelo roteador e métricas de uso real. Helpers externos exigem revisão de execução compatível com o escopo; integridade por hash não substitui essa revisão.

## Skills do repositório

| Skill | Usar para |
| --- | --- |
| [goatleta-feature-workflow](../../.agents/skills/goatleta-feature-workflow/SKILL.md) | Coordenar seleção de skills, implementação e validação em mudanças entre áreas |
| [goatleta-architecture](../../.agents/skills/goatleta-architecture/SKILL.md) | Fronteiras entre rotas, aplicação, domínio e infraestrutura |
| [goatleta-security](../../.agents/skills/goatleta-security/SKILL.md) | Autorização e testes negativos dos fluxos alterados |
| [goatleta-database](../../.agents/skills/goatleta-database/SKILL.md) | Migrations, RPCs, compatibilidade e validação SQL |
| [goatleta-data-model](../../.agents/skills/goatleta-data-model/SKILL.md) | Entidades, vínculos e preservação de histórico |
| [goatleta-design-system](../../.agents/skills/goatleta-design-system/SKILL.md) | Tokens, identidade e encaminhamento aos padrões existentes |
| [goatleta-testing](../../.agents/skills/goatleta-testing/SKILL.md) | Validação proporcional, SQL e browser |
| [goatleta-periodization](../../.agents/skills/goatleta-periodization/SKILL.md) | Ciclos, planejamento e Aula do Dia |
| [goatleta-volleyball-domain](../../.agents/skills/goatleta-volleyball-domain/SKILL.md) | Scouting, quadra, rotações e semântica esportiva |
| [goatleta-courtside-ux](../../.agents/skills/goatleta-courtside-ux/SKILL.md) | Acessibilidade e operação na quadra |

As nove skills em `.codex/skills/` foram preservadas. Em particular, `goatleta-web-ui` continua sendo o guia operacional de web e formulários, e as skills documentais continuam responsáveis pela ingestão, reconciliação e aplicação confirmada de documentos. Os caminhos nos novos `SKILL.md` partem da raiz do repositório.

O Codex pode selecionar as skills pela descrição; para pedir explicitamente, usar, por exemplo, `$goatleta-testing`. A descoberta das novas instalações deve ocorrer no próximo turno. Nenhuma skill exige carregar o catálogo inteiro. As regras de `AGENTS.md` e a escada canônica de validação continuam válidas.

## Matriz de acionamento

Usar `goatleta-feature-workflow` para coordenar features/correções entre áreas. Selecionar as demais pelo impacto observado, não por ocorrência de palavras. Os nomes curtos abaixo têm prefixo `goatleta-`, exceto Expo, Supabase e `playwright-cli`. Consultar apenas as referências necessárias de cada skill.

| Alteração real | Skills a selecionar | Condições e validação |
| --- | --- | --- |
| Tela ou componente novo | design-system, courtside-ux, architecture | Acessibilidade básica em qualquer tela; regras de quadra nas superfícies operacionais. Nível 2 para interação local; nível 3 se houver rota, dados ou fronteira arquitetural |
| Migration, tabela ou RPC | database, data-model, security, testing; Supabase no trabalho com o fornecedor | Nível 3; integração/SQL e escopo organizacional pertinentes; aplicação remota é separada |
| RLS/autorização | security, database, testing; Supabase | Nível 3; ator permitido, negado e outra organização, sem depender só de mocks ou checks estáticos |
| Aula do Dia/planejamento | periodization; architecture para regras/casos de uso; volleyball-domain para semântica esportiva | Nível 2 ou 3 segundo persistência/contratos. Para layout, design-system e courtside-ux; mudança cosmética isolada permanece nível 1 |
| Scouting | volleyball-domain, data-model, testing | Para alteração de registros, métricas e contratos: nível 3; incluir security/database se mudar persistência/acesso. Copy ou estilo isolado usa design-system e nível 1 |
| Login, convite ou permissões | security, testing; database quando o backend/contrato de acesso mudar | Nível 3 para autenticação/autorização; usar playwright-cli ao exercitar o fluxo web. Mudança cosmética não aciona esse pacote |
| Feature entre várias áreas | architecture, testing e domínio correspondente | Nível 3 para fluxos integrados; adicionar segurança, banco e UI apenas onde afetados |
| UI nativa Expo | skill Expo pertinente, design-system, courtside-ux | Nível 2 para interação, nível 3 para dados/rotas. Dependências, configuração ou bundling podem exigir build. Browser não comprova comportamento nativo |

Os níveis remetem à [escada canônica](validation-ladder.md), que define os checks obrigatórios. A matriz não duplica nem relaxa essa regra. Publicação autorizada usa nível 4. Uma revisão de segurança focada é necessária quando o diff afeta dados/permissões; não equivale a acionar todos os plugins de auditoria.

Se uma skill externa não estiver disponível no turno, verificar a instalação e usar as fontes/ferramentas existentes quando suficientes, relatando o limite. Não declarar que uma skill foi carregada sem lê-la, nem instalar duplicatas automaticamente. Expo não aparece em todo catálogo de sessão apenas por estar instalado.

## Ensaio de triagem dos três exemplos

Revisão de mesa em 01/10/2026: os resultados abaixo definem o comportamento esperado e foram confrontados com a matriz e os contratos locais. Não são execuções independentes de agente nem testes E2E; comprovação comportamental requer uma tarefa concreta e registro das decisões efetivas.

| Pedido de exemplo | Seleção e primeira investigação | Critério de validação |
| --- | --- | --- |
| “Adicione um novo campo na ficha do atleta.” | architecture, data-model, database, security e testing se o campo for persistente; design-system para o formulário. Investigar `src/core/models.ts`, `src/db/row-types.ts`, `src/db/students.ts` e migrations. Perguntar nome, tipo, finalidade e quem pode ver/editar, quando não inferíveis | Nível 3 para persistência: round-trip, compatibilidade com registros antigos, autorização e outra organização. Não criar uma coluna arbitrária só para testar skills |
| “Melhore a tela Aula do Dia.” | design-system, courtside-ux e periodization para preservar contexto; architecture se mudar composição/caso de uso. Inspecionar `src/screens/session/` e referências visuais; identificar um problema concreto antes de editar | Nível 1 se cosmético, 2 se interação, 3 se plano/persistência. Conferir fluxo local e preservar planos/overrides. Voleibol só entra se mudar semântica esportiva |
| “Corrija uma falha em convite de professor.” | security, testing e database ao rastrear backend/RPC; playwright-cli quando chegar ao exercício web. Localizar o fluxo com busca por convite/professor e reproduzir o defeito; pedir sintoma/passos se não houver evidência suficiente | Nível 3: regressão reproduzível, convite permitido, expirado/reutilizado e acesso de outra organização conforme o defeito. Não simular sucesso com sessão privilegiada nem resetar banco por padrão |

Para validar depois em tarefas reais, registrar: pedido concreto, skills efetivamente lidas e motivo, arquivos inspecionados, nível escolhido, ações realizadas, resultado dos checks e limites. Avaliar tanto omissões (não revisar autorização) quanto excesso (carregar banco por uma troca de cor). Esses registros devem refletir execução, não apenas repetir esta tabela.

Etapa seguinte concluída: [avaliação independente de triagem](agent-skills-evaluation.md) com três subagentes em contexto novo e um controle adicional de microajuste. Houve seleção contextual de skills e investigação de código; nenhuma funcionalidade foi implementada ou testada em runtime. Uma rodada contaminada pelo gabarito foi descartada e repetida.

## Ferramentas externas nesta máquina

Pacote ampliado: [instalação do catálogo completo](skills-package-review.md). As 194 entradas estão disponíveis, com 849 skills fixadas por hash e quatro instalações existentes preservadas. A matriz abaixo destaca o uso cotidiano no Go Atleta; disponibilidade não exige carregar o catálogo inteiro.

| Necessidade | Skill externa | Limite |
| --- | --- | --- |
| Diagnosticar FPS, renderizações, memória, bundle ou inicialização | `react-native-best-practices` | Medir antes/depois; adaptar ferramentas a Expo/Windows |
| Implementar ajuste específico de lista, imagem ou animação RN | `vercel-react-native-skills` | Preservar primitives; não virtualizar listas pequenas ou trocar bibliotecas por hábito |
| Refatorar API de componentes/composição | `vercel-composition-patterns` | Manter contratos; não reescrever hooks válidos apenas pela sintaxe |
| Testar round-trip, normalização e invariantes de domínio | `property-based-testing` | Propriedade real, sem dependência nova automática; não substitui testes de autorização |

| Componente | Estado verificado |
| --- | --- |
| Expo oficial | `expo@openai-curated` instalado e habilitado; revisão do marketplace `1dc19589`, manifesto 1.0.2 |
| Supabase oficial | Plugin existente, instalado e habilitado; distribuição remota 1.0.0, preservada |
| Playwright | Skill oficial `playwright-cli` em `~/.codex/skills/playwright-cli`; CLI global `@playwright/cli` 0.1.22 |

A distribuição Expo instalada contém 13 skills, incluindo `building-native-ui`, `expo-deployment`, `expo-cicd-workflows`, `upgrading-expo`, `expo-module` e `expo-dev-client`. Os nomes diferem dos oito nomes citados na proposta: o marketplace e a branch atual do fornecedor podem distribuir revisões diferentes. Foi usado o plugin oficial disponível, sem instalar cópias sobrepostas. Instalação de skills não comprova autenticação nem execução de serviços EAS.

Fontes: [instalação oficial Expo](https://docs.expo.dev/skills/), [repositório Expo](https://github.com/expo/skills), [Playwright CLI da Microsoft](https://github.com/microsoft/playwright-cli). A skill Playwright foi obtida de `skills/playwright-cli` no commit `b85c7a736bb473bf55b584e54a09ffa698d6d871`.

### Outra máquina

As skills locais acompanham o Git quando estes arquivos forem commitados e enviados. Instalações pessoais de plugins e CLI não acompanham o clone. Para Expo, a documentação oficial indica:

```powershell
codex plugin add expo@openai-curated
codex plugin list --marketplace openai-curated --json
```

Para Playwright, usar o instalador de skills do Codex para `microsoft/playwright-cli`, caminho `skills/playwright-cli`, no commit registrado acima. Instalar a versão reproduzível da ferramenta com:

```powershell
npm install -g @playwright/cli@0.1.22
playwright-cli --version
```

Conferir Supabase nos plugins do Codex e instalar/conectar somente se ausente. Não copiar credenciais nem caches de plugins entre máquinas. Para atualizar, conferir a origem e a revisão antes de substituir a instalação existente.

## Validação e limites desta entrega

- Camada de orquestração acrescentada após a preparação inicial: dez skills locais no total, matriz de acionamento e ensaio de triagem documentado. O ensaio não substitui validação com três implementações reais.

- Os nove novos `SKILL.md` e a skill Playwright passaram no `quick_validate.py` do criador de skills.
- Os 59 caminhos explícitos de repositório nos novos arquivos foram conferidos e existem.
- Expo foi confirmado como instalado/habilitado no marketplace correspondente. Playwright respondeu a `--help` e `--version` (0.1.22). A primeira chamada de versão teve um erro de encerramento libuv; as chamadas isoladas seguintes concluíram com código zero.
- `dev:doctor` apontou ausência de dependências e configuração local neste worktree. Nenhum fluxo do aplicativo, navegador autenticado ou dispositivo foi exercitado nesta entrega de instruções.
- A implementação de uma suíte E2E completa e a integração de skills no runtime do assistente são trabalhos separados; a instalação não realiza essas mudanças.
- Nenhuma migration, dependência do app, configuração de produção ou publicação foi alterada. Os arquivos de projeto permanecem locais, sem commit/push.
