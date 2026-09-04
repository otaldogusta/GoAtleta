# Design QA

## Atletas: status de acesso e horário — 2026-09-03

- Turma em cima e dias/horário abaixo, na mesma coluna em todas as larguras, conforme referência atualizada do usuário; removida a coluna separada Horário.
- Ativo neutro quando o acesso não foi ativado; verde com vínculo do aluno ou acesso familiar aceito. Matrícula, financeiro e frequência continuam independentes.
- Motivo do badge em balão sobreposto, por hover, foco ou toque; sem subtexto permanente adicional.
- Validação automatizada: 24 testes focados, typecheck:app, check:org-scope, perf-hygiene estrito e diff check passaram.
- Primeira tentativa de QA interrompida por retorno ao login; sessão autenticada disponível nas revisões seguintes.
- Revisão do agrupamento turma/horário: conferida com sessão autenticada em 390×844, 834×1194 e 1440×1024, no tema escuro, sem overflow horizontal global. Tema claro não revalidado nesta revisão. Viewport original restaurada.
- Smoke de publicação: lista autenticada em 1360px, balão do badge abre ao clique, informa corretamente quando a ativação ainda não foi confirmada e fecha ao clicar fora sem abrir o perfil. Nenhum dado alterado ou convite enviado.

## Primeiro acesso: nome e foto

- Desktop `1209x812`: bloco central de `400px`, sem navegação ou conteúdo da Home ao fundo.
- Mobile `390x844`: conteúdo permanece centralizado, sem corte vertical ou rolagem desnecessária.
- Avatar: área inteira clicável; no hover, o avatar escurece e mostra a câmera no centro.
- Foto: ações de câmera e galeria usam o modal compacto com fechamento no cabeçalho.
- Nome: sugestão editável, campo obrigatório e botão desabilitado enquanto inválido ou salvando.
