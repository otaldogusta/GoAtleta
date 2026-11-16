# Pendências das telas atuais · 14/11/2026

## Escopo

Continuação da [revisão anterior](REVISAO_TELAS_ATUAIS_2026-11-14.md), com
contas fictícias e entradas atuais. As composições aprovadas são a referência;
não foram escolhidas rotas legadas para completar o inventário.

Designer UI inspeciona os estados renderizados. Designer UX verifica navegação,
teclado, recuperação e retorno. Implementação integra os ajustes delimitados;
revisão independente examina o delta final.

O aplicativo normal continua em `localhost:8081`. O QA usa as mesmas fontes em
`127.0.0.1:8082`, com backend local `127.0.0.1:54321`. Respostas fictícias do
navegador são identificadas nas evidências: comprovam a interface, não aceites,
envios, decisões ou persistência no servidor.

Artefatos privados ignorados pelo Git:
`.tmp/auditoria-go-atleta-2026-11-13/lote-9/`. O baseline registra 2.040 fontes
do app antes desta rodada. Alterações anteriores e artefatos locais permanecem.

## Reconciliação do inventário

- O diagnóstico pedagógico atual fica em Planejamento → Editar periodização →
  Selecione o nível da turma. Componentes de histórico/versões sem consumidor
  atual não são apresentados como tela revisada (`g13-03`).
- Importar/exportar atletas fica no diretório geral, já observado anteriormente.
  Não foi encontrada entrada dessas utilidades na lista interna da turma
  (`g14-04`). Exportar chamada é outra funcionalidade.
- O banco e a posição do levantador pertencem ao coletor atual de scouting.
  Escalação local, rascunho e registro oficial têm contratos distintos; uma
  captura do elenco não certifica a gravação de um ponto (`g27-10`).

## Evidência desta rodada

[Galeria por área: sete comparativos e 12 recortes](http://127.0.0.1:8096/inventario-pendencias.html).
Capturas repetidas por tema/interação não são contadas como telas novas. A revisão
anterior permanece disponível. Pares com alteração semântica conservam a aparência
e explicam o comportamento corrigido.

| Área | Recortes | Resultado observado |
| --- | ---: | --- |
| Acessos e convites | 4 | Pedido, detalhe da Plataforma, convite de atleta e pré-aceite de equipe. |
| Atletas | 2 | Mensagem individual e revisão de nomes repetidos. |
| Turmas | 1 | WhatsApp da turma com contato selecionado. |
| Planejamento | 1 | Nível da turma, Assistente e Agenda/Mais. |
| Scouting | 4 | Registrar/Revisar, escalação, elenco/levantador e informação oficial. |

## Correções aplicadas

1. **Pedido de acesso:** erro da consulta separado de mensagens de convite/ação;
   nova tentativa por Espaço, leitura deduplicada e resposta antiga descartada.
   Renovação da sessão da mesma conta conserva o acompanhamento. Falha seguida
   de HTTP 200 deixa de exibir o erro anterior.
2. **Plataforma:** retirado telefone fixo sem origem na API. O fechamento do
   detalhe funciona pelo teclado e retorna à solicitação. Filtros, busca vazia,
   erro/retry e ausência de decisão de equipe no pedido de atleta conferidos.
3. **Convite de atleta:** abas por teclado e controles de senha desmontados
   quando vazios. Formulário, submissão e claim existentes permanecem. O convite
   de equipe não precisou de alteração: ida ao login conserva o código.
4. **WhatsApp individual:** diálogo e controles nomeados; foco espera o portal
   montar. Tab/Shift+Tab percorrem opções e, nas extremidades, fecham a lista e
   retornam ao seletor; Escape fecha somente a lista. O compositor conserva seu
   foco. Nenhuma mensagem enviada.
5. **WhatsApp da turma:** FAB oculto durante o modal, ação habilitada com o par
   `primaryBg/primaryText`, destinatário operável por teclado e retorno ao FAB.
6. **Duplicidade:** Revisar/Manter com papéis e rótulos; Revisar leva foco ao
   fechamento do editor após a saída do diálogo anterior. O X do editor passa
   a ter nome acessível. Cadastro, recibo de Manter e persistência preservados.
7. **Planejamento:** o editor opta pelo botão existente do Assistente no
   cabeçalho. Voltar/Continuar ficam livres, mantendo conversa, rascunho, etapas
   e composição. Workspace/aula conservam os defaults. Na comparação, o trilho
   de etapas está em posições diferentes de rolagem; sua estrutura não mudou.

UI inspecionou os pares e percorreu o coletor atual de scouting. UX executou
os percursos corrigidos em 390 × 844, claro/escuro: recuperação, teclado, foco,
cancelamento e retorno. Scouting inclui o workspace claro em 1440 × 1024.
No Planejamento, também foram conferidos Assistente aberto e Agenda/Mais.

A revisão cruzada detectou duas falhas intermediárias: lista de modelos sem
foco após montar o portal e editor de duplicidade com foco no BODY. Ambas foram
corrigidas e repetidas nos dois temas. Capturas dessas tentativas e frames de
animação incompletos ficaram fora da seleção da galeria.

## Validação e preservação

Nível 2 para interação/foco e nível 3 para o acompanhamento de acesso por
identidade. Sem publicação ou alteração de persistência/autorização.

- **26 testes distintos em oito suítes passaram:** 19 iniciais, três novos
  casos no follow-up de foco e quatro de PlanningAssistant. Repetições não
  entram na soma. Os testes focados incluem falha/retry, deduplicação, troca
  de usuário, renovação de sessão, controles, foco e defaults do assistente.
- `typecheck:app`, `check:org-scope` e `check-perf-hygiene` focado passaram
  (nove telas avaliadas pelo guardrail).
- Revisão independente por leitura: nenhum achado acionável remanescente
  nos deltas finais. Não equivale a teste de navegador ou de backend.
- Delta incremental: dez fontes e oito testes, contra o baseline de 2.040
  arquivos. Nenhuma outra fonte do app alterada nesta rodada.
- Checklist: nove notas existentes atualizadas; 29 módulos, 381 itens e 124
  rotas. Títulos, IDs, estados e armazenamento da revisão pessoal preservados.
- Galeria inspecionada por UI em 390 × 844 e 1311 × 883: sem overflow
  horizontal, 19 imagens principais e 53 links de PNG íntegros. Diff, espaços
  finais, referências locais e arquivos citados no manifesto conferidos.

Artefatos: `implementacao-final.patch/json`, `implementacao-revisao.json`,
`implementacao-planejamento.patch/json`, `ui-evidencias.json`,
`ux-evidencias.json`, `ux-final.md`, `galeria-manifesto.json` e `validacao.json`.
O acervo contém repetições de interações/temas; o manifesto da galeria é a
seleção legível. Nenhum build de release, commit, push ou deploy.

## Limites que permanecem

Convites foram testados antes do aceite; não houve cadastro, consumo de token,
concessão/recusa de acesso, envio de WhatsApp ou escrita operacional. Telefones,
pedidos, sessão de scouting e perfis de diagnóstico são fictícios. Isso não
certifica integração externa, permissão, RLS, entrega ou persistência.

O cenário de Planejamento simula explicitamente `can_read_class_profile` e
`class_diagnostic/load` apenas para IDs QA. Comprova a apresentação da etapa
atual e o assistente, não um perfil pedagógico preenchido ou histórico de
versões. Formato/altura não foram alterados: os handlers enviam comandos.

Scouting usa respostas de overview/detail com partida fictícia 6×6 e oito
atletas. Escalação/rascunho/descartar, elenco, posição do levantador/cancelar,
Registrar/Revisar e informação oficial foram conferidos. Pontos, sets,
encerramento, sincronia, vídeo/câmera e hardware permanecem fora desta prova.

Os sete IDs antes sem recorte que receberam observações nesta rodada continuam
com limites por estado: `g07-02`, `g08-02`, `g09-01`, `g15-15`, `g13-06`,
`g13-03` e `g27-10`. `g14-04` permanece sem entrada atual na lista interna;
não foi substituído por uma rota antiga nem declarado concluído.
