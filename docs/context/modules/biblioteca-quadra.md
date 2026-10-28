# Biblioteca, quadra visual e scouting

Atualização local de 24/10/2026: o workspace usa diretamente `CourtEditorCanvas`
com as mesmas props, evitando carregar Skia pelo wrapper legado. Renderer e
documentos legados permanecem preservados. Três suítes/49 testes aprovados;
gestos em aparelho continuam pendentes. PDF web usa a fronteira compartilhada
[pdf-runtime.web](../../../src/pdf/pdf-runtime.web.tsx). Medições e limites em
[Desempenho local](../../operations/performance-local-2026-10-23.md).

Base inspecionada: `d5120cff`, em 05/10/2026. Inventário do código local do Go Atleta;
publicação, qualidade pedagógica e sincronização remota exigem evidência própria.

## Responsabilidade e fluxo

A Biblioteca reúne links/vídeos e atividades do catálogo pedagógico. O catálogo
orienta a seleção e explica atividades dos planos. A Quadra Visual é um editor
de documentos táticos por turma, com etapas, atores, desenhos, biblioteca e exportação.
São superfícies relacionadas; mídia, regra pedagógica e documento tático não são
a mesma entidade nem devem ganhar persistência duplicada por conveniência visual.
Scouting registra observações técnicas da equipe e autorregistros individuais separados.

## Onde começar

| Arquivo | Responsabilidade |
| --- | --- |
| [exercises/index.tsx](../../../app/exercises/index.tsx) | Biblioteca de links e aba do catálogo. |
| [ActivityCatalogTab](../../../src/screens/library/ActivityCatalogTab.tsx) | Busca, filtros e apresentação de atividades. |
| [activity-catalog.ts](../../../src/core/volleyball/activity-catalog.ts) | Catálogo TypeScript e conhecimento pedagógico. |
| [activity-catalog-plan-actions.ts](../../../src/screens/library/activity-catalog-plan-actions.ts) | Escolha de aula de destino e criação de versão do plano. |
| [planning-library-bridge.ts](../../../src/screens/training/application/planning-library-bridge.ts) | Conversão de atividade para bloco planejado. |
| [visual-tech.tsx](../../../app/class/[id]/visual-tech.tsx) | Entrada autorizada da quadra por turma. |
| [CourtEditorWorkspace](../../../src/components/visual-court/CourtEditorWorkspace.tsx) | Controlador do editor e compartilhamento. |
| [CourtWorkspaceView](../../../src/components/visual-court/CourtWorkspaceView.tsx) | Mesma composição visual para edição e leitura. |
| [useCourtReadOnlyController](../../../src/components/visual-court/useCourtReadOnlyController.ts) | Leitura imutável, sem persistência ou elenco privado. |
| [useCourtEditor](../../../src/components/visual-court/useCourtEditor.ts) | Estado, histórico, rascunhos e salvamento. |
| [visual-court.ts](../../../src/core/visual-court.ts) | Documento, atores, etapas e presets. |
| [visual-court-editor.ts](../../../src/core/visual-court-editor.ts) | Comandos, conversão e importação validada. |
| [technical-visuals.ts](../../../src/db/technical-visuals.ts) | Persistência local/remota e revisões por turma/organização. |
| [court-export.web.tsx](../../../src/components/visual-court/court-export.web.tsx) | Exportação visual web. |
| [scouting.tsx](../../../app/class/[id]/scouting.tsx), [student-scouting.tsx](../../../app/student-scouting.tsx) | Sessões de equipe e autorregistro do atleta, respectivamente. |
| [core/scouting.ts](../../../src/core/scouting.ts), [db/scouting-sessions.ts](../../../src/db/scouting-sessions.ts) | Resultados por fundamento, agregação, ações e conclusão da sessão. |

## Contratos a preservar

- Edições autorais da quadra armam autosave após 800 ms, com uma solicitação
  por vez e confirmação pela linha retornada de um upsert atômico. Timeout/rede
  permite uma tentativa extra após 1,5 s; sem loop em falha persistente.
  Falhas mantêm rascunho local e permitem retry;
  Novas/importadas têm identidade própria persistida, independente do título;
  desfazer um rascunho local não exibe confirmação remota.
  bootstrap, câmera, seleção e leitura não gravam. O cabeçalho usa indicador
  discreto, sem botão verde. [Contrato e validação](../../ui/QUADRA_AUTOSAVE_2026-10-28.md).

- Transporte separa progresso dos botões e mantém rodízio/etapas. Velocidade
  abre quatro opções por toque (0,5×, 1×, 1,5× e 2×), com seleção atual visível,
  em uma cápsula sem título, caixa externa ou padding extra, usando o seletor
  segmentado e o dropdown compartilhados; sem slider de velocidade.
  Largura/empilhamento compartilham o cálculo das sobreposições da quadra.
  No web, velocidade integra a cápsula de rodízio/etapas em toda largura, com
  ícones e leitura compactos. Play/reiniciar, rodízio, velocidade e etapas
  compartilham uma linha abaixo do progresso.

- A listinha da reprodução abre Ajustes, inclusive após visitar Etapas.
  No web até 700 px, o painel usa tipografia/espaçamento compactos e distribui
  as seis rotações na largura disponível.
- O compartilhamento da quadra usa a composição do Studio com densidade própria
  em `court-sharing-styles.ts`: largura máxima 440 px, altura limitada à tela e
  fontes/botões compactos até 700 px. As regras são isoladas em `sv-court-share`.
- O painel Ajustes/Etapas/Biblioteca fecha ao tocar fora, inclusive sobre o
  iframe 3D, com camada transparente abaixo do painel. Cliques internos e
  Escape preservados; sem brilho no fundo ao passar o mouse.
- A vista 3D gira por arraste, sem botão "Mover a vista"; zoom e ajuste à tela
  continuam disponíveis. A ferramenta de mover permanece na vista 2D.
- Giro, zoom e controles da câmera 3D permanecem ativos durante o Play.
  Bloqueio de edição não cancela gesto de câmera; mudança de contexto,
  ferramenta ou superfície oculta ainda cancela o gesto.

- Na recepção, o levantador inicia a saída na soltura do lançamento do
  sacador (evento `tossStart`), preservando bases, destino e corredor da P1.

- `court-simulation/serve-flight.js` fornece a trajetória de saque da mão até
  o piso para bola e guia; a recepção intercepta sua descida antes do alvo.
  Folga considera o volume da bola/fita; flutuante e rotação conservam curvas
  distintas. Tempos de contato derivam do voo, preservando bases autorais.
  Reconstrução local após observar o SetOptics; sem publicação nesta revisão.
  [Modelo, validação e limites](../../ui/QUADRA_3D_INTEGRACAO_2026-10-16.md#saque-animado--reconstrução-local-de-27102026).

- `court-reception-middle-identity.ts` repara referências de centrais trocadas
  somente na sequência canônica de seis recepções 5×1. Editor e leitura usam a
  mesma função pura; nomes, bases e trajetórias são preservados, sem escrita remota.

- Compartilhamento web da quadra implementado localmente em 27/10: cópia por
  link de leitura, prévia 3D/2D e revogação, com a composição do Studio Scouting.
  O link copiado usa sempre o domínio público `https://goatleta.com`, inclusive
  no localhost; copiar um link local já gerado preserva seu ID/código.
  Prévia e link usam o mesmo estúdio em leitura, com câmera, zoom e reprodução;
  ajustes de simulação temporários em memória e restauração da cópia original;
  links com 12 pares legados canônicos abrem convertidos em memória para as seis
  rotações animadas atuais, sem esperar uma troca de modo ou gravar na origem;
  ações autorais e persistência desabilitadas. Sem hook de edição no player; vínculos aluno/aula removidos. RLS/RPCs e testes
  SQL isolados aprovados; migration aplicada com autorização em 27/10 e grants
  remotos conferidos. Smoke com conta real em localhost validou publicar, ler,
  reproduzir, prévia e revogar. Publicação do cliente permanece separada.
  [Contrato e evidência](../../ui/QUADRA_COMPARTILHAMENTO_2026-10-27.md).

- Em 25/10, o hook de rascunho suspende bootstrap, retries e autosave ao ocultar
  o estúdio, preservando RAM/histórico e recibos de escritas já enviadas.
  Posições normalizadas idênticas são compartilhadas como array/pontos imutáveis
  entre etapas do Undo; parser e alterações reais de trajetória permanecem
  independentes. O serializer grava o documento uma vez e mantém o maior sufixo
  contíguo do histórico que caiba nos mesmos 20 passos/1.500.000 caracteres,
  sem truncar o documento atual. [Provas e limites locais](../../operations/performance-lists-memory-local-2026-10-25.md).
- Na implementação atual, `visual-tech.tsx` e `SharedCourtScreen.web.tsx` usam
  importações diretas; no link, a primeira montagem aguarda a leitura autorizada.
  O relato de importação tardia de 24/10 permanece histórico.
- Retomada web: uma falha transitória de revalidação preserva o mesmo player,
  etapa, câmera e ajustes em memória. Hash novo ou link inválido/revogado
  removem o conteúdo; polling fica suspenso em segundo plano. A reprodução
  pausa no quadro atual e o renderer redesenha após visibilidade/contexto GPU.
  [Contrato e limites locais](../../ui/QUADRA_COMPARTILHAMENTO_2026-10-27.md#retomada-após-tela-bloqueada-ou-segundo-plano--correção-local).
- `TrainingPlan.pedagogy.blocks` é referência semântica; campos legados de
  aquecimento/principal/volta à calma conservam compatibilidade de apresentação.
- Seleção de catálogo segue contexto de turma, ciclo, semana, aula e restrições;
  recomendação não sobrescreve plano sem ação do professor.
- Adicionar atividade à aula usa origem da atividade e versionamento do plano;
  preservar a detecção de duplicação e a escolha explícita de destino/bloco.
- Documento visual v1 conserva extensão `editor.version = 1` e conversão dos
  documentos antigos. Parser de arquivo aceita formato/tipos/limites explícitos.
- Atores, posições, números, cores e desenhos autorais devem sobreviver a mudanças
  de representação/orientação. Transformação visual não é recriação do documento.
- Etapa, rodízio, posição estática e trajetória têm papéis distintos. Histórico é
  transacional por gesto; seleção, zoom e reprodução não redefinem dados autorais.
- Rascunho local, sincronização pendente e revisão remota não são o mesmo sucesso.
  Preservar escopo de usuário no rascunho e organização/turma na persistência.
- Exportação/importação editável remove vínculos pessoais segundo o serializer;
  rótulos/notas visíveis ainda são conteúdo do autor. Não criar compartilhamento
  público implícito nem substituir autorização pela existência de arquivo/link.
- Scouting de equipe preserva organização, turma, sessão, fundamento e resultado;
  ações sincronizam contagens legadas. Sessão concluída rejeita adição/exclusão de ações.
- A coleta por jogada foi implementada localmente em 07/10: contatos vinculados
  ao ponto, reabertura, revisão/idempotência e rascunho por usuário/organização.
  Treino permanece por repetição; legado não recebe placar/rubrica presumidos.
  Migration `20261007112922` aplicada em 07/10; gravação real de jogo/treino validada
  pelo app local. Pacote validado para prévia; produção do app pendente. Ver [contrato e validação](../../ui/SCOUTING_IMPLEMENTACAO_2026-10-07.md)
  e [adaptador](../../../src/db/scouting-collection.ts).
- Coletor refinado contra o mockup em 07/10: sequência compacta, escolha explícita
  de atleta/sem atleta antes do resultado e confirmação do ponto só após fechar
  o contato. Seleção permanece no treino para repetições; nomes reais não recebem
  números de camisa inventados. Comparação visual em browser não substitui aceite.
- Autorregistro do atleta usa notas `0/1/2` por fundamento com limites próprios.
  A UI permite salvar no dia agendado, do início da aula até quatro horas depois;
  essa guarda cliente não comprova enforcement temporal no servidor.

## Decisões atuais e histórico

Reutilizar [guia do catálogo](../../../docs/catalog-pedagogico/CATALOG_GUIDE.md) e
[integração do motor](../../../docs/catalog-pedagogico/ENGINE_INTEGRATION.md).
A afirmação antiga de Biblioteca como consumidora futura no
[README do catálogo](../../../docs/catalog-pedagogico/README.md) já foi parcialmente
superada por `ActivityCatalogTab` e pela ponte de inclusão em aula existentes.
A [proposta de Quadra Visual](../../../docs/operations/visual-court-workspace-proposal.md)
mistura desenho inicial, implementação local e limites; consultar suas seções datadas.
Vídeo/GIF, geração por assistente e validação automática de legalidade não são
capacidades comprovadas por este mapa. Referenciar aula não reescreve plano aplicado.

Estúdio de vídeo integrado localmente ao scouting web em 12/10: [implementação e limites](../../ui/SCOUTING_VIDEO_IMPLEMENTACAO_2026-10-12.md), baseada no [mockup](../../ui/SCOUTING_VIDEO_MOCKUP_2026-10-12.md). Player, rallies/contatos temporais, pontos anotados, timeline, histórico e exportação funcionam com arquivo e rascunho locais. Anotações não escrevem estatísticas oficiais. Supabase mantém a autorização da sessão. Processamento automático local e compartilhamento por link evoluíram em 13/10, conforme o contrato abaixo; ativação remota permanece pendente. [Continuidade e proposta YouTube](../../operations/scouting-video-handoff-2026-10-13.md).

## Validação seletiva

Em 23/10, `useVideoDraft` passou a reutilizar a assinatura do documento imutável
entre atualizações do relógio do player. `dirty` acompanha edição/Undo/Redo/salvar;
autosave, revisão, conflito e readonly permanecem. Benchmark com saída Expo/Compiler
e 61 testes registrados não certificam FPS do estúdio ou Android.
Ver [evidência e limites](../../operations/performance-local-2026-10-23.md).

No retorno web da quadra, uma turma imediatamente anterior com o mesmo ID é
reutilizada por Voltar, conservando seus parâmetros. Entrada direta, outro
destino e nativo mantêm o fallback anterior. Confirmação/preservação de rascunho
precedem a saída. [Continuação e teste prolongado](../../operations/performance-boot-soak-local-2026-10-24.md).

Em 24/10, o [storage do rascunho de vídeo](../../../src/screens/scouting/video/video-draft-storage.ts)
passou a usar IndexedDB no navegador para documentos grandes; o nativo mantém
AsyncStorage. A chave conserva usuário/organização/sessão/fingerprint, incluindo
backups, e uma gravação só confirma no commit da transação. Rascunhos legados
continuam legíveis quando a chave ainda não existe no IndexedDB; falha de leitura
não autoriza recuperar uma cópia antiga. Erros preservam dirty e impedem a RPC;
o autosave para de repetir até nova ação, e a tentativa manual pode sincronizar
após gravar. Nenhum cache, autenticação ou rascunho legado é apagado.
Contrato e smoke pesado em [Carga local](../../operations/performance-stress-local-2026-10-24.md).

O estúdio web retido conserva o modelo/editor, mas sua superfície e efeitos
externos seguem o foco da rota: pausa, libera mídia/frames/listeners/URLs próprias
e o bloqueio do app no blur, retomando pausado. Saída explícita conserva a guarda
existente; foco não salva nem descarta a edição. [Continuação local](../../operations/performance-boot-soak-local-2026-10-24.md).

Atualização local em 16/10: o [rascunho de vídeo](../../../src/screens/scouting/video/use-video-draft.ts)
recupera/sincroniza o documento editável por sessão e fingerprint via Supabase,
com migração do rascunho selecionado, retomada offline e escolha explícita em
conflitos. Original compatível reanexa à análise YouTube sem trocar marcações.
Arquivo físico continua local; compartilhamento permanece somente leitura.
Backend ativado em 17/10; gravação real confirmada com 78 rallies, 201 contatos e
17.508 posições. Publicação do cliente autorizada, condicionada aos gates de
release. Ver [ativação e limites](../../operations/scouting-sync-release-2026-10-17.md) e
[contrato e validação](../../ui/SCOUTING_VIDEO_IMPLEMENTACAO_2026-10-12.md#sincronização-editável-entre-aparelhos--16102026).

Testes encontrados, sem execução nesta rodada:

- [catálogo](../../../src/core/__tests__/activity-catalog.test.ts),
  [Biblioteca/UI](../../../src/screens/library/__tests__/activity-catalog-library-ui.test.ts) e
  [ponte de planejamento](../../../src/screens/training/application/__tests__/planning-library-bridge.test.ts).
- [modelo visual](../../../src/core/__tests__/visual-court.test.ts),
  [comandos/importação](../../../src/core/__tests__/visual-court-editor.test.ts),
  [persistência](../../../src/db/__tests__/technical-visuals.test.ts) e
  [exportação](../../../src/components/visual-court/__tests__/court-export-utils.test.ts).
- [domínio scouting](../../../src/core/__tests__/scouting-sessions.test.ts) e
  [sessões persistidas](../../../src/db/__tests__/scouting-sessions.test.ts).

Em mudança funcional, usar a [escada](../../../docs/operations/validation-ladder.md)
e smoke local de abrir/editar/desfazer/salvar/reabrir/exportar. Evidência web não
certifica exportação nativa nem gravação remota; esta rodada apenas inspecionou fontes.

Em 13/10, modo automatico local integrado ao estudio: ONNX em Worker no navegador, sem upload; sugestoes de trajetoria e cortes revisaveis, separadas de contatos/pontos oficiais. Ver atualizacao de 13/10 no guia de implementacao.

Timeline web: macro por rallies e micro por contatos na barra segmentada, com escala ajustada ao intervalo visivel; composicao responsiva conferida em 13/10. Evidencias e limites no guia de implementacao do estudio.

Reprodução de vídeo usa desenho por quadro separado do editor, galeria memorizada
e miniaturas em fila. Importação de análise processada exige o fingerprint da mídia;
80 recortes e 20.222 posições originais foram recuperados/salvos/reabertos no app
local em 13/10. Isso não valida a precisão do detector em vídeos novos; ver limites
e evidência na seção de reprodução do guia acima.
Imagem do player também é apresentada em canvas, abaixo da trajetória, para evitar
a superfície preta observada no Chromium integrado ao pausar/trocar recortes.
Clique em capítulo/contato apenas busca o instante, preservando macro ou micro;
troca de escala fica nos controles de modo e na galeria. Hover/foco mostra contatos
com equipe, resultado e tempo; marcas densas agrupam por espaço disponível. Ver
validação e recuperação das cinco anotações do mockup no guia de implementação.
Marcadores usam preenchimento sólido e símbolo por resultado: erro vermelho,
comprometido laranja, positivo azul e ponto direto verde. Letra/nome identificam o
fundamento, sem cor categórica. Marcadores individuais têm formato de balão,
com ponta superior voltada para a barra temporal. Grupos neutros mostram faixas por resultado dos
contatos e resumo no hover/foco. Essa apresentação
não atribui vencedor nem converte a avaliação em estatística oficial.

Cabeçalho recolhido usa a alça central da Quadra Visual; abas removem a reserva
de altura nesse estado. A partir de 900 px, o painel fica à direita, com largura
adaptável de 300 a 340 px e rolagem própria; abaixo disso, fica após o player.
Contatos ficam em uma faixa compacta abaixo da barra segmentada,
compartilhando a escala macro/micro e preservando cores, prévias e busca temporal.
O balão de hover/foco abre acima do marcador, com largura e altura limitadas à tela.
Contato individual usa 220 px, com fundamento, instante e equipe, sem título
duplicado; avaliação aparece quando registrada. Grupos têm limite de 260 × 240 px.

Clique diretamente na linha de progresso busca o instante proporcional à posição
do ponteiro. A faixa clicável tem 8 px, alinhada à linha; espaço acima/abaixo não
busca. Macro/micro e reprodução são preservados; marcadores mantêm busca exata.
Arrastar o indicador mantém a prévia local (posição, progresso e horário) e
envia uma única busca ao soltar; cancelar ou trocar de rally não aplica a prévia.
O adaptador YouTube mantém o destino até a confirmação do iframe, com limite
de 2 s para recuperar falhas, evitando que amostras antigas façam a barra saltar.

A galeria de Rallies retoma a grade do mockup, com duas colunas no painel lateral,
miniatura acima do nome/intervalo e colunas adaptáveis quando o painel fica abaixo.
Vídeo completo é o primeiro item; selecionar um rally abre sua escala, e a
timeline não repete os controles de modo.
Miniaturas dos rallies mostram duas bolinhas com as iniciais das equipes,
sem fundo envolvendo o par, com × entre as bolinhas. Somente `winner` acende a equipe vencedora; resultado indefinido
mantém ambas apagadas, sem inferir vencedor dos contatos. Nomes e resultado
estão na descrição acessível e no hover; Vídeo completo não recebe indicadores.
Setas esquerda/direita ajustam um quadro aproximado (1/30 s), inclusive no slider,
preservando digitação em campos e navegação em menus.
Botões Marcação anterior/Próxima marcação percorrem
os instantes dos contatos e pontos visíveis, preservando milissegundos e pausando
no destino. Respeitam o rally selecionado ou o vídeo completo e a prévia em edição;
sem marca na direção escolhida, não avançam e o botão fica desabilitado. Não
interceptam campos ou menus. Espaço alterna reprodução fora dos botões/campos.
Seletores usam o menu ancorado sólido do app.
Ao lado do play, Voltar/Avançar um quadro oferecem ajuste fino separado das
etapas: passo de referência de 1/30 s (aproximado), com pausa e limites do rally
e do original disponível. Não detecta o FPS da fonte nem garante um quadro
decodificado por clique no iframe YouTube; os botões informam o passo aproximado.

Ao escolher um fundamento, Contatos revela o formulário compacto e a timeline antecipa
a etapa/contato em edição no instante marcado. A prévia é separada do documento:
confirmar registra; cancelar restaura a apresentação dos contatos salvos.
Clique fora ou Escape desmarca uma seleção sem alterações; edições pendentes
permanecem abertas até salvar ou cancelar, sem descarte silencioso.

O rally pode guardar `pointTime` opcional, validado dentro do seu intervalo.
A bandeira marca o instante do ponto sem criar contato ou atribuir vencedor;
a seleção fica na ordem equipe / N/D / adversário. Marca exportável e compatível
com rascunho antigo e histórico; dividir/unir o rally pede nova marcação.

Compartilhamento por link usa a mesma `Studio` em `/scouting/shared`, com documento
publicado e capacidades somente de leitura: sem rascunho, importação, edição,
download ou gestão de acesso. Equipe exige conta vinculada à turma; link aberto
exige prova aleatória. RLS/RPCs não liberam tabelas de scouting ao destinatário.
Vídeo privado via TUS e URL assinada de 5 minutos; expiração, revogação e rotação
validadas no servidor. Revisões são publicadas explicitamente, sem sincronizar
rascunhos automaticamente. O pacote/leitor HTML anterior foi removido.

Migrações de compartilhamento/YouTube e função `scouting-video-share` ativadas
em 14/10; ver o registro de release ao final deste guia.
Hospedagem do vídeo de 821 MiB depende do limite real do projeto (Free: 50 MB por
arquivo). Não houve upload nem mudança de plano. Ver
[contrato e ativação](../../ui/SCOUTING_VIDEO_IMPLEMENTACAO_2026-10-12.md#compartilhamento-por-link--1310).


Fonte YouTube (web, 13/10): o mesmo estúdio aceita links validados e conserva
marcações temporais com rascunho separado por ID; arquivo local e correção por
canvas permanecem disponíveis. O IFrame não fornece frames. Tracking produzido
com o original pode ser associado ao link e aparece no painel lateral; recortes
continuam exclusivos da fonte local. UI e tooltips ficam fora do player YouTube.
Compartilhamento sem upload usa `prepare_scouting_youtube_share`, migration
`20261013170000_scouting_video_youtube.sql` e a mesma autorização de leitura.
Código local, sem ativação remota; não listado não oferece privacidade da mídia.
Evidências e limites no guia de implementação acima.

Piloto Gemini para YouTube (13/10): botão Automático no mesmo estúdio local,
serviço loopback `scripts/scouting-youtube-service.mjs`, análise por trechos com
cache/cancelamento e sugestões validadas em `core/scouting-video-ai.ts`. Aceite
explícito preserva dados humanos e não confirma pontos. Precisão experimental;
API de produção e ativação remota pendentes. Ver seção de análise Gemini no guia.
O lote de 94/296 do vídeo `mdfgd1K3HTc` foi reprovado visualmente para aplicação
em bloco; a correção visual posterior está registrada abaixo, cache não validado. Ver
[revisão esportiva](../../operations/scouting-youtube-review-2026-10-13.md).


Atualização final de 13/10: revisão visual sequencial de todo o vídeo (0–910,7 s), com ampliação dos contatos candidatos. Aplicados e salvos no rascunho YouTube 78 segmentos de rally e 201 contatos observáveis; exportação da UI idêntica ao documento validado. Contatos encobertos ou ambíguos excluídos, sem atribuir atletas/resultados/pontos. Cobertura temporal completa não significa anotação de todos os toques nem precisão automática certificada. Detalhes em `docs/operations/scouting-youtube-review-2026-10-13.md`. Rascunho do arquivo original preservado.


Tracking por link (13/10): `core/scouting-video-tracking.ts` associa somente a
trajetória do original após confirmação da mesma edição e offset explícito,
preservando rallies/contatos/correções. Origem e alinhamento são validados e
persistidos, sem URL/caminho/credenciais. `YouTubeTrackingSetup.web.tsx` oferece
processamento local ou importação da análise do original; `YouTubeTrackingPanel.web.tsx`
exibe coordenadas na vista da câmera, fora do IFrame, com correção manual e leitura
sem escrita. A sincronização YouTube é aproximada; não é uma projeção 3D/quadra.
VballNet GridV2b permanece padrão, V4c é comparação explícita. Seleção conservadora
rejeita candidatos fracos e saltos isolados sem preencher lacunas. Rascunho YouTube
atual salvo/reaberto com 78 rallies/201 contatos/20.222 posições; original preservado.
Ver [comparação, licenças, avaliação e caminho de treino](../../operations/scouting-ball-model-comparison-2026-10-13.md)
e guia de implementação. Sem endpoint remoto, treinamento ou download de jogos externos.

Reprodução **Original com tracking** no mesmo documento YouTube: selecionar o
arquivo com fingerprint/duração/dimensões da origem associada apresenta imagem e
trajetória no player local. Trocar para YouTube conserva tempo, velocidade,
rallies, contatos e editor; o offset continua relativo à timeline do link. O arquivo
permanece em memória nesta abertura, sem upload ou nova persistência. Pelo IFrame,
a trajetória permanece no painel. Leitores não podem selecionar/processar mídia.

Piloto isolado de coordenadas somente pelo link: `scripts/scouting-youtube-ball-pilot.mjs`,
sem aplicação ao documento. Uma chamada Gemini 3.1 Flash Lite em 20–40 s foi
reprovada na referência visual (0/8 coordenadas dentro de 15 px, seis omissões em
14 frames observáveis). Não é um modo do produto; tracking pelo original segue.
Ver [execução e limites](../../operations/scouting-youtube-ball-pilot-2026-10-13.md).

Comparação offline adicional (14/10): WASB Volleyball Step3 e GridV3 não
superaram os atuais na referência independente do trecho 20–40 s. GridV2b padrão
e opção V4c preservados; nenhuma trajetória candidata aplicada. CLI de avaliação
em `scripts/validation/scouting-wasb-benchmark.py`; pesos/insumos ficam locais,
fora do app e do Git. Ver [resultado e limites](../../operations/scouting-wasb-evaluation-2026-10-14.md).

Piloto Roboflow por link (14/10): tentativa autenticada em Stream rejeitada
antes de frames/inferência; entrada aceita RTSP/RTSPS, não a watch URL testada.
Draft de avaliação salvo sem publicação; nenhuma trajetória importada ou mudança
no app. Ver [evidências e limites](../../operations/scouting-roboflow-youtube-pilot-2026-10-14.md).

Drive no estúdio (14/10): `DriveTrackingSetup.web.tsx` associa um arquivo público
ao mesmo documento YouTube, com confirmação da edição/offset. Streaming por Range
no companion local `scouting-drive-service.mjs`, com cache RAM global de 32 MiB,
contorna o CORS do Drive sem salvar
MP4; `processScoutingVideoUrl` reutiliza VballNet na aba. Aplicar muda só `analysis`,
preservando marcações; URL/capacidade/chave ficam em RAM. Roboflow é opção
experimental separada, ainda sem validação completa do resultado real. Não usar
o OAuth acadêmico nem expor o companion como API pública. Ver
[fluxo, segurança e evidências](../../operations/scouting-drive-tracking-2026-10-14.md).

Estúdio compacto (14/10): Rallies em lista com miniaturas; Contatos abre o editor pela timeline e habilita Salvar somente após mudança; Informações reúne trajetória/fonte/ferramentas. Entrada única reconhece YouTube/Drive, com opções avançadas recolhidas. Contratos e rascunhos preservados; ver [validação local](../../operations/scouting-studio-ui-2026-10-14.md).

Publicação autorizada (14/10): migrations de compartilhamento/YouTube aplicadas e `scouting-video-share` ACTIVE v1; RLS, bucket privado e rejeição de links inválidos conferidos. Drive/Gemini continuam locais. Ver [registro e limites do release](../../operations/scouting-release-2026-10-14.md).

Compartilhamento refinado localmente em 14/10: modal na composição do Drive, sem
validade na UI. Nova migration `20261014162412_scouting_video_share_no_expiry.sql`
permite novos links sem prazo (`expires_at = null`); prazos legados e revogações
continuam válidos, sem backfill. URL assinada da mídia mantém TTL de cinco minutos.
Aplicar essa migration antes do novo cliente; ativação remota desta mudança pendente.
Ver [contrato e validação](../../ui/SCOUTING_VIDEO_IMPLEMENTACAO_2026-10-12.md#modal-de-compartilhamento-como-o-drive--1410).

Importação YouTube: link inicia conferência automática após 500 ms sem edição.
Campo reutiliza spinner/check do convite; sucesso depende dos metadados do player.
Editar limpa a confirmação e cancela a espera anterior; Usar vídeo confirma a escolha.
Drive mantém seu fluxo próprio.

Marcar ponto abre a seção Ponto e recorte do rally e rola até seus controles.
A bandeira da timeline também abre essa seção no rally correspondente, sem alterar o ponto.

Espaço na timeline é capturado antes dos botões de etapas/marcadores: alterna
reprodução sem ativar a busca do botão focado; repetição e keyup são consumidos.

Painel do estúdio mantém posição de rolagem por aba durante a sessão do vídeo,
restaurada em layout effect para evitar salto visual. Trocar mídia reinicia posições.

Miniaturas: a capa do YouTube fica apenas no card Vídeo completo. Rally sem
fonte decodificável mostra Prévia indisponível; com original associado, captura
o instante inicial ajustado pelo offset. Imagens de fonte/tempo anteriores não
são reaproveitadas durante troca. Obtenção de quadros apenas pelo link YouTube
não está implementada; o serviço Gemini retorna marcações, não mídia.

Miniaturas são solicitadas somente ao entrar na área visível do painel; sair
cancela extração pendente. Retornar reutiliza cache ou tenta novamente, com um
decodificador auxiliar por vez.

Salvar contato com Erro atribui vencedor à equipe oposta; Ace/Ponto de ataque/
bloqueio/direto atribui à própria equipe. winnerContactId opcional identifica
a origem para limpar somente atribuições automáticas ao editar/excluir/mover.
Escolha manual remove essa origem. Instante do ponto e recortes são preservados.

Reprodução suspende extração de miniaturas. Player nativo mostra espera por
quadro e permite recarregar apenas a mídia após 8 s, restaurando posição.
Não recarrega documento nem salva/descarta anotações.

- No estúdio de vídeo, Início/Fim em Contatos ajustam as divisas compartilhadas via `resizeVideoRally`, sem criar rallies ou mudar horários dos contatos. Marcas de ponto fora do intervalo e resultados automáticos cujo contato mudaria de rally bloqueiam o ajuste com aviso.

## Representações 2D e 3D da mesma jogada — 16/10/2026

O editor web troca a representação no mesmo workspace, com documento, seleção,
etapa, reprodução e histórico compartilhados. O renderer local em
`public/visual-court-3d/` recebe quadros derivados e devolve comandos validados;
não tem persistência ou simulação independentes. Cabeçalho compacto, modos,
painel recolhível e transporte incorporam as ferramentas do mockup ao editor.
O cabeçalho permanece sempre visível, sem ação para recolher ou reabrir.

Overlays web compactos acompanham a proporção do mockup, com escala desktop
entre 0,8 e 1, sem escalar canvas/coordenadas. O renderer atualiza a resolução
ao mudar densidade/tamanho, com framebuffer até 2×. A densidade web compacta
também vale até 700 px; tamanhos nativos são preservados.
Controles compartilham fade/deslize de 200 ms e alça animada entre as duas
vistas, com reversão imediata e respeito à preferência de movimento reduzido.
No celular, a alça é uma barra horizontal centralizada: no topo interno do
painel aberto, acima das abas, e visível na posição recolhida. O mesmo botão
permanece acessível durante o fade; desktop conserva a alça lateral.
`court-overlay-layout.ts` reserva apenas a timeline atual: zoom em uma linha,
alça a 8 px do dock e separação vertical adicional só onde faltaria largura.
Cabeçalho, ferramentas, menus e ajustes usam a variante compacta existente.
O renderer aplica a proporção exata entre perfis de câmera ao cruzar 600 px,
preservando órbita e zoom, sem acumular distância a cada redimensionamento.
`CourtWorkspacePanel` reúne Ajustes, Etapas e Biblioteca em abas no mesmo painel.
Camadas integra as categorias dos ajustes; `CourtStepGallery` apresenta as etapas
em duas colunas, preservando seleção, reordenação e comandos. A barra de reprodução
é única; trocar abas mantém busca/rolagem e não altera o documento.
O transporte mantém uma linha também no celular (42 px de altura e botões de
40 px). Velocidade é um número clicável que percorre 0,25×–2× em passos de
0,25×, voltando ao início; somente o progresso usa slider. Ambas as vistas
compartilham esses controles, sem alterar a etapa ou seus dados autorais.

`CourtVisualStep.simulation` referencia atores/bola canônicos; as bases continuam
em `actorPositions`. `core/court-simulation.ts` amostra os mesmos motores puros
do mockup para 2D e 3D: recepção, nove presets de ataque, saltos, contatos,
bloqueio de até três jogadores e rebotes em mãos/rede/fita/piso. Configuração,
alças, restauração e rodízio pertencem ao mesmo histórico e rascunho. Atores
adversários auxiliares não substituem companheiros; importação e duplicação
preservam referências válidas. Câmera não altera dados autorais.
Escolher um preset de ataque reposiciona a base inicial do atacante para o lado
e a profundidade da jogada no modelo compartilhado, visível também em pausa no
2D. Altura/tempo continuam distinguindo presets que usam a mesma zona do piso.

No modo Ataque, a ferramenta Selecionar e mover também arrasta o ponto de ataque
e o destino da bola na vista 2D. As alças projetam os mesmos pontos e limites da
3D e enviam `updateCourtSimulationHandle`; a prévia fica local até soltar, com
um comando no histórico. Cancelar ou mudar etapa/ferramenta/documento descarta
a prévia. Contato não desloca bloqueadores nem a mira; alternar vistas preserva
os ajustes e o histórico compartilhados.

A curva da cortada é independente do arco do levantamento: a alça azul no meio
da intenção 3D e o controle Curva do ataque em Ajustes alteram
`attackSettings.attackArc`. Contato, destino e bases permanecem fixos; o motor
recalcula voo, duração e colisões. Ausente/null conserva o lançamento anterior.
O mesmo ajuste é compartilhado pela projeção 2D e pelo renderer 3D.

O modelo de recepção do editor usa seis etapas completas, P1/P6/P5/P4/P3/P2,
com o motor compartilhado e 4,1 s por rotação. `court-simulation-sequence.ts`
substitui os 12 pares antigos somente por comando explícito, em uma transação
reversível; o preset tático histórico continua disponível aos outros consumidores.
Galeria, setas do transporte e rádios selecionam o mesmo `stepIndex`, sem editar
a rotação de outra etapa ou consumir Undo. A troca de sistema alcança a sequência.
Selecionar Ataque ou Recepção no conjunto de seis altera os modos e rótulos em
um comando, mantendo a etapa selecionada e os ajustes de cada rotação. Ataque
também apresenta setas/radios de rodízio nessa sequência; uma etapa avulsa mantém
a edição individual. Navegar não reposiciona atores nem recalcula a configuração.
O motor de ataque é o mesmo dos presets; não gera formações táticas diferentes
automaticamente para cada rotação. Trocar modo reaplica as bases do motor.

A câmera orbital 3D conserva brevemente a velocidade ao soltar o fundo e
desacelera em até 350 ms, no mesmo RAF do renderer. Novo gesto/comando,
troca de contexto e movimento reduzido interrompem a inércia. Esse estado é
somente de apresentação; jogadores, alças e documento não recebem impulso.

Arrastes partem da posição amostrada. Animação desenhada explicitamente conserva
a cena e passa a trajetória autoral, desativando a simulação daquela etapa.
Autosave conserva a volta ao estado limpo após Undo e a etapa selecionada.
Defesa e nove jogadores permanecem indisponíveis; coeficientes calibrados do
motor local não comprovam igualdade física com o serviço de referência.

Contrato, validação local e limites estão em
[Integração 3D](../../ui/QUADRA_3D_INTEGRACAO_2026-10-16.md).
O mockup e sua auditoria permanecem como referência histórica. O protótipo
independente e evidências privadas não compõem a publicação. Testes de paridade
usam fixtures locais em `src/core/__tests__/fixtures/court-reference/`; o gate
`court-runtime` inclui os testes Node do motor e do renderizador na validação
de release e CI. O smoke local desta ampliação não gravou a jogada no backend.

Release da quadra em 27/10: build verificado e 697 suítes/4761 testes
Jest aprovados, com smoke autenticado na 8081 e agenda preservada. Push de
produção somente para main; CI/deploy remoto precisam de confirmação própria.

Retomada web: pacote validado para publicação com 698 suítes/4772 testes
Jest e build verificado. Eventos de suspensão/rede/GPU simulados; confirmação
em celular físico pendente por falta de aparelho conectado. Entrega via main.

Autosave e interface compacta: release completo aprovado com 702 suítes/
4840 testes e export web. Gravação real da 8081 documentada no contrato;
agenda preservada. Entrega autorizada via main, com CI/deploy remoto separado.
