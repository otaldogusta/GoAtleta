# Biblioteca, quadra visual e scouting

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
| [CourtEditorWorkspace](../../../src/components/visual-court/CourtEditorWorkspace.tsx) | Composição do editor e ferramentas. |
| [useCourtEditor](../../../src/components/visual-court/useCourtEditor.ts) | Estado, histórico, rascunhos e salvamento. |
| [visual-court.ts](../../../src/core/visual-court.ts) | Documento, atores, etapas e presets. |
| [visual-court-editor.ts](../../../src/core/visual-court-editor.ts) | Comandos, conversão e importação validada. |
| [technical-visuals.ts](../../../src/db/technical-visuals.ts) | Persistência local/remota e revisões por turma/organização. |
| [court-export.web.tsx](../../../src/components/visual-court/court-export.web.tsx) | Exportação visual web. |
| [scouting.tsx](../../../app/class/[id]/scouting.tsx), [student-scouting.tsx](../../../app/student-scouting.tsx) | Sessões de equipe e autorregistro do atleta, respectivamente. |
| [core/scouting.ts](../../../src/core/scouting.ts), [db/scouting-sessions.ts](../../../src/db/scouting-sessions.ts) | Resultados por fundamento, agregação, ações e conclusão da sessão. |

## Contratos a preservar

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
fundamento, sem cor categórica. Grupos neutros mostram faixas por resultado dos
contatos e resumo no hover/foco. Essa apresentação
não atribui vencedor nem converte a avaliação em estatística oficial.

Cabeçalho recolhido usa a alça central da Quadra Visual; abas removem a reserva
de altura nesse estado. No retrato, o painel preenche o espaço após o player,
com rolagem própria. Contatos ficam sobre as divisões da barra segmentada,
compartilhando a escala macro/micro e preservando cores, prévias e busca temporal.

Clique na área da barra busca o instante proporcional à posição do ponteiro,
preservando macro/micro e o estado de reprodução; marcadores mantêm busca exata.

Ao escolher um fundamento, Informações revela o formulário e a timeline antecipa
a etapa/contato em edição no instante marcado. A prévia é separada do documento:
confirmar registra; cancelar restaura a apresentação dos contatos salvos.

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

Migração `20261013150000_scouting_video_sharing.sql` e função
`scouting-video-share` preparadas localmente, ainda **não ativadas remotamente**.
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
