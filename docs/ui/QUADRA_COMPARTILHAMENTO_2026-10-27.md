# Quadra compartilhada por link

Implementação local de 27/10/2026. O botão Compartilhar da quadra web e o menu
do documento abrem um diálogo com a composição e primitives do Studio Scouting:
pessoas com acesso, acesso geral, permissão Leitor, copiar link, prévia e revogar.
Exportar permanece uma ação independente. O nativo conserva a exportação existente.

O link abre `/court/shared` com ID e código aleatório de 256 bits no fragmento,
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

O player reutiliza `CourtPerspectiveCanvas`, `CourtEditorCanvas` e o transporte
existente: começa em 3D, permite câmera, 2D, etapas, pausa, reinício, busca e
velocidade. Não monta o hook de edição ou persistência, não carrega elenco e não
oferece callbacks de mutação; o bridge recebe `disabled=true`.

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
