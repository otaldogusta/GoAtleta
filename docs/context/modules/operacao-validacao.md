# Operação, validação e continuidade

Referência inspecionada: `d5120cff`, 05/10/2026. [Índice e regra de leitura](../README.md).

## Responsabilidade e implementação atual

Preparar ambiente local, validar mudanças e registrar entregas entre máquinas.
O projeto usa Node 24, Expo/React Native/TypeScript e Supabase; versões exatas
ficam em [package.json](../../../package.json) e lockfile. Não instalar ou
atualizar dependências apenas para organizar documentação.

| Entrada | Responsabilidade |
| --- | --- |
| [dev-setup.mjs](../../../scripts/dev-setup.mjs), [.nvmrc](../../../.nvmrc) | Setup e doctor de pré-requisitos |
| [validate.cjs](../../../scripts/release/validate.cjs), [validation-cache.cjs](../../../scripts/release/validation-cache.cjs) | Executor limitado a dois processos por padrão, recibos por conteúdo/ambiente |
| [core-ci.yml](../../../.github/workflows/core-ci.yml), [eas-update.yml](../../../.github/workflows/eas-update.yml) | Fluxos versionados de CI e atualização nativa |
| [build_inventory.py](../../product/build_inventory.py), [inventory-template.html](../../product/inventory-template.html) | Dados e apresentação do checklist gerado |
| [sentry.ts](../../../src/observability/sentry.ts), [vercel-analytics.ts](../../../src/observability/vercel-analytics.ts) | Observabilidade com tratamento de privacidade |
| [patches](../../../patches/) | Compatibilidades aplicadas pelo postinstall; não remover sem investigação |

## Contratos e decisões

- Inspecionar branch, diff staged/unstaged e untracked antes de editar. Não resetar,
  limpar, trocar checkout ou sobrescrever artefatos de outros trabalhos.
- A [escada de validação](../../operations/validation-ladder.md) decide o nível:
  documental = referências/formato/diff; micro UI = ciclo rápido; funcional =
  testes/tipos/smoke; dados/autorização = integração e escopo; publicação = release.
- `npm run build:verified` executa checks e export; `validate:app` executa checks.
  O executor invalida recibos por inputs e não confia neles no CI. Reaproveitar
  somente o que o executor aceitar; não fabricar registros de aprovação.
- O loop de UI começa em `localhost:8081`. HTTP 200, export e fila de deploy não
  provam fluxo autenticado nem produção pronta.
- `npm run test:e2e` chama reset do banco local por padrão; só usar com banco
  descartável autorizado. Esta tarefa documental não executa esse comando.
- Checklist: preservar títulos/IDs, notas e marcações pessoais; editar o Python
  e regenerar HTML. `code`, `recorded`, `pending`, `verify`, `future` distinguem
  existência, evidência datada, pendência, conferência e proposta.
- Commit, push, PR, migrations e deploy são atos separados que exigem escopo
  autorizado. Scripts disponíveis não constituem autorização para executá-los.

## Fontes e o que é histórico

- [Workstations](../../operations/workstations.md): preparação e continuidade.
- [Handoff](../../operations/handoff.md): log de decisões/entregas com datas;
  localizar a seção pertinente por busca, sem carregar toda a cronologia.
- [Release validation](../../operations/release-validation.md): contrato do
  executor; tempos e contagens de 02/10 são medições históricas.
- [Produção](../../operations/production.md): runbook de publicação/rollback,
  não evidência de implantação do checkout atual.
- [Engineer](engenharia-assistida.md): ferramenta separada do runtime do produto.

## Validação relevante

Nesta organização: inspeção estática e verificações documentais registradas no
[registro da revisão](../revisao-2026-10-05.md). Para mudança do executor, existem
[testes de validação](../../../scripts/release/__tests__/validation.test.ts).
Para entrega funcional futura, seguir a escada e declarar separadamente testes
unitários, SQL, browser, aparelho e ativação remota. Não ampliar checks por hábito.
O [smoke local de consultoria](../../operations/consultation-authenticated-local-smoke-2026-10-05.md)
registra um limite de setup: ligação de dependências pode resolver rotas em outro
checkout. Conferir as fontes carregadas antes de aceitar evidência de navegador.
A [preparação permanente posterior](../../operations/worktree-local-ready-2026-10-05.md)
instalou dependências próprias e configurou o backend local; não alterou o banco
compartilhado nem publicou o pacote.
