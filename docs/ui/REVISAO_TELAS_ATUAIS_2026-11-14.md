# Revisão das telas atuais · 14/11/2026

## Escopo e referência

Continuação local do inventário, limitada às entradas atuais do app. O mapa
seleciona 57 IDs em nove pacotes a partir dos menus e consumidores reais; seleção
não significa execução integral. Composições aprovadas de autenticação, Quadra,
Planejamento, meses de Periodização, Gestão/Equipe, Regulamentos, Biblioteca,
Avisos, Chamada/relatório, Família e Assistente foram preservadas.

Designer UI inspeciona as imagens e proporções; Designer UX percorre navegação,
teclado, erros e cancelamentos. Implementação faz os ajustes delimitados. Revisão
independente lê o delta estável. Não houve mudança de identidade visual,
biblioteca, arquitetura ou regras de acesso.

Artefatos locais em `.tmp/auditoria-go-atleta-2026-11-13/lote-8/`:

- `mapa-pendencias.json` e `.md`: entradas, fontes, IDs e classificações.
- `fontes-antes/` e `baseline.json`: snapshot do código antes desta rodada.
- `ui-evidencias.json` e `ux-evidencias.json`: estados realmente inspecionados.
- `galeria-manifesto.json`: seleção de imagens, percurso e limitações.
- `implementacao-final.patch` e `implementacao-final.json`: delta incremental.

A galeria local está em [inventario-atual.html](http://127.0.0.1:8096/inventario-atual.html). Comparativos usam
estados equivalentes. Telas preservadas aparecem como estado atual conferido;
não são apresentadas como um redesign nem como pares artificialmente diferentes.

## Correções delimitadas

1. **Hoje → Ver aula:** o redirecionamento de `/class/[id]/session` conserva
   `date`. Selecionar 15/11 leva à ficha de 15/11. O corpo de `SessionScreen`
   permanece idêntico ao baseline, inclusive o relatório aprovado. O parâmetro
   legado `tab` não ganhou abertura automática do relatório.
2. **Hoje → sino e agenda semanal:** nomes/papéis/estado acessíveis, expansão
   explícita na web, Enter/Espaço e seleção do dia. Limpar/Fechar mantêm círculos
   de 36 px dentro de alvos de 44 px. Backdrop fora do foco; Modal e handlers
   preservados.
3. **Perfil → Configurações → Preferências:** `SettingsRow.checked` opcional,
   ligado ao mesmo valor do indicador visual. Web usa button/aria-pressed para
   manter Espaço no renderer instalado; nativo usa switch/checked. Navegação
   continua button, informação sem onPress continua View. Sem mudança de estilo.
4. **Turmas/Alunos → saída com rascunho:** `ConfirmCloseOverlay` nomeia e expõe
   suas ações como botões. Mantém callbacks distintos, ações opcionais, visual
   e proteção existentes.
5. **Financeiro → Configurações:** o painel embutido deixa de reservar 94% da
   tela para conteúdo curto. Usa altura pelo conteúdo, teto de 94%, cabeçalho
   fixo e rolagem interna. A falha curta ocupa cerca de 348 px em 390 × 844;
   detalhes expandidos e rodapé foram conferidos em 390 × 600. Standalone,
   permissões e lógica do provedor permanecem.
6. **Perfil → Voltar/Hoje:** consulta de status do e-mail alternativo não
   bloqueia a navegação. `busy` continua protegendo os controles durante leitura
   e ação; `mutating` identifica request/verify/remove da conta atual para as
   guardas de saída. Rascunho continua exigindo confirmação, e senha/contato
   em gravação continuam protegidos. Não houve mudança de API ou autorização.
7. **Turma → Exportar chamada:** o FAB de navegação fica oculto enquanto o
   exportador está aberto, liberando Baixar PDF. A condição adicional não
   recompõe a ficha, a chamada ou o relatório. O diálogo usa foco canônico e,
   após a saída, devolve foco ao FAB somente na rota atual e no layout compacto.
8. **Turma → Alunos → Mover:** Escape fecha o diálogo e preserva a seleção.
   O listener da lista não consome eventos de diálogos/menus nem eventos já
   tratados; fora deles, Escape continua encerrando a seleção. Matrículas e
   callbacks de movimentação permanecem iguais.
9. **Aluno → Agenda:** falha da consulta da turma oferece Tentar novamente.
   O retry mantém a instância do calendário, mês, dia e busca, consulta somente
   o vínculo atual e descarta respostas antigas após troca de contexto. Erro
   não é apresentado como ausência de treino ou busca sem resultado.

O reviewer identificou que `accessibilityState.expanded` não chegava ao DOM;
`aria-expanded` explícito resolveu o achado. A mesma conferência do renderer
orientou `aria-pressed` nas preferências. Não confundir teste de props React
com evidência de acessibilidade do navegador.

## Ambiente e validação

Nível 3 para a navegação datada; nível 2 para semântica/teclado de primitives.
Node 24.13.0 local. `localhost:8081` foi restabelecido; smoke autenticado isolado
em `127.0.0.1:8082`, mesmo checkout, com Supabase local em `127.0.0.1:54321` e
contas fictícias. A sessão de uso em 8081 foi preservada. A galeria é servida em
`127.0.0.1:8096`. Um navegador QA por vez.

- Home/redirect: três suítes, dez testes focados passaram.
- SettingsRow: uma suíte, três testes passaram.
- ConfirmCloseOverlay + consumidor BlockEditModal: duas suítes, seis testes passaram.
- Configurações financeiras: dois contratos relacionados passaram; os outros
  treze casos dessa suíte não foram executados nesta correção visual.
- Contato de segurança/guardas do Perfil: duas suítes, treze testes passaram,
  incluindo leitura pendente, mutações, reentrância e troca de identidade.
- ModalSheet: 29 testes passaram, incluindo foco de rota e callbacks de saída.
  A suíte emitiu aviso de renderizadores simultâneos ao combinar renderização
  de servidor e test renderer; nenhum teste falhou.
- Escape da seleção: oito casos novos passaram; três casos de Escape do
  ModalSheet foram repetidos junto deles (onze no comando filtrado).
- Agenda do Aluno: duas suítes, nove testes passaram. A última execução
  encerrou normalmente, sem avisos, após isolar telemetria apenas nos testes.
- Tipos do app, escopo de organização e higiene de performance das telas
  afetadas passaram. Diff e geração do checklist foram conferidos no fechamento.
- UI/UX: claro/escuro e 390 × 844 nas alterações; inbox também em 1158 × 883.
  Cada captura registra o próprio tamanho e tema. Não extrapolar a todas as
  larguras, papéis ou estados do app.
- Revisão independente: sem achados remanescentes nos três deltas examinados.

Testes unitários não certificam leitor de tela, hardware, integração externa,
persistência ou publicação. Nenhum build de release, commit, push ou deploy.

## Limitações de dados e alcance

A leitura natural de Atletas falhou localmente com HTTP 400/42703:
`students.guardian_name` ausente no schema QA. Erro e Tentar novamente foram
registrados. Para conferir editores, a resposta de leitura foi adaptada apenas
no navegador, mantendo filtros e RLS e IDs QA; schema e banco não foram alterados.
Esse replay comprova apresentação/interação, não corrige a compatibilidade da
base nem certifica leitura de produção.

Marcação automática de notificações foi simulada no navegador. Cobranças,
pagamentos, exportações/envios, OAuth, permissões, upload, decisões de acesso e
gravações operacionais não são certificados pela abertura/cancelamento de seus
formulários. NFC e câmera exigem dispositivo/contexto próprios.

Rotas legadas ou auxiliares sem menu atual encontrado continuam separadas:
`/notifications`, `/evidence`, `/class/[id]/log`, corpo antigo de `/session` e
`/reports/trainer`. O Histórico atual e o relatório modal são os da ficha da
turma; o inbox atual é o sino de Hoje. Capacidade/convite/conexão indisponível
permanece limitação explícita, não é substituída por uma tela restrita como
prova de conteúdo autorizado.

## Cobertura consolidada

Galeria com **75 estados por área e nove comparativos**. UI registrou 29
estados próprios e inspecionou também as capturas UX; UX registrou 47. Um
artefato compartilhado foi deduplicado na galeria. Existem recortes observados
para 49 dos 57 IDs selecionados, sem promover cobertura parcial a aceite total.
Os testes somam 80 casos distintos em 13 suítes; repetições não entram na soma.

| Área | Estados na galeria | Recorte observado |
| --- | ---: | --- |
| Hoje | 7 | Carrossel/data, sino, confirmação cancelada, agenda vazia/falha/recuperação. |
| Perfil | 8 | Foto/nome, seções, preferências, consulta pendente, rascunho e Conta com leitura fictícia. |
| Atletas | 15 | Falha natural, editor por seção, foto/histórico, status cancelado e utilidades de importação/Forms/exportação. |
| Turmas | 17 | Criar/editar, equipe, agenda, perfil esportivo, histórico atual, substituição, alunos e exportação. |
| Agenda | 6 | Ocorrência e unidade, ida/volta à turma, evento fictício preenchido e cancelar edição. |
| Financeiro | 7 | Cobrança, detalhe, formulário de pagamento, acordos/competência e provedor curto/expandido. |
| Scouting/NFC | 5 | Estúdio vazio, opções, formulário, fontes e estado NFC web. |
| Aluno | 8 | Erros independentes da Home, mês/busca da Agenda e nova tentativa preservando contexto. |
| Acessos | 2 | Plataforma sem pedidos elegíveis e entrada condicional de curadoria sem conexão. |

Os oito IDs sem novo recorte são: acompanhamento de pedido e convites válidos
(`g07-02`, `g08-02`, `g09-01`); WhatsApp sem telefone na fixture (`g15-15`,
`g13-06`); perfil pedagógico/versões canônicas não localizados no editor atual
(`g13-03`, diferente do Perfil esportivo observado); utilidades sem entrada
atual na lista interna da turma (`g14-04`); banco/rodízio/registro oficial sem
sessão de scouting (`g27-10`). Isso não autoriza alterar uma composição antiga
nem simular acesso, sessão ou envio concluído.

Curadoria sem Drive conectado e Plataforma vazia comprovam somente esses
estados, não o conteúdo autorizado ou uma decisão. Duplicação, matrícula,
convites, pagamento, envio, sincronização e hardware não foram exercitados.
A fixture simultânea de falha em classes e events produziu um overlay de erro
fora da captura de recuperação; ficou registrada e excluída dos prints válidos.

A galeria passou em 1365 × 900 e 390 × 844, sem overflow horizontal. UI inspecionou
os pares completos; imagens finais da Agenda foram conferidas separadamente.
O delta contém 15 fontes do app e dez arquivos de teste, comparados ao snapshot
de 2.046 fontes. Nenhuma outra fonte do app foi alterada nesta rodada. O conteúdo do relatório
aprovado permanece idêntico; alterações anteriores do checkout foram preservadas.
