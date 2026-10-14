# Continuidade do estúdio de scouting — 13/10/2026

## Escopo desta entrega

Branch `codex/scouting-video-studio`, criada a partir de `5c42d3ef`.
O usuário autorizou commit e push para continuar em outro chat. Isso não inclui
merge, deploy, migrations remotas, upload de vídeo ou mudança de plano.
Conferir o SHA e a sincronização com `origin` ao retomar; este documento acompanha
o próprio commit. Alterações anteriores de calendário/DateInput permanecem locais
e fora do pacote, inclusive seus trechos nos arquivos compartilhados.

## Referências e entrada

- Ler `AGENTS.md` e `docs/context/modules/biblioteca-quadra.md`, depois somente o
  trecho pertinente de [implementação](../ui/SCOUTING_VIDEO_IMPLEMENTACAO_2026-10-12.md).
- App real: `http://localhost:8081/class/c_1773110914770/scouting`.
  Verificar processo/checkout antes de usar; abrir pelo botão **Abrir estúdio**.
- Mockup aprovado: `http://localhost:8093/`; fontes em
  `docs/ui/mockups/scouting-video-2026-10-12.html` e `scouting-video-server.py`.
  O protótipo é referência visual, não a versão publicada do app.
- Checkout desta entrega: `C:/Users/gusta/.codex/worktrees/9184/GoAtleta/`.
- Mídia e análises originais estão fora do Git, na pasta local
  `C:/Users/gusta/.codex/visualizations/2026/10/11/01a12cb9-d4ee-7770-9707-f297b32a5d6c/scouting-video-mockup/`.
  `full-video.mp4` tem 860.741.220 bytes (~821 MiB). Não enviar esse vídeo ao Git.
- Última conferência do rascunho real: 80 rallies, 20 contatos, 7 pontos marcados
  e 20.222 posições. Reinspecionar ao retomar; o usuário pode continuar editando.
  Não substituir esse rascunho por fixtures ou pelos antigos 5/12 contatos.

## Implementado localmente

- Estúdio web integrado à sessão real, com arquivo local, rascunho por
  usuário/organização/sessão/vídeo, histórico e exportação de recortes.
- Reprodução por quadro/canvas para corrigir a superfície preta do navegador
  integrado; galeria memorizada e miniaturas em fila. Não remover essa correção
  ao introduzir outro tipo de player.
- Macro: vídeo completo dividido por rallies, com contatos e pontos visíveis.
  Micro: rally selecionado dividido pelas etapas dos contatos. Clicar na barra
  busca o instante proporcional, preserva pausa/reprodução e não muda a escala.
  Hover/foco mostra detalhes e grupos de contatos por densidade.
- Contatos incluem bola de graça e cobertura de ataque. Escolher fundamento
  abre Informações e antecipa a marca em edição; cancelar remove só a prévia.
  Cores são de resultado: erro vermelho, comprometido laranja, positivo azul,
  ponto direto verde, sem avaliação neutro. Letras identificam fundamentos.
- Instante do ponto é separado de contato/vencedor, com bandeira, edição e remoção.
  Seleção do vencedor: equipe à esquerda, N/D no meio, adversário à direita.
- Cabeçalho sobreposto com alça central como na Quadra Visual, tipografia Inter,
  painel responsivo, sem botão de tema e sem controles redundantes.
- ONNX local em Worker, progresso/cancelamento e trajetória persistida. Os 80
  rallies e tracking do vídeo de referência foram importados da análise original.
  Cortes por cena são sugestões; precisão em vídeos novos ainda experimental.
  Não apresentar esse detector como reconhecimento validado de rallies/contatos.

## Compartilhamento: código pronto localmente, serviço não ativado

O usuário rejeitou ZIP como experiência de compartilhamento e leitor separado.
O link deve abrir **a mesma Studio**, com capacidades limitadas: visualização
por padrão, sem editar, salvar rascunho, marcar contato/ponto ou gerir acesso.
Edição pelo próprio atleta é futura; o servidor atual aceita apenas `viewer`.

- UI: `VideoShareDialog.web.tsx`; equipe autenticada ou link aberto, validade
  7/30 dias, gerar/copiar/revogar, progresso TUS e prévia do mesmo estúdio.
- Rota: `app/scouting/shared.tsx`, `SharedVideoScreen.web.tsx` e exceção pública
  exata em `app/_layout.tsx`. Documento publicado não grava o rascunho do leitor.
- Core/API: `src/core/scouting-video-sharing.ts`, `src/api/scouting-video-sharing.ts`,
  `src/api/scouting-video-upload.web.ts`. Prova no fragmento e hash no banco; nova publicação
  gira o link. Não há colaboração em tempo real nem sincronização automática.
- Backend: migration `20261013150000_scouting_video_sharing.sql`, função
  `supabase/functions/scouting-video-share/index.ts`, configuração correspondente.
  Bucket privado, caminhos imutáveis, RLS/RPCs, vínculo ativo à turma e URL
  assinada por 5 minutos. Revisão de acesso a cada minuto e ao retornar à aba.
- Nada disso foi aplicado remotamente. Nenhum vídeo enviado, link externo gerado,
  plano alterado ou experiência com duas contas hospedadas validada.
- A opção atual usa Supabase Storage, mas o original tem 821 MiB. O limite Free
  documentado é 50 MB/arquivo; o plano real do projeto não foi confirmado. O teto
  do bucket não altera o teto global. Não contratar um plano automaticamente.

## Próxima decisão: fonte YouTube

Última conversa: o usuário propôs subir no YouTube e analisar pelo link para
evitar hospedar arquivos grandes. Foi recomendada a coexistência de duas fontes:
YouTube para reprodução e marcações temporais; original local para tracking
completo. Foi uma conversa de viabilidade, ainda sem implementação ou upload.

Ao continuar, confirmar o escopo da integração conforme o novo pedido e preservar
o mesmo estúdio. Uma adaptação deve separar as operações do player (tempo, busca,
pausa, reprodução, duração) da dependência atual de `HTMLVideoElement`.
Não remover a alternativa local nem prometer capacidades que o iframe não oferece.

- API IFrame permite navegação por tempo e consulta do instante: a timeline,
  rallies, contatos, pontos e avaliações podem ficar fora do player e sincronizar.
- O detector atual lê pixels com canvas; não recebe frames pelo link do YouTube.
  Processar o original local é uma possibilidade distinta, não baixar o YouTube.
- As regras do player restringem sobreposições: não prometer desenhar a trajetória
  atual por cima do iframe. Manter marca/controles do YouTube conforme suas regras.
- Não listado é acessível e repassável por qualquer pessoa com o link do vídeo.
  Permissões do Go Atleta protegem a análise, não tornam esse vídeo privado.
- Para YouTube, publicar metadados/provedor/ID deve dispensar upload da mídia.
  A migration atual pressupõe Storage; adaptar o contrato com validação de URL/ID,
  autorização e compatibilidade, sem simplesmente aceitar uma URL arbitrária.
- Conferir disponibilidade/incorporação, erros do player, sincronização, escala
  macro/micro, links compartilhados e leitura sem edição. Native segue pendente.

Fontes oficiais consultadas em 13/10:
[API IFrame](https://developers.google.com/youtube/iframe_api_reference),
[regras do player](https://developers.google.com/youtube/terms/required-minimum-functionality),
[privacidade](https://support.google.com/youtube/answer/157177),
[limites Storage](https://supabase.com/docs/guides/storage/uploads/file-limits).

## Validação e limites

Evidência anterior detalhada no guia: testes focados do core/timeline/player,
12 testes de compartilhamento/hook/API, SQL isolado (RLS, vínculo, rotação,
revogação, expiração), handler Edge isolado, tipos, escopo, higiene e build web.
Smoke autenticado local: modal e prévia da mesma Studio com 80 rallies/20 contatos,
busca por contato e ausência de edição; rota pública inválida também conferida.
Isso não certifica upload remoto, deploy da função, precisão do detector ou native.

Preservar a preferência do usuário por refinamentos rápidos: uma conferência
proporcional por ajuste visual, sem repetir a esteira completa. Usar a escada de
validação quando houver publicação, estado, dados ou permissões. Não gerar PR,
merge, deploy ou migrations remotas só porque a branch foi enviada.

### Fechamento para commit/push

- `build:verified`: 580 suítes / 3.321 testes, 11 suítes SQL, tipos, encoding,
  JWT, escopo e assets passaram. A primeira execução falhou em lint, marca,
  arquitetura e higiene de performance; não registrar o executor como aprovado.
- Pendências do pacote corrigidas: adaptadores remotos movidos para `src/api`,
  estado derivado de tracking/foco/prévia, dependências dos hooks, indicadores de
  render/carga, estilos de linhas e referências técnicas na documentação.
- Após essas correções: 60 testes focados em oito suítes, `typecheck:app`, lint
  dos 40 arquivos app/src do pacote sem avisos, arquitetura, marca, escopo, performance
  strict e build web passaram. Handler Edge isolado também passou nesta entrega.
- O lint amplo encontrou três avisos nos testes anteriores de DateInput, que
  permanecem fora deste commit. Não editar nem publicar esses ajustes sem
  reconciliar o trabalho correspondente. O executor completo não foi repetido;
  somente os checks afetados pelas correções, conforme a escada de validação.
- Smoke final autenticado: reabertura do mesmo arquivo recuperou 80 rallies,
  20 contatos e 7 pontos; imagem/traçado visíveis, navegação mantendo macro,
  prévia sem edição e retorno com rascunho salvo. Não houve upload remoto.


### Continuação local: YouTube — 13/10

A decisão descrita acima foi implementada em alterações locais posteriores ao
commit `f9f56b61`, ainda sem commit/push. Ver seção **Fonte YouTube integrada
localmente** no guia de implementação para contrato, evidências e limites.
O link entra no mesmo estúdio, com rascunho separado; não migra automaticamente
as marcações do arquivo. O original permaneceu com 80/20/7/20.222 na conferência.
Migration complementar `20261013170000_scouting_video_youtube.sql` e adaptação da
Edge Function/API preparadas para compartilhar sem upload. Ambas as migrations
do compartilhamento continuam sem ativação remota. Preservar os ajustes locais
de calendário/DateInput e seus trechos do checklist.

### Continuação local: análise Gemini por link

Fluxo implementado em desenvolvimento, com serviço loopback iniciado por
`node scripts/scouting-youtube-service.mjs`. Configuração e cache privados ficam
em `%USERPROFILE%/.config/goatleta/`, fora do Git. Nunca imprimir a chave.
Gemini 3.1 Flash Lite respondeu realmente ao link; modelos mais novos tiveram
503/timeout e Pro teve cota gratuita zero. Precisão esportiva segue experimental.
Ler a seção Gemini do guia de implementação para retomada, limites e validação.
Não publicar o serviço loopback como endpoint de produção.

Execução real concluída em 13/10 para `mdfgd1K3HTc`: 16 trechos contíguos,
15:11 processados, 94 rallies e 296 contatos sugeridos. Resultado exibido no
mesmo estúdio; aceite habilitado somente após mapear a equipe. Nenhuma sugestão
foi aplicada ao rascunho real durante a validação. Não confundir essas contagens
com eventos esportivos confirmados. Evidência visual local ignorada:
`.tmp/scouting-gemini/youtube-analysis-complete.png`.

Revisão posterior: o lote 94/296 foi **reprovado para aplicação em bloco** por
divergências visuais de saques e inícios de rally em vários trechos. Modal fechado
sem aplicar. Equipe próxima à câmera, sem troca de lado, confirmada pelo usuário.
Lista completa corrigida ainda pendente; cache bruto não equivale a validação.
Ver [conferência visual e limites](scouting-youtube-review-2026-10-13.md).


Atualização final de 13/10: revisão visual sequencial de todo o vídeo (0–910,7 s), com ampliação dos contatos candidatos. Aplicados e salvos no rascunho YouTube 78 segmentos de rally e 201 contatos observáveis; exportação da UI idêntica ao documento validado. Contatos encobertos ou ambíguos excluídos, sem atribuir atletas/resultados/pontos. Cobertura temporal completa não significa anotação de todos os toques nem precisão automática certificada. Detalhes em `docs/operations/scouting-youtube-review-2026-10-13.md`. Rascunho do arquivo original preservado.


### Continuação local: tracking no link e modelos — 13/10

O rascunho YouTube agora contém 78 rallies, 201 contatos e 20.222 posições do
original, vinculado com offset 0; salvamento/exportação/reabertura conferidos.
Validação > Tracking da bola oferece original local ou análise já processada,
confirmação da mesma edição e sincronização. O original de 80/20/7 não foi editado.
Trajetória é exibida/corrigível no painel lateral, fora do player; em leitura não
há processamento/correção. Novo link precisa de seu próprio original acessível
uma vez para gerar tracking. Gemini por link continua separado e experimental.

Detector padrão GridV2b preservado; V4c é opção explícita para comparação,
modelo público pequeno e MIT. Worker/decoder/filtro validados e dois modelos
executados no IAB. Consultar [estudo de modelos](scouting-ball-model-comparison-2026-10-13.md)
antes de trocar padrão, baixar datasets ou iniciar treinamento. Tool CSV prepara
candidatos; não treina nem certifica rótulos. Precisão 100% não foi demonstrada.
Ver evidência e limites no guia de implementação. Todas alterações permanecem
locais; permissões anteriores de publicação/ativação não foram ampliadas.

### Trajetória sobre a imagem — 13/10

Modo **Original com tracking** implementado e conferido no mesmo rascunho do
YouTube. Escolher o arquivo original conhecido acima; identidade é verificada
antes da troca. O estúdio conserva tempo, velocidade, editor e marcações ao
alternar fontes. Arquivo permanece somente nesta abertura, sem upload; selecionar
novamente após fechar/recarregar. IFrame continua com tracking no painel externo.
39 testes focados, tipos, lint e diff passaram. Smoke local com original correto,
arquivo diferente rejeitado e troca de players; exportações antes/depois idênticas
com 78/201/20.222. Evidência `.tmp/scouting-model-research/tracking-overlay-final.png`.
Servidor Expo retomado em 9184; original ativo, pausado em 36,5 s, rally 04,
recepção de 36,5 s aberta em edição sem alterações, como no estado anterior.

### Piloto Gemini: posição da bola somente pelo link — 13/10

Executada uma chamada isolada no trecho 20–40 s, 80 instantes solicitados, sem
enviar original/frames. Gemini 3.1 Flash Lite retornou 48 posições e 32 incertas;
9.951 tokens informados. Conferência independente em 20 frames: 14 bolas
observáveis, seis omissões e oito coordenadas com erros de 43–407 px (0/8 dentro
de 15 px). Configuração reprovada para produto; nenhuma trajetória/contato/rally
aplicado ou alterado. Não repetir a CLI para consultar a evidência já salva.
12 testes e lint do piloto passaram; referência, resultados e mosaicos estão
ignorados em `.tmp/scouting-youtube-ball-pilot/`. Ver
[método e limites](scouting-youtube-ball-pilot-2026-10-13.md).

### Avaliação WASB e GridV3 concluída — 14/10

Comparação local dos quatro modelos nos mesmos 600 quadros de 20–40 s e na
referência visual independente: 14 posições observáveis, seis incertas sem
pontuação. Todos acertaram 10/14 até 15 px; WASB teve erro de 222,85 px e
4,65 fps CPU; GridV3 teve erro de 195,80 px e 62,53 fps. GridV2b: 46,92 fps;
V4c: 41,33 fps. Isso não certifica precisão global nem runtime do navegador.
Nenhum candidato promovido ou aplicado. Padrão e rascunhos preservados.

CLI offline `scripts/validation/scouting-wasb-benchmark.py` e 11 testes aprovados;
três fixtures privadas do decoder GridV3 passaram. Ambiente isolado em
`.expo/wasb-venv/`; evidências/adapter/checkpoint/runner em
`.tmp/scouting-wasb-evaluation/`. Pesos e insumos não estão no Git.
Consultar [relatório completo](scouting-wasb-evaluation-2026-10-14.md) para hashes,
licenças, método e resultados, sem repetir inferência. Nenhum upload, chamada
Gemini adicional, treinamento, compra ou ativação remota. Acesso a frames de
novos links do YouTube continua separado e não foi habilitado por este teste.

### Piloto Roboflow por link — 14/10

Com conta conectada pelo usuário, preparado e salvo somente o draft Go Atleta
YouTube ball pilot (volleyball_v2/3 + ByteTrack + metadados, sinks desabilitados),
sem publicação. Run Workflow com a URL mdfgd1K3HTc em Stream retornou protocolo
HTTPS inválido: somente RTSP/RTSPS. Nenhum frame, previsão ou JSON de trajetória;
a precisão e a importação não chegaram a ser testadas. Biblioteca de mídia
ofereceu armazenamentos, sem origem YouTube. Não houve escrita no estúdio.
Evidências privadas em `.tmp/scouting-roboflow-youtube-pilot/`; consumo com
atraso e sem baseline, não declarar custo incremental zero. Ver
[relatório, limites e contrato de importação pendente](scouting-roboflow-youtube-pilot-2026-10-14.md).
