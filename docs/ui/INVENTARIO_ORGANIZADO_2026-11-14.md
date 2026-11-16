# Inventário visual organizado · 14/11/2026

Continuação das [pendências atuais](PENDENCIAS_ATUAIS_2026-11-14.md), com
preservação das composições aprovadas. A entrada do acervo passa a ser o
[inventário por área](http://127.0.0.1:8096/inventario.html).

## Continuação das pendências de Cobertura

O lote 14 usa a aplicação real embutida no HTML, com autenticação normal de
contas fictícias no QA local. Trocar a captura ou o recorte com o mesmo destino
mantém a prévia montada para preservar rascunhos. O botão Entrar no QA na prévia
fornece uma entrada explícita de login.

Gestão e Acessos foram recuperados ao servir a função de listagem de convites
no Edge Runtime local. O banco isolado de QA recebeu as três colunas opcionais
de responsável usadas pelo diretório de atletas. As mudanças de ambiente são
locais. Cobertura distingue consultas, rascunhos, alterações gravadas e
percursos pendentes. As evidências estão em
`.tmp/auditoria-go-atleta-2026-11-13/lote-14/`.

O lote 13 concluiu os retornos de foco no Planejamento. No desktop, a
Biblioteca anima a entrada e a saída e respeita a preferência por movimento
reduzido. Ao reabrir, o foco vai para Recolher biblioteca. Ao fechar, retorna
a Expandir biblioteca depois que a saída termina. UI conferiu em claro e escuro.

UX baixou o PDF de um plano fictício por Enter em mobile e desktop. O foco
retornou a Baixar PDF, e o Tab seguinte avançou para Aplicar à aula. Ao mover
o foco para outra ação durante a exportação, o teste confirmou que a conclusão
respeita a escolha. Os pares estão no mesmo inventário, no Planejamento.

No lote 12, a Biblioteca expandida ganhou a superfície opaca do tema.
Designer UI comparou o painel com o mesmo plano fictício em 1440 × 1024
nos temas claro e escuro. Designer UX acionou Baixar PDF com Enter em
390 × 844 e confirmou a mensagem de sucesso e o download real de uma
página A4. O acervo inclui os pares de contraste e a sequência de exportação.
O retorno de foco ao recolher e reabrir a Biblioteca foi retomado no lote 13.

O mesmo HTML reúne os novos comparativos de Periodização e Planejamento.
Na Periodização, as setas foram exercitadas nos dois sentidos com ciclo e
semanas fictícios. O aviso recebe foco e a volta ao ciclo devolve o foco à
seta correspondente. Mover o foco durante a transição preserva essa escolha.

No Planejamento, um plano fictício previamente semeado foi aberto pela
Biblioteca. Em 390 px, a página abre com 620 px, amplia para cerca de 709 px
e se encaixa a 336 px no visor de 356 px. O documento mantém seus campos
editáveis. No desktop, a UI observou contraste insuficiente na Biblioteca
aberta sobre a prévia. O lote 12 retomou essas duas pendências.

Evidências em `.tmp/auditoria-go-atleta-2026-11-13/lote-11/`. Foram
executados 19 testes existentes nas duas suítes focadas e a checagem de tipos.

## Organização do acervo

O hub reúne as 23 áreas com evidências selecionadas, busca por tela/fluxo,
comparativos, estados únicos, temas adicionais, ampliação e links compartilháveis.
No celular, Antes/Depois alternam a captura na largura disponível. O histórico
contém os 24 HTMLs originais, incluindo estudos, propostas e relatórios técnicos.
O antigo `index.html` está preservado como `index-editorial.html`.

Cada recorte conserva origem, data, entrada atual e limite. Lotes posteriores
prevalecem por estado: os cartões de mês e a aba Equipe aprovados no lote 5
substituem as propostas anteriores. O relatório de aula usa o modal atual da
turma. Notificações, Evidências e Log antigos ficam no arquivo, sem serem
apresentados como a jornada atual apenas porque ainda existem rotas.

Três atribuições de IDs herdadas foram reconciliadas: detalhe e lista de
solicitações pertencem à Plataforma; não comprovam decisão de acesso. A ausência
de conexão na Curadoria não comprova interpretação nem publicação. Os IDs
originais ficam em `sourceSurfaceIds` e as erratas em `idReconciliations`.

Os 29 módulos e 381 itens do checklist técnico continuam separados das unidades
de evidência visual. Recortes, imagens, abas, rotas e funcionalidades não são
contagens intercambiáveis nem percentual de app aprovado.

## Novos estados atuais

| Área | Conferência | Alteração delimitada |
| --- | --- | --- |
| Avisos | Caixa preenchida, Não lidos, falha/nova tentativa, confirmação de arquivo cancelada e Arquivados. | Quando o último aviso sai do filtro, o foco retorna à aba atual, evitando o contorno do vazio recortado pela lista. Próximo aviso continua sendo o destino preferido. |
| Regulamentos | Atualizações, editor, resposta parcial e recuperação da sincronização. | Atualização tem nome/papel de link e Enter abre a fonte pelo handler existente, uma vez por pressionamento. |
| Planejamento | Documento editável, objetivo/atividade, Desfazer/Refazer, cancelar saída, reabrir rascunho e entrada de Importar PDF. | Importador usa o diálogo nomeado da primitive para foco inicial, Tab, Escape e retorno ao acionador. |

Somente três fontes do app e um teste foram alterados nesta rodada. Não houve
redesenho dessas áreas, alteração de consulta, autorização, domínio ou persistência.

## Evidência e limites

O primeiro loop foi uma leitura em `localhost:8081/login`; a sessão normal foi
preservada. As contas fictícias usam o mesmo checkout em `127.0.0.1:8082` com
Supabase local em `127.0.0.1:54321`. Sessões e credenciais não fazem parte do hub.

Avisos e Regulamentos têm respostas fictícias interceptadas no navegador.
Leitura de aviso, falha e recuperação de sync não escreveram no servidor nem
sincronizaram fontes externas. A abertura de fonte foi observada interceptando
`window.open`. Não houve decisão de ausência, arquivamento, envio ou concessão
de acesso. Planejamento usou texto inventado e rascunho real apenas no storage
do contexto efêmero do navegador, sem aplicação à turma.

A importação foi conferida até abrir e fechar o modal. Nenhum PDF foi escolhido
ou analisado; o documento editável não é prova de exportação PDF. O before do
importador é escuro; a captura clara feita após hot reload está classificada como
after, apesar do nome histórico da pasta. Frames intermediários e tentativas
incompletas ficam fora da seleção dos comparativos.

## Validação do recorte final

Nível 2 para as interações locais; o HTML/documentação recebeu revisão de fontes,
links e comportamento, sem gates de release por hábito.

- Nove testes passaram: três casos do callback de teclado e seis testes
  existentes do importador PDF. Estes últimos conferem fonte/progresso; foco
  do modal foi comprovado separadamente no navegador.
- `typecheck:app` passou no delta final com Node 24.13.0; diff e sintaxe do
  gerador passaram. Três fontes do app e um teste diferem do baseline de
  2.058 arquivos, sem outras alterações de app nesta rodada.
- UI/UX conferiram os três fluxos em 390 × 844, claro/escuro. UI executou
  crosscheck próprio de Avisos, Regulamentos e PDF; UX conferiu também editor,
  desfazer/refazer e reentrada do rascunho.
- Hub conferido por UI em 390, 834 e 1440 px e por UX com teclado. Busca,
  vazio/limpar, links diretos, seleção, Antes/Depois móvel, ampliação, Tab,
  Escape, skip link e retorno do foco passaram. A revisão independente
  identificou dois problemas de foco do HTML; corrigidos e repetidos.
- Após integrar os novos dados, seis visualizações em 390/1440 passaram,
  sem overflow ou erro JS. Os 24 HTMLs originais e 401 PNGs referenciados
  responderam HTTP 200. Âncoras das fontes também conferidas.
- Seleção final: 179 recortes editoriais e 84 pares, incluindo as rodadas
  anteriores. Esta rodada acrescenta três pares e seis grupos de estados;
  o acervo de repetições por tema/interação não conta como novas telas.
- Revisão independente final sem achados acionáveis. Checklist regenerado:
  três notas atualizadas, 29 módulos/381 itens/124 rotas; títulos, estados,
  IDs e contrato da revisão pessoal preservados.

## Critérios de apresentação

Foram usadas as skills locais Design System, Web UI, Feature Workflow e Testing.
As referências externas foram consultadas por leitura, sem instalar ou executar
helpers: [Taste Skill](https://github.com/Leonxlnx/taste-skill/blob/main/README.md)
para conteúdo real/alinhamento; [Awesome Design MD](https://github.com/VoltAgent/awesome-design-md)
e sua [referência Linear](https://getdesign.md/linear.app/design-md) para capturas
como foco e controles discretos; [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md)
para semântica, foco, URL e diálogo. Marca, componentes e composições aprovadas
do Go Atleta permaneceram como autoridade do app.

## Foco por clique e teclado · lote 16

UI, UX e coordenação conferiram um controle representativo em cada uma das
19 áreas restantes no QA local, em claro e escuro a 390 × 844. Com os quatro
recortes anteriores, as 23 áreas têm evidência de clique e Tab nos dois temas.
Em Presença e NFC, o recorte web é o seletor de turma.

O Relatório da aula recebeu o único ajuste desta rodada. O foco de teclado
acompanha a borda arredondada do campo e deixa espaço ao redor do texto.
No HTML, a área tem antes e depois desse ajuste. As demais mostram clique e
Tab na versão atual. A busca de Turmas e a pesquisa da Agenda ainda mostram
o foco na área interna do texto, como registrado nos prints.

## Foco nas buscas de Turmas e Agenda · lote 17

Em 15/11, o indicador do Tab passou para a borda arredondada desses dois
campos. O clique mantém o visual em repouso. O mesmo inventário mostra
os comparativos claro e escuro a 390 × 844, com dados fictícios.

## Reprodução e fontes

- Template mantido em [inventory/hub-template.html](inventory/hub-template.html).
- Gerador local: [build-ui-inventory-hub.py](../../scripts/build-ui-inventory-hub.py).
- Acervo ignorado: `.tmp/auditoria-go-atleta-2026-11-13/`; novos registros em `lote-10/`.
- `catalogo-fontes.json` e `mapa-fontes.md`: proveniência, classificações e erratas.
- `galeria-manifesto.json` e `hub-data.json`: seleção editorial atual e entrada do gerador.
- `ux-evidencias.json`, `ui-hub-qa/`, revisão e validação final: escopo efetivamente conferido.

O gerador confere os arquivos locais e dimensões PNG antes de produzir o HTML,
escapa o JSON embutido e preserva a entrada anterior. Não altera o checklist nem
inicia servidores. Integridade dos arquivos não substitui a revisão no navegador.

```powershell
python scripts/build-ui-inventory-hub.py --root .tmp/auditoria-go-atleta-2026-11-13 --catalog .tmp/auditoria-go-atleta-2026-11-13/lote-10/hub-data.json
```

Trabalho local, sem build de release, commit, push ou publicação.
