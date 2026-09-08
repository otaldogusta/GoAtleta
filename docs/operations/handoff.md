# Continuidade — 08/09/2026

## Estado publicado

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
