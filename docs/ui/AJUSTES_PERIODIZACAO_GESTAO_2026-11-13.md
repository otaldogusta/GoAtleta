# Periodização e Gestão · ajustes após a revisão de 13/11

Os cinco comentários do usuário delimitaram esta rodada: restaurar os cartões
de mês anteriores, organizar o topo da Periodização, dar margem ao Assistente
e priorizar Equipe na Gestão. [Três comparativos locais](http://127.0.0.1:8096/ajustes-periodizacao-gestao.html).
A [galeria de 20 pares](http://127.0.0.1:8096/inventario-continuidade-lote4.html)
permanece preservada; a composição de Periodização e Gestão nela foi substituída
pelos ajustes deste documento.

## Composição aplicada

- **Cartões de mês:** voltaram os cartões horizontais de 138 px com fase,
  semanas/aulas e curva de carga. A borda distingue o selecionado, também
  anunciado por `aria-pressed`. Meses passados usam texto muted sem reduzir
  a opacidade do cartão inteiro. Dados e seleção permanecem os mesmos.
- **Topo da Periodização:** contexto da turma/status antes das ações;
  Editar periodização e Recalcular juntos. No tablet, contexto e ações
  compartilham a faixa. Ciclo/ano fica junto do trilho de meses.
- **Assistente do workspace:** 16 px nas laterais e na base em 390 px,
  somados à área segura; padding interno de 16 px e limite de altura por
  viewport. Em 834 px, painel lateral de 360 px com 16 px de margem.
  Campo, conversa, rolagem e contexto preservados. Escape/Fechar devolvem
  o foco ao acionador após a saída. Outros hosts mantêm sua apresentação.
- **Gestão:** `UnderlineTabs` com Equipe como entrada e Visão geral para
  indicadores, índice e filas. Busca e convite abrem a região de pessoas;
  a lista usa a rolagem da página, sem o antigo limite interno de 310 px.
  Busca permanece ao alternar abas e voltar do perfil. Limpar busca foca
  o campo; fechar o perfil retorna à pessoa correspondente. Parâmetros
  de acesso a uma fila continuam abrindo Visão geral no contexto solicitado.

## Validação e evidência

Mudança funcional localizada, nível 2 da escada: estado de abas, foco e reflow,
com checks adicionais de escopo e renderização nas superfícies integradas.

- Designer UI inspecionou 390 × 844 claro/escuro e 834 × 1194 escuro. Os
  cartões mediram 138 × 92, sem overflow horizontal; Assistente móvel
  mediu 358 px de largura, com 16 px livres de cada lado.
- Designer UX verificou os dois temas: seleção de meses, detalhes, foco,
  Tab/Escape, conservação de texto não enviado no Assistente, busca entre
  abas, perfil/retorno, expansão do índice, foco na fila e acesso por URL.
- Implementação executou 18 testes focais de Assistente, view model e safe
  area. Após os deltas finais, passaram 18 testes em quatro suítes de
  Assistente e Gestão. Os conjuntos se sobrepõem; não são 36 testes distintos.
- Typecheck do app, ESLint focal, `check:org-scope`, perf-hygiene strict e
  diff check passaram. Revisão independente encontrou a perda de foco em
  Limpar busca, corrigida e retestada. Sem achado pendente no delta revisado.

App do mesmo checkout em `127.0.0.1:8082`, com Auth/Supabase local e conta
fictícia, preservando a sessão existente em `localhost:8081`. Ciclo/semanas
da Periodização são leituras fictícias no navegador. Gestão substitui a
leitura local de convites indisponível e usa uma chamada pendente de exemplo
para o teste de fila. Contagens entre rodadas não representam impacto da UI.
Não houve gravação de operação, alteração de permissão, envio de mensagem,
sincronização ou publicação.

Foi detectada uma limitação anterior: trocar o ano e voltar ao ciclo ativo
funciona, mas reinicia o foco do teclado no documento. Fica registrada
separadamente, sem alterar o fluxo de ciclo nesta correção de composição.
Teclado virtual e aparelho físico não foram exercitados.

Fontes anteriores, roteiros, logs e capturas estão no diretório local ignorado
`.tmp/auditoria-go-atleta-2026-11-13/lote-5/`. Para o resultado final de UX,
usar `ux/depois-dark/observacoes.json` e `ux/depois-light/observacoes.json`;
os arquivos intermediários por área mantêm os achados já corrigidos.
