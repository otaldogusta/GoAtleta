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
