# Quadra compartilhada por link

Implementação local de 27/10/2026. O botão Compartilhar da quadra web e o menu
do documento abrem um diálogo com a composição e primitives do Studio Scouting:
pessoas com acesso, acesso geral, permissão Leitor, copiar link, prévia e revogar.
Exportar permanece uma ação independente. O nativo conserva a exportação existente.

O link copiado sempre usa `https://goatleta.com/court/shared`, inclusive quando
o editor está em localhost. Links locais já gerados conservam o mesmo ID/código
ao copiar novamente, sem republicar a jogada. O visualizador abre `/court/shared` com ID e código aleatório de 256 bits no fragmento,
sem colocar o código na query de navegação. Qualquer pessoa com o link pode ler
a cópia publicada. O servidor guarda somente o hash do código. Gerar outro link
substitui o código anterior; revogar impede novas leituras. O visualizador aberto
reconfere o acesso a cada 60 segundos e ao retornar à aba. Uma cópia já recebida
por alguém não pode ser recolhida do dispositivo por revogação.

Cada publicação registra uma cópia da jogada atual, sem alterar o documento,
histórico, rascunho ou salvamento do editor. Editar depois não atualiza essa cópia;
para republicar, reabrir Compartilhar e gerar outro link. Rótulos, desenhos e
notas são conteúdo compartilhado; vínculos de aluno/aula e organização não fazem
parte da projeção. A função SQL também remove vínculos pessoais de `actorMeta` e
`lessonLink`, independentemente do serializer cliente.

O editor e o player reutilizam a mesma composição `CourtWorkspaceView`, incluindo
cabeçalho, ferramentas, painel e transporte. O controlador de leitura separado
não monta o hook de edição/persistência, não carrega elenco e ignora mutações.
Câmera, zoom, visibilidade de guias, etapas e reprodução são locais à apresentação.
Adicionar, mover, excluir, reordenar e salvar ficam desabilitados; o documento
publicado permanece imutável. A prévia suspende também foco e atalhos do editor
ao fundo; o bridge recebe `disabled=true`.

## Autorização e ativação

`court_shares` tem RLS e nenhum acesso direto para anon/authenticated. As RPCs
de gerenciamento exigem sessão, turma pertencente à organização e os helpers
canônicos `is_org_admin`/`is_class_staff`. Cada autor administra seus próprios
links por turma/documento. O resolvedor público aceita somente ID/código e
retorna a projeção com permissão `viewer`, sem identidade arbitrária fornecida
pelo cliente. Erros de link inválido/revogado não distinguem a existência da cópia.

A migration `20261027134015_court_sharing.sql` foi aplicada em 27/10, mediante
autorização explícita, no projeto Supabase configurado pelo repositório.
O nome local acompanha a versão efetivamente registrada pelo serviço de migrations.
Conferência remota confirmou RLS ativa, tabela sem SELECT para anon, resolvedor
público executável e publicação bloqueada para anon. Nenhum dado anterior,
segredo ou configuração de ambiente de produção foi alterado.

## Evidência local e limites

- Jest: serializer preserva simulação, remove vínculos sem modificar o editor;
  fragmento válido/inválido; player bloqueia edição e navega entre etapas/vistas;
  suíte existente do bridge cobre comandos desabilitados e obsoletos.
- PostgreSQL isolado: publicar por staff, negar outra organização/usuário,
  impedir acesso direto à tabela e escrita anônima, projetar metadados,
  negar código incorreto, substituir código e revogar.
  Os helpers de papel são fixtures sintéticas; não é um teste do backend hospedado.
- Typecheck, org-scope, perf-hygiene strict e export web aprovados.
- Browser local: rota pública inválida permanece em `/court/shared`; cópia de
  teste via resposta simulada abre o iframe 3D, troca etapas/2D e foi inspecionada
  em desktop e celular, sem erros globais. A porta 8081 já atendia outro app
  Go Atleta; o build deste checkout foi servido separadamente na porta 8082.

Smoke autenticado em 27/10 na porta 8081, com a conta já conectada e o Supabase
real: abrir o diálogo, publicar uma cópia, copiar o link, carregar o player 3D,
reproduzir/pausar, trocar etapa e vista 2D, abrir/fechar prévia e revogar.
Uma nova abertura do mesmo link mostrou indisponibilidade; o editor retornou à
mesma jogada sem salvar nem alterar seus dados. O link de teste foi revogado.
O código público de leitura usa a chave anônima, mesmo quando há sessão no app.
PostgREST real também negou SELECT direto à tabela e publicação anônima (401).

A origem 8081 foi trocada temporariamente para este checkout mediante orientação
do usuário; a sessão existente foi preservada sem extrair ou transferir credenciais.
A porta 8082 foi encerrada. O checkout de agenda e seus arquivos concorrentes
permaneceram intactos. A inspeção visual do diálogo identificou fonte herdada do
HTML fora do estúdio; o portal passou a declarar a tipografia canônica do Studio.

O gate completo passou com 696 suítes/4.722 testes, 19 suítes SQL, runtime da
quadra, lint, tipos, escopo, arquitetura, performance e export web. A revisão final
da tipografia e desta evidência exige nova execução do executor, que decide o
reaproveitamento pelos hashes. Push/deploy e confirmação de produção são etapas
separadas; o smoke local com backend real não comprova publicação do cliente.


## Paridade do estúdio em leitura — validação local de 27/10

A prévia e a rota compartilhada na 8081 usam o mesmo estúdio. Inspeção visual
e comparação das posições/dimensões do cabeçalho, ferramentas e transporte
confirmaram paridade em desktop (825 × 704). Reprodução das seis etapas, câmera,
2D/3D, zoom e guias funcionaram; ferramentas de edição, biblioteca e salvamento
permaneceram bloqueados. Fechar a prévia preservou a jogada do editor.
Sete suítes focadas/153 testes passaram, incluindo bloqueio de mutações,
navegação e bridge. Tipos e escopo aprovados. Nenhuma migration/RPC foi alterada.
Esta revisão visual está local na 8081; sua publicação no cliente público é uma
etapa separada. Os ajustes concorrentes da agenda foram preservados.


## Ajustes temporários do visitante — 27/10

Sistema, modo, saque, alvo e demais parâmetros de simulação podem ser alterados
na memória da prévia e do visualizador. Não passam pelo controlador de escrita,
histórico, rascunho ou persistência. Restaurar retorna à cópia recebida; fechar
o visualizador descarta os ajustes. Ferramentas autorais, biblioteca, salvar e
exportar continuam bloqueados. Isto amplia o contrato de leitura descrito acima:
a cópia publicada é imutável, mas sua simulação local é explorável.
O modelo 5×1 é inicial; documentos e rascunhos são carregados por turma, sem
propagar alterações automaticamente para todas as turmas. Testes focados de
leitura/controles e smoke na 8081 validaram os ajustes e a restauração.

Em 27/10, removido o deslocamento vertical legado dos controles de vista em
desktop abaixo de 1000 px: zoom/movimento ficam na linha inferior do transporte.
Conferência visual na 8081 em 825 × 704 e sete testes de layout mobile aprovados;
a separação vertical necessária no celular permanece preservada.

Na prévia 3D, o destino do saque também aceita arraste e setas como ajuste
temporário. A exceção do bridge permite somente simulation-handle/serve com
capacidade explícita, token/revisão e limites válidos; outros comandos continuam
bloqueados. Pausa/atividade preservam o bloqueio durante reprodução. Smoke na
8081 confirmou mudança da trajetória por arraste; testes verificam imutabilidade
da cópia recebida e rejeição de outros comandos. Publicação continua pendente.

Progresso web refinado em 27/10: trilha fina arredondada, preenchimento verde,
marcador circular discreto e foco de teclado visível. O input range e seus
eventos permanecem nativos. Conferência na 8081 em 1063 × 704, incluindo busca
por clique/teclado e progresso parcial; 19 testes dos controles aprovados.

Identidade dos centrais corrigida em 27/10: ao abrir a sequência canônica 5×1
de seis recepções, reparar referências trocadas de c1/c2 por rotação, preservando
rótulos autorais, coordenadas, trajetórias e o documento de origem. A mesma
reparação pura vale no bootstrap do editor e na leitura pública, sem escrita
remota automática. Sequências customizadas e outros sistemas permanecem intactos.
No documento da conta em 8081, confirmado C¹ em P2/P1/P6 e C² em P5/P4/P3.
Testes de sequência, leitura, editor e reparo aprovados; tipos aprovados.

Escala web responsiva corrigida em 27/10: abaixo de 700 px, os overlays mantêm
a escala compacta, sem salto para 1. Ícones da reprodução mantêm o tamanho
visual web; áreas de toque e tamanhos nativos são preservados. Conferência
visual na 8081 em 617 × 704 e 26 testes de controles/layout aprovados.

Layout responsivo dos controles de vista passa a considerar a escala efetiva:
quando cabe com margem de 6 px, usa a mesma linha inferior do transporte,
inclusive em 617 px. Sem espaço, mantém separação vertical. Conferência visual
na 8081 em 617 × 704 e dez testes de layout aprovados.

Em telas estreitas sem espaço ao lado do transporte, os controles de vista
agora formam uma coluna de 40 px junto à direita, com base fixa na reserva
do painel. Removido o degrau adicional que elevava a antiga barra horizontal.
Conferência visual na 8081 em 320 × 704 e quinze testes de layout aprovados.

Abaixo de 401 px na web, a reprodução passa a duas linhas: play/reinício/busca
em cima; rodízio, velocidade e etapas abaixo, com separador e espaçamento.
O progresso deixa de disputar largura com as demais ações. A reserva do painel
e dos controles verticais acompanha a nova altura. Conferência visual na 8081
em 319 × 704 e 34 testes de controles/layout aprovados.

Prévia simplificada em 27/10: ferramentas de edição da esquerda ocultas; alça
do painel ocultada quando fechado no modo leitura, mantendo recolher quando
aberto. A listinha do transporte abre Etapas e permite alternar para Ajustes.
Controles de vista usam a mesma base inferior do transporte, em coluna quando
necessário; transporte até 400 px reserva margem lateral adicional para evitar
sobreposição. Testes de leitura/painel/controles/layout aprovados; tipos aprovados.

Título de prévia corrigido localmente em 27/10: remover o title duplicado do
documento base e manter a definição do layout. Export web confirmou exatamente
um title em index.html e court/shared.html. Publicação desta correção pendente.
