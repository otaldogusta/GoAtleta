# Estúdio de scouting em vídeo — implementação web local

Data: 12/10/2026. Implementado no aplicativo web; sem publicação nesta rodada.
Referência visual: [mockup aprovado](SCOUTING_VIDEO_MOCKUP_2026-10-12.md).

## Entrada e autorização

A tela de scouting da turma oferece **Estúdio de vídeo** ao criar uma análise e
**Abrir estúdio** como ação principal da sessão em andamento; **Coletor manual** permanece como ação secundária. O coletor também oferece a entrada, preservando seu
rascunho e exigindo concluir/cancelar a edição do contato antes de trocar de tela.
A autorização continua no fluxo existente de organização/turma e em
`loadScoutingDetail`; a sessão retornada precisa corresponder à organização,
turma e ID solicitados. Sessões concluídas abrem sem edição. Não há nova rota
pública nem bypass de autenticação no aplicativo.

## Comportamento entregue

- Player de arquivo local, reprodução/pausa, velocidade, busca e passos de 0,033 s.
  Esses passos não prometem precisão de um quadro em vídeos com taxa variável.
- Cabeçalho flutuante recolhível, painel lateral em desktop e painel inferior
  responsivo com recolhimento, expansão por rolagem/toque e temas do aplicativo.
- Rallies manuais, miniaturas, divisão/união, ponto por equipe e quantidade na aba.
  A abertura inicial contém um único intervalo completo, sem cortes inventados.
- Timeline com capítulos clicáveis e detalhe ao passar o ponteiro/focar; modos de
  vídeo completo e rally selecionado, contatos e cobertura da bola na mesma escala.
- Contatos com instante, equipe, atleta real da turma ou sem atleta; nome/camisa
  manual opcional. Oito fundamentos, incluindo bola de graça e cobertura de ataque,
  com resultados próprios; ponto do rally é uma anotação separada do resultado do contato.
- Desfazer/refazer por teclado e histórico; salvar/reabrir rascunho explicitamente.
- Download do original, recorte individual e seleção de rallies em ZIP, com progresso
  e cancelamento. Recortes são gravados pelo navegador em tempo real, normalmente
  WebM, sem a camada da bola; limites não são garantidos no quadro exato. Lote limitado
  a dez minutos. Navegadores sem captura de vídeo recebem erro e mantêm o original disponível.
- Importação/exportação de marcações JSON validada e correção manual de coordenadas.
  Trajetória pode ser importada por identidade do vídeo com posições normalizadas
  `{fingerprint, positions: [{time, x, y}]}`; não é uma execução do detector.

## Persistência e limites

`src/core/scouting-video.ts` é um documento de anotação v1 separado dos contatos e
pontos oficiais. Marcações de vídeo **não alteram placar, métricas ou estatísticas
oficiais**. Os contratos `ScoutingContact`, comandos idempotentes e Supabase seguem
inalterados; não foi criada nem executada migration.

O rascunho usa AsyncStorage por usuário/organização/sessão/arquivo. A identidade
local usa tamanho e SHA-256 de amostras inicial/final de 1 MiB, com validação de
metadados; não constitui hash integral ou autorização. O arquivo deve ser escolhido
novamente ao reabrir. Falhas de quota mantêm o documento na memória e o erro visível.
Histórico: até cinquenta alterações em memória; até vinte persistidas, reduzidas
conforme orçamento de tamanho de 1,5 milhão de caracteres, sem cortar o documento atual.
Desfazer não apaga contatos fora do corte; divisão/união exigem reconfirmar o ponto.

Exportar JSON remove vínculos `studentId`, mas mantém nomes e marcações visíveis.
Importar não concede acesso a sessão, não aceita URL externa e verifica identidade,
limites e estrutura. Não há envio da mídia a servidor.

Continuam pendentes: serviço de processamento automático, recortes sugeridos,
upload/storage privado, sincronização remota das anotações, publicação nas estatísticas
oficiais e link de compartilhamento com atletas. A prévia de leitura não cria link.
A entrada em vídeo está disponível no **web**, incluindo navegador móvel; aplicativo
nativo mantém o scouting existente. O detector experimental do mockup não foi
incorporado como se fosse um serviço de produção.

## Validação registrada

- 17 testes focados aprovados: domínio temporal, contatos preservados, divisão/união,
  ponto, desfazer/refazer, importação, escopo, salvar/reabrir/histórico e falha de quota,
  além dos testes existentes do coletor.
- ZIP validado com leitor independente: duas entradas, CRC e conteúdo preservados.
- `npm run typecheck:app`, `npm run check:org-scope` e higiene de performance aprovados.
- Componentes reais compilados pelo Metro em `localhost:8081`, usando sessão fictícia
  em fixture temporária: importar arquivo, play/pause, dois contatos coexistindo,
  atalhos de desfazer/refazer, corte e foco do rally, download real WebM com áudio/vídeo.
  Exportação de um intervalo de 6 s produziu aproximadamente 6,24 s: limite do gravador,
  não exportação exata por PTS. Layout conferido em desktop, celular 393×852, horizontal 852×393 e tablet 834×1194, incluindo tema claro.
- Smoke autenticado pendente: este checkout está sem as duas configurações públicas
  de Supabase necessárias ao app. A fixture não prova autorização ou gravação remota.
  Nenhuma credencial foi copiada/modificada. Build de publicação e deploy não executados.

Fontes: [entrada](../../src/screens/scouting/ScoutingScreen.tsx),
[estúdio](../../src/screens/scouting/video/ScoutingVideoStudio.web.tsx),
[domínio](../../src/core/scouting-video.ts),
[rascunho](../../src/screens/scouting/video/use-video-draft.ts).

### Acesso pela sessão existente — 12/10

Abrir estúdio passou a ser a ação principal; Coletor manual ficou secundário. Conferência autenticada em localhost:8081: a sessão Jogo · Regenerados abriu o estúdio integrado e o estado Adicionar vídeo. Esta conferência valida a entrada, não a edição/persistência autenticada completa. Vídeo e marcações do mockup independente não são transferidos automaticamente.

Modal de importacao alinhado ao mockup: largura de 540 px, cartoes de modo com descricao, area tracejada de arquivo e resumo da midia escolhida. Automatico permanece indisponivel; exemplos locais e links do prototipo nao representam integracoes do aplicativo. Conferencia visual no localhost:8081.

Teste de viabilidade do modelo no navegador: [CPU e WebGPU](SCOUTING_BROWSER_BENCHMARK_2026-10-12.md). Integração descrita na atualização abaixo.

### Automático no navegador — 13/10/2026

Esta etapa substitui a indisponibilidade do processamento local descrita acima.
No modal, selecionar Automático, escolher o arquivo e acionar Analisar vídeo.
VballNet ONNX roda em Worker, com WebGPU e fallback de inicialização para WASM.
Modelo e runtime vêm da mesma origem; vídeo e quadros não são enviados a servidor.
ONNX Runtime Web 1.30.0 é fixado no lockfile. `prepare:scouting` prepara recursos
estáticos antes dos comandos npm start/web/dev:web/build; execuções diretas de
`expo export` precisam preparar os recursos primeiro.

Processamento limitado a 30 minutos e lotes de nove amostras de 768×432.
Amostragem temporal a 30 Hz por busca no player; não garante correspondência
exata a todos os quadros de vídeos VFR. Pré-processamento fica no navegador,
inferência no Worker. Cancelamento, erro ou saída encerram o Worker e liberam
o player auxiliar e a URL de objeto. Falha não apaga o documento aberto.

O resultado só entra no rascunho por **Usar sugestões**. Coordenadas automáticas
são separadas das correções humanas e ficam no documento exportável/persistido,
com versão do processador. Desfazer/refazer preserva essa separação. Contatos,
equipes e pontos não são inferidos nem alterados automaticamente.

Cortes são candidatos por mudança visual. A versão inicial usava diferença média
de luminância >12 em 128×72; a revisão abaixo substitui esse limiar.
Não são reconhecimento semântico de rallies. Na aba Validação, cada candidato pode ser visto e aceito com Criar rally aqui;
aplica as mesmas regras de divisão e reconfirmação de ponto do corte manual.
Quadros com confiança do modelo abaixo de 0,5 ficam sem marcação. Precisão em
outros vídeos e desempenho/memória total no celular ainda não validados.

Validação: 14 testes de domínio/rascunho, typecheck:app, check:org-scope,
check:perf-hygiene e diff check aprovados. Sem publicação ou serviço remoto.

Smoke autenticado local de 13/10: cancelar e reiniciar analise; clipe de 30 s concluido com 434 posicoes candidatas e zero cortes; Usar sugestoes, salvar, sair e reabrir o mesmo arquivo recuperou as 434 posicoes sem reprocessamento. Resultado de teste apenas local; nao mede precisao.


### Composicao e timeline — 13/10/2026

Revisao local comparada ao mockup em 8093: painel desktop de 300 px,
cabecalho com acoes nomeadas, cards alinhados a esquerda com tempo ao lado
do titulo, contatos com horario alinhado e controles sobre o video no retrato.
Acoes de edicao ficam em faixa sticky; menu de rallies fecha ao executar acao.

Timeline ocupa a largura disponivel: macro mostra os rallies como segmentos
na propria barra, com todos os contatos abaixo; micro limita o intervalo ao
rally e divide a barra pelos contatos, incluindo o trecho anterior ao primeiro.
Clique no segmento abre rally/contato; arraste do cursor e teclado permitem
busca continua. Hover/foco mostra detalhes. Faixas de contatos e bola usam
a mesma origem e escala temporal. Marcadores adversarios usam azul.

Conferencia autenticada local: 1384x704, 643x704 e 390x844; sem overflow
horizontal da timeline em 390 px. Fixture temporaria de quatro rallies e dez
contatos no clipe de 30 s, navegacao macro/micro, clique no contato em 4 s,
arraste para 5,899 s e desfazer a importacao conferidos. Rascunho original
restaurado sem salvar a fixture. 14 testes e typecheck:app aprovados.
Esta revisao nao altera a precisao do processamento automatico nem publica o app.

### Reprodução e recuperação dos resultados originais — 13/10/2026

A implementação inicial não carregava os resultados já processados do mockup.
Além disso, desenhava a trajetória no evento `timeupdate` (aproximadamente 4 Hz
na amostra), redesenhava a galeria com o relógio e serializava o documento inteiro
durante a reprodução. Essas diferenças explicam parte da distância percebida;
não eram apenas diferenças de aparência.

O desenho agora usa canvas sobre o vídeo, sincronizado por
`requestVideoFrameCallback`, com fallback para animation frame. A busca temporal
é binária; a trilha interrompe em lacunas, saltos e limites de rally. O editor
continua separado do desenho por quadro. Galeria e serialização são memorizadas;
miniaturas usam um único decodificador auxiliar por vez e cache limitado.

`scripts/convert-scouting-analysis.py` converte os arquivos locais de processamento
para o formato de análise do estúdio, incluindo fingerprint do vídeo e proveniência
`vballnet-v2b-local`. A opção **Importar análise processada** no modal aplica a mesma
validação da importação existente. Não envia vídeo nem resultados a servidores.
Contato/ponto manual do antigo armazenamento do mockup não é inferido na conversão.

Conferência autenticada em localhost:8081 com o vídeo completo de El Cartel ×
Regenerados: 80 inícios de rally e 20.222 coordenadas correspondem exatamente aos
arquivos originais após normalização. Importar, salvar e reabrir o mesmo vídeo
recuperou os resultados sem processamento. Em uma amostra de 2 s com a galeria
aberta, houve 50 callbacks de apresentação e 50 desenhos da trajetória, 58 quadros
decodificados e zero descartados; é uma medição curta deste aparelho, não garantia
para outros dispositivos. A pausa e a navegação pelos recortes foram conferidas.

Para análises novas, o corte de cena usa 160×90, limiar adaptativo
`max(3, mediana + 8 × MAD)` e supressão dos cortes mais fracos próximos (2 s), como
no processamento local do protótipo. Aceitar sugestões inicializa os recortes
somente em documento vazio; alterações humanas existentes são preservadas.
O detector de bola do navegador continua experimental e não equivale ao pipeline
local de candidatos e filtros temporais usado nesse jogo. Importar seus resultados
não comprova precisão em novos vídeos; não há contatos ou pontos automáticos.

Validação desta revisão: 19 testes focados, typecheck:app, check:org-scope e
check:perf-hygiene. Sem publicação, mudança de banco ou estatísticas oficiais.

### Imagem preta ao pausar/trocar rally — 13/10/2026

Reproduzido no navegador integrado: rally 1 em 00:00, player com `readyState=4`,
quadro decodificado válido (1202×676), mas superfície de vídeo preta na tela.
A camada de apresentação dos quadros que já existia no mockup ainda faltava no app.

`VideoFrame.web.tsx` apresenta os pixels decodificados em canvas, abaixo da
trajetória e com a mesma proporção do vídeo. O elemento de mídia continua como
única fonte de decodificação, relógio e áudio. A camada atualiza por quadro, ao
carregar, pausar, buscar e retornar à aba; limpa a imagem ao trocar/encerrar a
fonte e cancela listeners/callbacks na saída. Buffer limitado a 1920 no maior
eixo, sem reduzir o arquivo original ou a exportação.

Conferência local autenticada: primeiro rally pausado em 00:00, troca para rallies
2 e 43, retorno ao início, reprodução/pausa e redimensionamento. A imagem ficou
visível nesses estados. Na amostra curta de reprodução de 2 s, 56 quadros foram
decodificados e 2 descartados; isso não constitui garantia de desempenho contínuo.
Oito testes focados (ciclo da apresentação e busca temporal), typecheck:app e
check:perf-hygiene aprovados. Sem mudança de rascunhos, reprocessamento ou publicação.

### Navegação macro/micro e contatos — 13/10/2026

Clicar nos capítulos da timeline usa busca temporal sem alterar a escala. O modo
micro continua disponível pelo controle Rally selecionado ou por um cartão da
galeria. Hover e foco de teclado mostram os contatos do rally no macro e o contato
da etapa no micro, com equipe, atleta quando informado, resultado e instante.
A prévia permite navegar diretamente a cada contato, preservando o modo atual.

Marcas separadas por menos de 24 px agrupam com contador e lista completa; a
escala do rally separa novamente os contatos quando há espaço. ResizeObserver
mede apenas a faixa, e os agrupamentos são memorizados. Estado vazio informa
Sem contatos registrados. Corrigir posição da bola usa a mira `crosshair`
(`locate-outline`) do registro canônico de ícones.

A análise local do vídeo completo tinha 80 rallies e 20.222 posições, mas nenhum
contato. Cinco registros confirmados e presentes no histórico do mockup foram
recuperados, convertendo frame/30 para segundos e preservando fundamento, equipe
e resultado. A análise anterior foi exportada como backup; a recuperação passou
pela importação validada do app e foi salva no mesmo escopo de rascunho. Nenhum
contato foi inferido automaticamente nem enviado às estatísticas oficiais.

Validação: quatro testes de regressão para navegação, hover/foco, recorte e
agrupamento; typecheck:app e check:perf-hygiene aprovados. Smoke autenticado em
localhost:8081 confirmou clique no Rally 07 mantendo o macro e sua duração total,
hover do Rally 01 com quatro contatos, clique na recepção em 00:05.600 mantendo
macro e visualização dos quatro marcadores separados no micro.
Em 643 px, a faixa permaneceu sem overflow horizontal e a prévia agrupada dos
cinco contatos ficou dentro do viewport. Tamanho do navegador restaurado após a
conferência. Checklist regenerado; nenhuma publicação realizada.

Microajuste visual em 13/10: cores categóricas por fundamento na timeline e na
lista da prévia, independentes da equipe/resultado. Saque laranja, recepção azul,
levantamento lilás, ataque coral, bloqueio rosa, defesa verde, bola de graça ciano
e cobertura cinza claro. Letras e nomes continuam disponíveis. Grupos usam corpo
neutro com contador e faixa das cores presentes. Quatro testes existentes passaram.


### Refinamento dos resultados dos contatos — 13/10

A faixa categórica continua identificando o fundamento (ataque agora em índigo,
reservando vermelho ao erro). O corpo do marcador e a avaliação escrita na prévia
seguem o resultado: vermelho/× para Erro; laranja/! para recepção que limita o
ataque ou devolve direto, levantamento fora de condição ou enviado ao adversário,
e ataque Bloqueado; azul/✓ para Controlada/Atacável; verde/★ para Ace e pontos
diretos registrados. Em jogo, Bola segue em jogo e Não avaliado ficam neutros.
A classificação é específica por fundamento, sem transformar bola de graça em
recepção ruim, nem inferir erro terminal de um bloqueio. Nenhum vencedor é atribuído.

Grupos permanecem neutros com as faixas dos fundamentos e um símbolo de resultado
prioritário; o hover/foco discrimina as contagens de erros, contatos comprometidos,
pontos diretos e positivos. Cores usam os tokens semânticos do tema, acompanhadas
por símbolo e texto. A escala macro/micro e os instantes dos contatos não mudam.

Validação localizada: 23 testes da timeline aprovados, incluindo classificação,
grupo misto e preservação de documento/vencedores; typecheck:app aprovado.
Conferência em localhost:8081 confirmou passe devolvido direto em laranja, ataque
Erro em vermelho e grupo misto com 1 erro / 2 comprometidos. As duas alterações
temporárias de avaliação foram desfeitas, restaurando as cinco marcações salvas.


Microajuste visual posterior em 13/10: o marcador individual passa a usar a cor
sólida do resultado, removendo a faixa categórica por fundamento. Letras e nomes
preservam a identificação da ação. Bordas das prévias e faixas dos grupos também
seguem os resultados, usando os tokens semânticos já existentes; a classificação
dos contatos e o documento permanecem iguais. Os 23 testes existentes passaram.


### Cabeçalho, painel responsivo e contatos integrados — 13/10

Removidos Alternar tema, o botão de recolher análise sobre o vídeo e o atalho
redundante Ver vídeo completo na galeria. A escala permanece no controle da
timeline. Cabeçalho recolhido centralizado no topo, conforme a Quadra Visual;
as abas deixam de reservar os 66 px do cabeçalho expandido.

Tipografia do estúdio e dos botões usa o token Inter; abas têm alinhamento,
peso e estado ativo consistentes. No retrato, o painel ocupa o espaço restante
abaixo do player com rolagem própria, sem gesto de rolagem que altere sua altura.
A alça do painel permanece somente no layout estreito; no desktop o painel
continua visível mesmo ao retornar de um estado recolhido no celular.

Contatos foram integrados à própria barra, sobre as divisões temporais,
removendo a linha separada. Agrupamento, cores por resultado, prévias e instantes
são preservados. Novo teste cobre integração à barra e busca em macro/micro
sem troca de escala: 24 testes da timeline e typecheck:app aprovados.

Conferência autenticada local em 390×844, 834×1194 e 1440×1024 sem overflow
horizontal: cabeçalho central, painel com intervalo de 8 px no retrato e abas
compactas no desktop. Busca pela recepção confirmou 00:05.600 mantendo o rally.
O controle móvel foi recolhido e reaberto; os 80 rallies e cinco contatos salvos
foram reabertos sem alterar o documento. Viewport restaurado. Nenhuma publicação.


Refino pontual em 13/10: clique na área de um capítulo agora busca a posição
proporcional dentro do intervalo visível, em vez de sempre retornar ao início
da seção. Marcadores e teclado mantêm seus destinos exatos. A busca pela timeline
preserva reprodução/pausa; avanço quadro a quadro continua pausando. Dois casos
focados de clique passaram; conferência local confirmou 60% do vídeo completo
em 09:06.420 e 60% do Rally 05 em 01:04.246, mantendo a escala escolhida.
Sem repetição da suíte ampla ou da matriz responsiva.


Refino pontual em 13/10: escolha do contato abre Informações com o formulário
alinhado ao topo. A timeline recebe uma prévia separada do documento, cria a
etapa no micro e mantém a marca em edição visível também no macro, sem agrupá-la
aos contatos salvos. Borda tracejada e legenda com fundamento/instante indicam
Em edição; fundamento, resultado e instante acompanham o formulário. Confirmar
registra normalmente; cancelar remove a prévia ou restaura o contato original.
Um teste focado passou cobrindo prévia, alterações, macro/micro e cancelamento
sem mutar o documento. Conferência local confirmou Informações ativa e recepção
em 00:18.681 na barra antes de registrar. A prévia de teste foi cancelada.


### Instante do ponto — 13/10

Seleção do vencedor em três colunas: equipe à esquerda, N/D ao centro, adversário
à direita. Bandeira Marcar ponto no player pausa no instante atual e abre
Informações. A marca aparece no macro e no micro; no micro também delimita a
etapa Ponto. Painel permite ir ao instante, substituí-lo pelo atual ou removê-lo.
A marca representa o fim observado do rally, sem inferir a causa ou o vencedor.

Campo opcional `VideoRally.pointTime` em segundos, restrito ao intervalo do rally.
A serialização validada mantém a marca no rascunho/exportação/histórico e aceita
rascunhos anteriores sem o campo. Não altera contato, contagem oficial ou chaves
de escopo. Dividir/unir o recorte limpa o instante e exige nova marcação, seguindo
a reconfirmação existente do vencedor. Análise automática não sobrescreve rally
com instante de ponto já marcado.

Validação restrita: dois testes focados (domínio/serialização/undo/cortes e
marcador/etapa macro-micro) e typecheck:app aprovados. Conferência autenticada
mostrou a ordem ElCartel / N/D / Regenerados, bandeira em 00:25.035 e abertura
de Informações. Marca temporária removida ao concluir; seis contatos do usuário
preservados em rascunho local antes da atualização do app. Sem publicação.

## Compartilhamento por arquivo — 13/10 (substituído)

Registro histórico: abordagem rejeitada pelo usuário e removida. O contrato atual
é o compartilhamento por link abaixo; não usar o leitor HTML como referência.

`Compartilhar` prepara `go-atleta-analise.zip` com `analise.html`, o vídeo original
e `LEIA-ME.txt`. O leitor portátil permite navegar pelo vídeo completo, selecionar
rally, buscar contatos e pontos e ver avaliações e posições da bola. Nenhuma ação
edita o rascunho do treinador. Nomes de atletas são opcionais e desmarcados por
padrão; a projeção exclui IDs de aluno/contato/rally, nome original do arquivo,
fingerprint e histórico. Conteúdo textual usa JSON escapado e `textContent`; CSP
impede chamadas de rede e carregamento de scripts externos.

O treinador envia o ZIP por um canal de sua escolha. O destinatário deve extrair
todos os arquivos e abrir `analise.html` no computador. A abertura de HTML local
no celular depende do navegador; o vídeo também está disponível separadamente.
É uma cópia sem revogação. Nenhum upload, mensagem, banco, política de acesso ou
link remoto foi criado. O serviço hospedado continua pendente.

Exportação ZIP sem recodificar a mídia, com leitura de 2 MB por bloco, progresso,
cancelamento inclusive durante leitura assíncrona e limite ZIP32 verificado antes
do processamento. Validação funcional localizada: três testes de projeção,
conteúdo hostil, ZIP/CRC/leitura limitada/cancelamento e `typecheck:app` aprovados.
Geração real pelo app autenticado com vídeo de 860.741.220 bytes, 80 rallies e
12 contatos preservados. Leitor conferido em prévia HTTP local com suporte a
Range: navegação por contato, cores e troca macro/micro; abertura `file:` direta
não exercitada pela ferramenta de navegador. Sem publicação.


## Compartilhamento por link — 13/10

Pedido reconciliado: o destinatário abre **o mesmo estúdio**, com vídeo, rallies,
contatos, pontos, cores, trajetória e timeline macro/micro. Não há outro leitor
ou pacote ZIP. `Studio` recebe documento publicado e capacidades de visualização;
`useVideoDraft` não lê nem grava armazenamento nesse modo. A prévia do treinador
preserva seu documento e oferece retorno explícito à edição. Edição pelo atleta
fica futura: o contrato enumera capacidades, mas banco/servidor aceitam somente
`viewer`. Nenhum rascunho do treinador é sincronizado implicitamente.

### Contrato local

- Modal: equipe desta turma ou qualquer pessoa com link; visualização; validade de
  7/30 dias; envio privado com progresso, cancelamento e retomada; cópia e revogação.
- Restrito: usuário autenticado com e-mail confirmado e vínculo ativo de atleta na
  turma, ou acesso canônico da comissão. Matrícula revogada não é contornada pelo
  `classid` legado. O link não abre lista de atletas, outras análises ou telas da turma.
- Aberto: prova aleatória de 256 bits. Quem recebe pode encaminhar o link; a UI
  informa isso. Não concede gestão de permissões. O acesso restrito evita esse
  alargamento para pessoas sem vínculo.
- Prova no fragmento da URL e hash no banco. Novo link gira a prova e substitui o
  anterior; o modal atual permite copiar a prova recém-criada, sem persistir segredo
  no banco/rascunho. Ao reabrir, é possível revogar ou gerar novo link.
- `scouting_video_assets` e `scouting_video_shares` sem acesso direto dos clientes;
  RPCs de gestão exigem `scouting_can_access`. Conteúdo publicado não contém
  histórico local, nome original do arquivo, fingerprint ou IDs de aluno.
- Bucket privado `scouting-videos`, caminho imutável por organização/asset;
  Storage INSERT/SELECT somente para o autor autorizado. Nenhuma policy de UPDATE.
  TUS usa blocos de 6 MiB e identidade autenticada fixa durante envio/retomada.
- Edge verifica o usuário com Auth, resolve prova/permissão e só então assina o
  caminho devolvido pelo banco. Sem URLs públicas e sem `service_role` no cliente.
- URL da mídia válida por 5 minutos. Consulta do acesso a cada minuto e ao retornar
  à aba; uma URL já emitida pode continuar válida até expirar, e bytes já recebidos
  não podem ser recolhidos. Visualização não é proteção DRM contra cópias.
- Nova publicação atualiza o snapshot, com prova nova. Não promete colaboração
  simultânea ou edição remota. Reaproveita vídeo já enviado para o mesmo autor,
  organização, sessão e fingerprint.

### Ativação pendente

Não foram aplicadas migrations, publicado app/função, gerado link externo ou
feito upload. A UI local informa essa limitação e não oferece localhost como link
para a equipe. A ativação exige autorização de publicação e validação hospedada:

1. Rever/aplicar `supabase/migrations/20261013150000_scouting_video_sharing.sql`.
2. Publicar `scouting-video-share` com o `verify_jwt=false` definido no config;
   a função faz autenticação própria para links abertos e restritos. Usa somente
   as variáveis Supabase já existentes no runtime.
3. Conferir limite de arquivo, quota e custo do projeto antes do envio. O original
   tem 860.741.220 bytes. [Supabase Free limita a 50 MB por arquivo](https://supabase.com/docs/guides/storage/uploads/file-limits);
   o teto de 2 GiB do bucket não aumenta o limite global nem muda o plano.
4. Publicar o app e verificar com duas contas: dono e atleta vinculado; negar outra
   turma, conta removida, prova inválida, link vencido/revogado e qualquer escrita.
5. Conferir TUS interrompido/retomado, reprodução por Range e renovação da URL,
   inclusive CORS. Inventariar/limpar objetos órfãos e uploads abandonados antes
   de uma disponibilização ampla; revogar link não apaga o vídeo do armazenamento.

### Evidência local

Classificação: nível 3 (dados/segurança), com build por nova rota/dependência.
SQL isolado passou: permissão da comissão, negação de atleta/outra organização,
matrícula revogada, RLS do storage, mídia imutável, rotação, expiração e revogação.
Teste isolado da função passou: limites de corpo, identidade verificada, negação
sem assinar mídia, projeção e TTL privado. Doze testes Jest focados passaram,
incluindo tentativas diretas de mutação no hook de leitura. `typecheck:app`,
`check:org-scope`, `check:perf-hygiene` e build web com 122 rotas passaram.
O build valida o app, não substitui a ativação/teste de upload remoto acima.

Conferência autenticada no localhost: modal de acesso no padrão de campos do
estúdio; prévia do mesmo player com 80 rallies/20 contatos e busca pela recepção
em 00:05.600; controles de salvar, marcar contato/ponto, compartilhar e baixar
não aparecem em leitura. Retorno à edição mantém o rascunho. Rota pública sem
prova mostra estado de link inválido. O fluxo remoto completo com upload e duas
contas segue pendente de ativação, como indicado acima.


## Fonte YouTube integrada localmente — 13/10

Adicionar vídeo agora oferece arquivo local ou link HTTPS do YouTube. O parser
aceita apenas hosts e formatos conhecidos e guarda o ID, nunca uma URL arbitrária
para o iframe. A prévia verifica metadados antes de abrir; erros de vídeo privado,
removido, incorporação bloqueada e conexão são apresentados sem substituir o
rascunho anterior. Trocar de fonte salva mudanças pendentes antes da abertura.

O transporte do estúdio usa uma interface comum de tempo, pausa, reprodução e
velocidade. A fonte local mantém `HTMLVideoElement`, canvas e tracking. YouTube
usa a API IFrame oficial, com controles próprios preservados, sincronização de
200 ms, passos de um segundo (sem prometer busca exata por quadro), rallies,
contatos, pontos, histórico e timeline macro/micro. Cabeçalho, painel, controles
e dicas ficam fora do player. Não baixa mídia, não extrai miniaturas/frames nem
executa ONNX sobre o iframe. O rascunho `youtube:<ID>` é separado do arquivo local;
marcações existentes não são transferidas automaticamente entre fontes.

O contrato `VideoMedia.youtubeId` é opcional e validado, preservando rascunhos
anteriores. Publicação mantém o mesmo estúdio somente leitura. A migration
complementar `20261013170000_scouting_video_youtube.sql` adiciona fonte exclusiva
Storage/YouTube e `prepare_scouting_youtube_share`; o RPC existente publica a
projeção vinculada ao ID validado sem exigir objeto no Storage. A Edge Function
não assina URLs de Storage para YouTube. Vínculo, escopo, prova, rotação,
expiração e revogação seguem as mesmas verificações. Ativação remota pendente;
nenhuma migration aplicada, mídia enviada ou link publicado nesta etapa.

Validação local: 42 casos focados (parser, playback, descarte de callbacks,
rascunhos separados, core e compartilhamento), SQL PGlite com dados sintéticos
e handler Edge isolado passaram; tipos, lint focado, org-scope e perf-hygiene
strict passaram. Smoke autenticado no localhost: rejeição de domínio externo,
vídeo público da documentação, marcação de ponto/divisão de rally, busca sem
mudar macro e desfazer; fixture não salva. Link informado pelo usuário incorporou
e reproduziu com duração 15:11. Rascunho original conferido no armazenamento com
80 rallies, 20 contatos, 7 pontos e 20.222 posições. Testes offline não certificam
publicação remota nem acesso hospedado com duas contas.

Referências oficiais: [API IFrame](https://developers.google.com/youtube/iframe_api_reference)
e [regras do player](https://developers.google.com/youtube/terms/required-minimum-functionality).
Vídeo não listado pode ser repassado: permissões da análise não tornam a mídia privada.

Conferência visual adicional: 390×844, 834×1194 e 1440×1024, sem sobreposição
do player pelos controles/painel; prévia de leitura sem edição conferida no
mesmo estúdio. O original local foi reaberto com imagem e 80 rallies/20 contatos.
Teste de regressão cobre a desmontagem do iframe sem apagar a referência do
player local que o substitui. Captura local ignorada: `.tmp/scouting-youtube-final.png`.


## Análise de YouTube por Gemini — piloto local em 13/10

Implementada no mesmo estúdio por `YouTubeAnalysis.web.tsx`, API em
`src/api/scouting-video-ai.ts` e serviço `scripts/scouting-youtube-service.mjs`.
Iniciar com `npm run dev:scouting-ai` neste checkout. A chave
fica no arquivo privado `%USERPROFILE%/.config/goatleta/gemini.local.env`, variável
`GEMINI_API_KEY`, fora do Git e sem prefixo público. Não imprimir seu conteúdo.
O serviço escuta somente 127.0.0.1:8094, exige Host e Origin exatos, JSON e
cabeçalho anti-CSRF; o cliente só está habilitado em desenvolvimento localhost:8081.
Não é uma API pública nem substitui a autorização Supabase da sessão. Produção
requer endpoint autenticado com cota por usuário/organização; não houve deploy.

Diagnóstico real: chave/listagem de modelos HTTP 200; 3.8 Flash falhou também
com texto simples (503), 3.5 teve timeout, 3 Flash Preview retornou 503; Pro
retornou 429 com cota gratuita zero. 3.1 Flash Lite respondeu com tokens de vídeo.
A primeira amostragem customizada produziu saques suspeitos na inspeção visual.
O piloto passou a usar amostragem padrão, raciocínio high e instrução conservadora.
Precisão de contatos/tempos continua experimental; retorno HTTP 200 não certifica
qualidade esportiva. Não apresentar contagens como eventos confirmados.

Processamento sequencial em blocos de até 60 s, máximo 30 min, timeout de 75 s,
cancelamento e cache por vídeo/trecho/modelo/versão de prompt fora do repositório.
O navegador recebe um job e consulta o progresso por requisições curtas; uma
reconexão ao mesmo trecho reutiliza o job em andamento. Uma repetição automática
é permitida após 503 explícito, nunca após timeout de consumo desconhecido.
Respostas MAX_TOKENS são descartadas e o trecho pode ser subdividido até 15 s,
ainda dentro do timeout geral; JSON truncado nunca é aplicado.
Repetir recupera blocos concluídos sem cobrar novamente por eles. Sem upload do
original: a única fonte enviada é o URL canônico YouTube. O provedor documenta
suporte a vídeos públicos; privados/não listados não são garantidos.

O serviço solicita `responseSchema` explícito (o formato JSON Schema alternativo
foi recusado por esta combinação de API/modelo). Sugestões são validadas
novamente por formato, intervalo e fundamentos. Observações individuais inválidas
são descartadas com aviso, sem ajustar tempos por suposição; resposta inteiramente
inválida continua sendo rejeitada. Aplicação explícita
exige mapear lado próximo/distante à equipe; conferir trocas de lado antes do
aceite. Lado incerto é ignorado. IDs/nomes de atletas, avaliação, placar e vencedor
não são inventados. Marcas anteriores são preservadas, recortes pontuados não
são divididos automaticamente, duplicatas próximas são ignoradas e o histórico
permite desfazer. O rascunho original do arquivo local não é alterado.

Referências: [vídeo Gemini](https://ai.google.dev/gemini-api/docs/video-understanding),
[clipping no GenerateContent](https://ai.google.dev/gemini-api/docs/generate-content/video-understanding).

Validação local do pacote: 16 testes focados (core, UI, cliente e serviço),
tipos do app, lint focado, escopo, arquitetura, performance strict e diff.
Casos incluem origem/Host/cabeçalho, limites de tempo, quota, retry limitado,
job assíncrono/cache, rejeição de resposta inválida, cancelamento e ausência de
aplicação automática. Conferência visual desktop/celular e execução real via
localhost realizadas; sem commit/push, deploy ou alteração de plano.

Execução real concluída em 13/10 para `mdfgd1K3HTc`: 16 trechos contíguos,
15:11 processados, 94 rallies e 296 contatos sugeridos. Resultado exibido no
mesmo estúdio; aceite habilitado somente após mapear a equipe. Nenhuma sugestão
foi aplicada ao rascunho real durante a validação. Não confundir essas contagens
com eventos esportivos confirmados. Evidência visual local ignorada:
`.tmp/scouting-gemini/youtube-analysis-complete.png`.

Conferência esportiva posterior reprovou o lote 94/296 para aplicação em bloco:
saques/cortes propostos divergem das imagens em múltiplos trechos. Nenhuma
sugestão aplicada; reconstrução completa ainda pendente. Testes técnicos acima
não validam a precisão esportiva. Ver [evidências e limites da revisão](../operations/scouting-youtube-review-2026-10-13.md).


Atualização final de 13/10: revisão visual sequencial de todo o vídeo (0–910,7 s), com ampliação dos contatos candidatos. Aplicados e salvos no rascunho YouTube 78 segmentos de rally e 201 contatos observáveis; exportação da UI idêntica ao documento validado. Contatos encobertos ou ambíguos excluídos, sem atribuir atletas/resultados/pontos. Cobertura temporal completa não significa anotação de todos os toques nem precisão automática certificada. Detalhes em `docs/operations/scouting-youtube-review-2026-10-13.md`. Rascunho do arquivo original preservado.


Hover YouTube corrigido em 13/10: removido o tooltip estático que aumentava a altura dos controles e deslocava a timeline. Balão fixo limitado ao painel lateral, fora do vídeo. Conferência local: marcador permaneceu em y=641 antes/depois do hover (antes deslocava para y=524); 28 testes focados da timeline aprovados. Sem alteração nas marcações.


## Tracking associado ao YouTube e comparação de modelos — 13/10

Implementado localmente no mesmo estúdio, sem serviço novo nem upload. Em
**Validação > Tracking da bola** (também em Vídeo e análise), escolher o original
ou importar a exportação de sua análise. Confirmar mesma edição e offset em
segundos: `tempo YouTube = tempo original + offset`. Apenas posições/cortes são
associados; rallies, contatos e correções existentes não são substituídos.
Aplicar e salvar são ações explícitas. Novos links repetem esse fluxo com o
original correspondente uma vez; depois bastam link e rascunho salvo neste aparelho.
Somente o link não oferece os quadros para o detector. Não foram implementados
extração do stream, download de terceiros ou sobreposição no IFrame.

O painel mostra a **vista da câmera**, com posição/trilha normalizadas e ausência
quando não há amostra. Não representa coordenadas de quadra ou altura/velocidade
3D. Pausa, seek, macro/micro e esconder trajetória permanecem no estúdio. Correção
manual é possível no painel quando a edição está autorizada; leitor não recebe
ações de processamento/correção. A consulta do tempo do IFrame é aproximada.

`VideoAnalysis.source` guarda apenas fingerprint do original, basename, duração,
dimensões e offset; parser sanitiza/valida limites e timestamps. Históricos e
rascunhos antigos sem source permanecem compatíveis. Nenhuma migration nova
é necessária para o rascunho local; compartilhamento remoto permanece inativo.

Modelos: VballNet GridV2b recomendado/padrão e V4c comparação opt-in, ambos ONNX
MIT pinados e servidos pela própria origem. Worker valida formatos e libera
tensores; WebGPU preferencial, WASM fallback. Pesos/formatos/licenças e estudo de
11 famílias em [comparação técnica](../operations/scouting-ball-model-comparison-2026-10-13.md).
Filtro de confiança/continuidade remove apenas excursão isolada fraca com
vizinhos confiáveis, respeitando cortes e lacunas. Não infere contatos/pontos
nem interpola bola encoberta. Os 20.222 pontos antigos foram reutilizados, não
recalculados pelo filtro novo.

Evidência real: comparação CPU de 450 quadros/3 trechos do original, sem ground
truth; ambos têm perdas, sem superioridade geral demonstrada. Os dois workers
também executaram um lote de nove quadros no IAB/WebGPU. Esse teste não mede
precisão esportiva nem runtime sustentado; não comparar scores entre modelos
como probabilidades calibradas. Resultado privado em
`.tmp/scouting-model-research/browser-worker-result.json`.

Aplicação no rascunho real YouTube: **78 rallies / 201 contatos / 20.222 posições**,
origem vinculada e offset 0. Exportação pela UI confirmou anotações intactas;
reabrir o link recuperou o tracking sem selecionar original novamente. Original
local preservado. Evidência `.tmp/scouting-gemini/review/tracked-youtube-export.json`.

Preparo para treino assistido: `scripts/scouting-ball-review-dataset.py` exporta
frames originais/candidatos/correções/lacunas, com manifesto por jogo e partição.
Execução no rascunho criou 27.322 linhas: 20.222 candidatos e 7.100 desconhecidos,
todos ainda exigindo revisão. Nenhum treinamento foi executado; ONNX não implica
checkpoint treinável disponível. Revisão/dados autorizados/checkpoint e teste em
outros jogos continuam necessários antes de promover um detector treinado.

Validação local: 74 testes Jest focados no conjunto afetado, 8 de decoder e 13 da
ferramenta Python; tipos app/core, lint focado, escopo, arquitetura e performance
strict e build web passaram. Smoke autenticado: associação, salvar/exportar,
reabertura, seek e painel. Sem commit, push, deploy, migration ou gasto remoto.

Retomada do IFrame: enquanto um modal estiver aberto, o player é pausado e ocultado por opacidade, preservando sua superfície carregada. Conferida ida/volta com imagem, tempo e tracking em 24,7 s. Tela de 390 px sem overflow horizontal; painel e controles externos ao vídeo.

### Trajetória sobre o original no mesmo estúdio — 13/10

Os controles **Reproduzir pelo YouTube / Original com tracking** alternam a fonte
de reprodução mantendo o documento do link. Para mostrar a linha sobre a imagem,
selecionar o original que gerou o tracking: fingerprint, duração e dimensões devem
coincidir com `analysis.source`. Selecionar um arquivo diferente é rejeitado antes
da troca. O arquivo entregue pelo processamento local já fica disponível para
reprodução após Aplicar; importar JSON exige selecionar o original separadamente.

`original-playback.web.ts` traduz o relógio local pelo offset associado, limita
seek à mídia disponível e mantém a velocidade. A troca pausa e conserva o instante;
não cria outro rascunho, altera contatos/rallies, cancela o editor ou exige novo
processamento. Overlay usa a resolução original e o tempo de cada quadro, respeita
cortes e lacunas, e permanece compatível com correções existentes. O original não
é enviado nem arquivado por este seletor; após fechar/recarregar, selecionar de novo.
No player YouTube, a trajetória continua somente no painel externo. As permissões
de leitura impedem seleção de mídia, processamento e correção.

Validação desta mudança: 39 testes focados (identidade, offset/seek, overlay,
handoff do File e propriedade/restauração do player), tipos do app, lint focado e
diff aprovados. Smoke autenticado no localhost: arquivo de 30 s rejeitado;
original correto aberto com linha sobre a imagem; reprodução/pausa e troca
YouTube/original conservaram 36,5 s, velocidade 0,5× e contato em edição. Velocidade
restaurada a 1× ao terminar. As exportações antes/depois são idênticas em SHA256
(`24fb8f0cbc31f6540c1e84e6bba28177084264f32a2ea29ca81af767d688dac2`):
78 rallies, 201 contatos, 20.222 posições. Evidência local ignorada:
`.tmp/scouting-model-research/tracking-overlay-final.png`. Leitura conferida pelo
guard de capacidades; não foi exercitada uma sessão remota de compartilhamento.

### Piloto de coordenadas pelo link — 13/10

Executado separadamente da UI: Gemini 3.1 Flash Lite recebeu somente a URL em
20–40 s, com 80 instantes solicitados. Retornou 48 posições e 32 desconhecidos,
mas foi reprovado visualmente: oito coordenadas comparáveis ficaram a 43–407 px
da bola e houve seis omissões em 14 frames observáveis. Nenhuma posição aplicada;
tracking original e marcações do rascunho preservados. 12 testes mockados e lint
do piloto passaram. Ver [método, evidências, consumo e limites](../operations/scouting-youtube-ball-pilot-2026-10-13.md).

### Original do Drive — 14/10

O controle Drive abre o mesmo estúdio/documento YouTube com um original público
em streaming, sem seleção ou gravação de MP4 local. A confirmação de mesma edição
e offset permite reaproveitar posições existentes ou rastrear o vídeo na aba com
VballNet. O gateway loopback usa Range limitado e capacidades temporárias para
compatibilizar CORS; não é um backend de produção. Roboflow é outra ação explícita,
experimental e dependente de credencial somente em memória.

O aceite aplica exclusivamente `analysis` sobre o documento atual e apresenta a
trajetória sobre o vídeo do Drive. Marcações humanas e identidade YouTube ficam
preservadas. Links, IDs e tokens de acesso não entram no rascunho/exportação.
Leitores não podem iniciar esse fluxo. Ver
[contratos, validação e limites](../operations/scouting-drive-tracking-2026-10-14.md).

Smoke completo pelo Drive concluído: 17.508 posições geradas, aplicadas e salvas;
78 rallies e 201 contatos idênticos na exportação antes/depois. Reprodução com
overlay e reassociação do original sem recalcular conferidas no localhost.
Buffer de 2 MiB por janela e cache global de 32 MiB somente em RAM reduzem seeks
repetidos; estimativas e lacunas permanecem revisáveis.

### Organização compacta — 14/10

Entrada única para YouTube/Drive, lista de rallies com miniaturas, editor contextual em Contatos e trajetória em Informações. Salvar desabilitado sem alteração; layout responsivo nos dois temas. Exportação integral preservada. Ver [composição e evidências locais](../operations/scouting-studio-ui-2026-10-14.md).

### Fechamento para main — 14/10

Backend de compartilhamento ativado (migrations e função v1), com verificação de permissões e erros remotos. Publicação web autorizada; Drive/Gemini permanecem locais. Ver [validação, escopo e limites](../operations/scouting-release-2026-10-14.md).

### Modal de compartilhamento como o Drive — 14/10

Título com o nome do jogo, Pessoas com acesso (conta atual, sem atribuir propriedade), Acesso geral em faixa com Leitor e rodapé Copiar link / Concluído. Prévia e revogação ficam na engrenagem. Removidos contadores, explicações repetidas, opções de validade e acordeão. O primeiro Copiar link publica e tenta copiar; falha de clipboard exibe o campo para cópia manual. Gerar novo link continua explícito quando substitui um link anterior. Permissões de equipe/link e leitura preservadas; convites individuais e edição continuam fora do contrato.

Novos links solicitam `p_days: null`. A migration `20261014162412_scouting_video_share_no_expiry.sql` permite prazo nulo e o resolver aceita esse estado, mantendo prova, revogação, organização e matrícula. Clientes anteriores continuam podendo enviar 7/30 dias. Não há backfill: links antigos vencidos ou revogados não são reativados. A URL assinada da mídia continua durando cinco minutos e sendo renovada pelo leitor. Aplicar a migration antes de publicar o novo cliente; ela está preparada e testada localmente, não aplicada remotamente nesta rodada.

Validação proporcional: nove testes Jest de compartilhamento/API, integração SQL isolada (sem prazo para Storage/YouTube, compatibilidade, expiração legada, revogação, rotação e escopo), typecheck, org-scope e perf-hygiene dos dois componentes aprovados. Modal autenticado conferido em desktop e 390 px, seletor e engrenagem exercitados, sem overflow. A consulta remota de acesso respondeu HTTP 200 após renovação da sessão. Nenhum link real criado e nenhuma marcação editada. Evidências privadas em `.tmp/scouting-share-ui/drive-desktop.png` e `drive-mobile.png`. Ajuste local, posterior ao release.

Menus de compartilhamento (14/10): acesso e função usam o mesmo componente com Pressable e AnchoredDropdown dentro do dialog, sem select nativo. A opção `surface="solid"` mantém o fundo do tema sem degradê/desfoque; hover segue o Pressable do app e foco de teclado usa superfície/ênfase, sem contorno. Leitor permanece selecionado; Comentador e Editor continuam desabilitados. A escolha da audiência só informa mudança se o valor for diferente. Menus limitados ao viewport CSS; Escape, seleção e clique fora fecham a lista. Cinco testes focados e typecheck aprovados; troca de audiência, hover, fundo sólido e encaixe em desktop/413 px conferidos no localhost. Nenhuma ativação remota nesta rodada.

Timeline (14/10): removido o `gap: 7px` herdado de StudioAction que zerava segmentos curtos. No macro, traços dos contatos substituídos por marcadores com contagem (ou letra do fundamento quando isolado). O agrupamento reserva 44 px no macro e mantém 24 px no micro, preservando todos os contatos e instantes; hover e clique continuam disponíveis. Cabeçalho informa rallies e contatos. Etapas menores ficam na faixa abaixo da barra temporal, alinhadas ao mesmo eixo. O balão abre acima do marcador com no máximo 300 x 280 px, também no YouTube, substituindo a ancoragem antiga no painel de informações. Trinta e dois testes focados e typecheck aprovados, incluindo limites de 320 e 1063 px. Após recarregar a aba que retinha o bundle anterior, a conferência local mostrou 22 grupos legíveis, nenhum traço antigo e rascunho recuperado com 78 rallies, 201 contatos e 17.508 posições.

Layout lateral (14/10): limite de duas colunas ajustado de 1200 para 900 px. Painel com largura adaptável de 300 a 340 px e rolagem própria; abaixo de 900 px, composição empilhada. Conferência local em 1063 e 834 px sem transbordamento horizontal, preservando o contato em edição e os 78 rallies/201 contatos. Ajuste apenas de CSS, sem nova execução de testes ou build.

Controles e seleção (14/10): Vídeo completo passou ao primeiro item da galeria, com miniatura, título e duração; removida a faixa de modos acima da timeline. Editor em Contatos com campos de cerca de 40 px, espaçamento compacto e StudioSelect baseado em Pressable/AnchoredDropdown sólido, também na velocidade. Foco por ênfase sem contorno verde, ícones do cabeçalho centralizados sem texto oculto reservando largura. Setas esquerda/direita seguem o passo do transporte; atalhos ignoram campos, menus e modais. Clique fora/Escape desmarca contato sem alterações; pendências permanecem abertas até salvar/cancelar. Menus suportam seleção atual, setas, Home/End, Escape e foco sem rolagem da página.

Validação desta rodada: 37 testes focados (timeline, galeria, editor, interações e seletor), typecheck e lint dos componentes aprovados. Conferência autenticada em 943 e 413 px: seleção macro/micro pela galeria, menu de fundamento/velocidade, setas deslocando 1 s no YouTube, desmarcação, proteção e cancelamento de uma edição temporária, alinhamento e ausência de transbordamento. Rascunho recuperado com 78 rallies e 201 contatos; nenhuma marcação salva nesta rodada. Evidências privadas em `.tmp/scouting-share-ui/studio-galeria-completo.png` e `.tmp/scouting-share-ui/studio-editor-compacto.png`.

Galeria (14/10): composição restaurada ao mockup aprovado (`mockups/scouting-video-2026-10-12.html`): grade com duas colunas no painel lateral, miniaturas acima do nome e intervalo; Vídeo completo permanece primeiro item. Colunas adaptáveis em painéis mais largos, sem overflow na largura conferida de 943 px. Ajuste de CSS, sem alteração de seleção, dados ou persistência. Conferência visual local e diff, sem repetir testes funcionais/build.


Resultado na galeria (14/10): duas bolinhas com iniciais das equipes sobre cada miniatura de rally, usando os tokens do tema, sem fundo envolvendo o par, com × entre as bolinhas. A primeira identifica a equipe da turma, a segunda o adversário; `winner` acende somente a vencedora, e indefinido mantém as duas apagadas. Nomes e resultado no hover e na descrição acessível do botão; Vídeo completo sem indicadores. Substitui a linha de texto Ponto para manter a altura dos cards. Dois testes focados aprovados cobrindo indefinido/A/B, leitura compartilhada e ausência de inferência a partir de contato com ponto; conferência visual no localhost em 943 px. Nenhum resultado salvo foi modificado.


Balão da linha do tempo (15/10): contato individual em 220 px, sem cabeçalho duplicando o fundamento, sem intervalo repetindo o instante e sem linha Não avaliado. Equipe/atleta, avaliação registrada e estado Em edição permanecem disponíveis. Grupos limitados a 260 × 240 px; posicionamento acima e ações existentes preservados. Hover de Ataque conferido no localhost em 943 px (220 × 58 px); 32 testes focados aprovados.


Marcadores das etapas (15/10): letras individuais em balões compactos com ponta superior voltada para a linha do tempo, conforme referência desenhada. Ponta herda o preenchimento do marcador e o contorno do tema, preservando cores de avaliação, dimensões e interação. Ajuste somente de CSS; conferência visual local.


Arraste da linha do tempo (15/10): `useTimelineScrub` separa a posição provisória do tempo assíncrono do player. Durante o gesto, posição, barra e legenda usam a prévia local; uma única busca é enviada ao soltar. Captura do ponteiro mantém o arraste fora do controle; cancelamento/perda de captura e troca de rally não aplicam uma prévia antiga. Teclado e cliques continuam com busca imediata. O adaptador YouTube retorna o destino enquanto aguarda uma amostra nova do iframe, sem aceitar a amostra de origem como confirmação de buscas curtas; limite de 2 s evita congelamento em falha. Estado pausado/reproduzindo preservado.

Comparação no localhost em 943 px: nos mesmos cinco deslocamentos horizontais (320/360/400/440/480 px), antes a UI reportou 22.433/22.433/22.433/24.712/25.460 s; depois, 23.218/23.965/24.712/25.460/26.207 s, acompanhando cada posição e mantendo 26.207 s ao soltar. 60 testes em quatro suítes passaram (timeline, YouTube, original e galeria), além de typecheck e perf-hygiene dos três módulos afetados; teste específico do adaptador repetido após cobrir buscas curtas. Análise e resultados do usuário não foram salvos nem alterados pela validação.


Navegação por marcações (15/10): o usuário esclareceu que as setinhas devem percorrer os instantes anotados dos fundamentos, não segundos ou quadros arbitrários. Marcação anterior/Próxima marcação e setas do teclado agora buscam os contatos e pontos visíveis em ordem temporal, incluindo milissegundos, com pausa no destino. Rally selecionado limita a busca ao recorte; Vídeo completo permite percorrer todos os contatos. A prévia em edição substitui seu instante salvo sem gravar; sem marca na direção, o botão fica desabilitado. Campos, menus e modais mantêm seus atalhos. No original parcial, marcas fora do intervalo disponível são excluídas.

Validação: 41 testes focados (navegação, timeline e interações), typecheck, lint e perf-hygiene dos dois módulos aprovados. No localhost, cliques produziram 17.500 → 18.850 → 20.350 → 21.600 s e retorno a 20.350 s; teclado conferido em 22.600 ↔ 23.300 s, com pausa. Durante Fast Refresh, a mudança na assinatura de hooks reiniciou o Studio e descartou estado não salvo; incidente informado ao usuário. Mesmo vídeo reaberto com o rascunho salvo de 78 rallies; ElCartel recolocado como vencedor do Rally 01 conforme evidência visual anterior, mantendo a alteração sem salvar. Não houve gravação de rascunho ou publicação. Não há garantia de recuperação de outras alterações não salvas que não estavam visíveis. Evidência privada: `.tmp/scouting-share-ui/timeline-mark-navigation.png`.


Foco da linha do tempo (15/10): regra genérica de input:focus-visible aplicava o fundo de formulário ao range sobreposto, ocultando os segmentos. O fundo passa a excluir inputs do tipo range. Regressão reproduzida com Tab no localhost: fundo rgb(22, 32, 51) antes e transparente depois, com a linha de progresso visível no mesmo instante 27.356 s. Ajuste somente de CSS, validado visualmente e por diff; análise aberta e alterações pendentes preservadas. Evidência privada: `.tmp/scouting-share-ui/timeline-focus-line.png`.


Área de clique da linha do tempo (15/10): busca proporcional movida do container de 42 px para a própria faixa de progresso, com 8 px de altura. Espaço acima/abaixo deixa de buscar; capítulos e seus botões acompanham essa faixa sem deslocamento por alinhamento de texto. Teclado, balões de contato e arraste do indicador preservados. No localhost, cliques acima/abaixo mantiveram 27.356 s, clique na linha levou a 23.766 s e arraste chegou a 25.273 s. 34 testes da timeline e typecheck aprovados; sem reiniciar o estúdio ou salvar a análise. Evidência privada: `.tmp/scouting-share-ui/timeline-click-track.png`.


Ajuste fino separado das etapas (15/10): adicionados Voltar/Avançar um quadro junto ao play, mantendo as setas externas para marcações. Passo de referência fixo de 1/30 s, explicitamente aproximado no nome acessível/tooltip; não infere FPS a partir do sampledFps do tracking. Pausa antes da busca, limita ao rally e à interseção com o original disponível e ignora intervalo vazio. Sem nova assinatura de hooks do Studio, mantendo análise e pendências abertas. No iframe, seekTo pode arredondar para um keyframe se o trecho não estiver carregado, portanto não se promete quadro decodificado exato: https://developers.google.com/youtube/iframe_api_reference#seekTo .

Validação: 29 testes de ajuste fino/adaptadores passaram, mais typecheck, lint e perf-hygiene da tela. Sequência real no localhost: 18.850 → 18.883 → 18.917 → 18.950 → 18.917 s, pausada e estabilizada no destino. Em 413 px, controles quebram linha sem overflow; viewport original restaurado. Evidência privada em `.tmp/scouting-share-ui/frame-controls.png`. Nenhuma alteração da análise salva ou publicação nesta rodada.

- 15/10: verificação automática do link YouTube após 500 ms, sem Continuar.
  Spinner e check no campo seguem o convite; confirmação depende do player.
  Dois testes focados cobrem debounce/cancelamento, troca e isolamento do Drive.

- 15/10: miniaturas de rally deixam de reutilizar capa genérica do YouTube.
  Fonte original fornecida pelo usuário associada pelo fluxo Drive existente;
  quadros distintos conferidos nos cards visíveis e no início do Rally 08 (01:38.300).
  Vínculo em RAM, sem persistência de URL privada; reabertura exige reassociação.
  Três testes da galeria e typecheck aprovados. Fonte/tempo alterados invalidam
  imagem anterior. Sem original, estado explícito Prévia indisponível.

- 15/10: carregamento de miniaturas por rolagem usa o painel como raiz do
  IntersectionObserver, sem margem de antecipação. Sair da área visível aborta
  extração/fila; retornar tenta novamente ou reutiliza cache. Um decodificador
  auxiliar por vez. Quatro testes da galeria e typecheck aprovados.
  Medição local anterior ao ajuste: JPEG 240×135, aproximadamente 7,8 KB cada;
  em janela de 39,49 s, main thread registrou 389 ms de tarefas e heap JS subiu
  0,24 MiB. Houve 35.303.441 bytes de tráfego de mídia durante a janela, incluindo
  buffering do player: não representa custo isolado de oito novas miniaturas.
  Não medidos memória nativa/GPU nem quadros perdidos; sessão já tinha cache.

- 15/10: placeholder neutro com ícone canônico gallery no lugar da miniatura
  ausente ou aguardando geração. Mantém proporção 16:9, sem baixar outra imagem.

- 15/10: resultado terminal salvo no contato preenche vencedor do rally; Erro
  favorece adversário, Ace e pontos diretos favorecem equipe do contato.
  Origem opcional winnerContactId preservada na exportação. Editar/excluir
  limpa somente atribuição de sua origem; ajuste manual remove vínculo.
  Não altera instante da bandeira, recortes ou estatísticas oficiais.

- Correção 15/10: referência winnerContactId não participa do conjunto de IDs
  únicos; evita rejeitar o contato referenciado ao salvar. Regressão cobre
  validação após serialização e exclusão do contato reaberto.

- 15/10: tela preta reproduzida no original Drive com readyState 1, sem quadro,
  inclusive após play e seek. Recuperação local da mídia restaurou readyState 4
  e imagem no Rally 52 sem reabrir análise. Estado Carregando e nova tentativa
  após 8 s; miniaturas suspensas no play. Não há comprovação de eliminação de
  todos os stalls da fonte remota. Evidência: .tmp/scouting-share-ui/video-buffer-recovered.png.

- 15/10: AbortError de play interrompido por pause/load não gera alerta de
  reprodução; sucesso/playing limpa apenas o erro genérico anterior do player.
  Erros de edição/salvamento não são apagados por essa recuperação.

- 15/10: migration scouting_video_share_no_expiry aplicada no projeto de produção
  com autorização explícita; coluna expires_at nullable conferida. Criação pelo
  localhost habilitada com URL pública goatleta.com; 10 testes focados aprovados.
  Análise publicada como leitor por link, UI confirmou Link copiado.

- 15/10: leitor rejeitava analysis.source vinculado ao fingerprint local após
  projeção shared. Publicação agora omite esse vínculo, mantendo posições/cortes.
  Cópia já publicada reparada sem trocar prova/link: 78 rallies, 201 contatos,
  17.508 posições. Endpoint retornou 200/viewer e navegador abriu Somente leitura.
  Seis testes da projeção aprovados. UI pública ainda é a versão anterior ao
  pacote local; refinamentos locais não foram publicados nesta correção.

- 15/10: correção visual local: conteúdo do botão de rally ocupa 100% da largura, mantendo a mesma área 16:9 com foto ou placeholder. Estados do leitor compartilhado usam bloco de 440 px centralizado nos dois eixos, com seletor específico para não ser sobrescrito pelo layout geral do estúdio.

- 15/10: ao abrir a análise, recupera o rascunho salvo mais recente no escopo usuário/organização/sessão, incluindo YouTube. Importação salva o documento inicial. Arquivos locais ainda exigem nova seleção para reprodução; URLs temporárias do Drive não são persistidas. Abas permanecem visíveis sem documento; cabeçalho sempre aberto e botão Vídeo com ícone de câmera. Sete testes do hook passaram; recuperação autenticada no navegador ainda pendente.

- 15/10: miniaturas extraídas são guardadas em cache local por conta/organização/sessão/vídeo/instante, no máximo 160 por vídeo e 120 KB por imagem. Leitura sob demanda funciona sem original e durante reprodução; cache antigo apenas em RAM não é recuperável após recarga. Pontos na visão completa usam traços compactos, preservando clique e bandeira no rally selecionado.

- 15/10: visão completa agrupa contatos por intervalo de rally, com bloco no centro do trecho correspondente. Não agrega contatos de rallies vizinhos por proximidade em pixels; visão do rally mantém contatos individuais e agrupamento por densidade.

- 15/10: por ajuste solicitado, marcadores de ponto ficam ocultos no vídeo completo e aparecem somente no rally selecionado; registros de ponto preservados.

- 15/10: ajuste local de início/fim em segundos no topo de Contatos. Aplicar recorte move a divisa compartilhada com os rallies vizinhos, preservando IDs e horários dos contatos. Impede cruzar limites e deslocar a marca ou contato decisivo para fora do rally; primeiro início e último fim permanecem fixos. Nove testes de domínio e typecheck aprovados; campos conferidos no navegador local. Não publicado.

- 15/10: recorte visual local com seis miniaturas reais, alças de início/fim acessíveis por teclado e prévia no player. Mantém aplicação explícita e validação do recorte. Régua compacta sob as imagens; waveform de áudio ainda não extraída.
`n- 15/10: alças usam captura do ponteiro, deslocamento relativo e prévia ao soltar; painel mantém o rally em edição ao atravessar uma divisa. Arraste local conferido; atualização do componente reiniciou a reprodução em YouTube, exigindo reconectar o original para novas miniaturas.

- Editor de recorte: Resetar restaura os limites salvos; Ver trecho e espaço no editor reproduzem o intervalo provisório sem salvar, com pausa no fim.

- Agulha independente com captura do ponteiro e buscas limitadas a cada 120 ms, mais busca final. Miniaturas do trim usam cache local escopado; aviso abre importação. Offset do original subtraído como na galeria.

- Importador lista YouTube conectado e original ativo em linhas discretas; remoção exige confirmação. Remover YouTube limpa vínculo de reprodução e identidade do original associado, preservando análise e marcações; alteração fica no rascunho.
