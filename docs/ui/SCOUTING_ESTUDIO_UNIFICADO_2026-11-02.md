# Scouting: visão geral e Estúdio unificado

Frontend local em 02/11/2026, sem deploy. Migração de desfechos aplicada no banco
remoto após autorização explícita; detalhes abaixo.

## Organização

A página Scouting apresenta rendimento da turma e histórico. O cabeçalho tem
uma entrada **Estúdio**, sem portas independentes para coleta, vídeo e ao vivo.
Análises do histórico abrem o mesmo workspace na área Registrar; jogos concluídos
oferecem revisão de pontos/contatos somente para leitura, sem exigir vídeo.
A coleta ativa continua disponível nas análises em andamento. A entrada principal
e a continuação da revisão abrem Vídeo. Nova análise fica no cabeçalho e usa o
formulário existente.

No web, o Estúdio reúne três áreas:

- **Registrar:** coletor embutido, placar e ações na área de trabalho. Configuração
  inicial curta acompanha o conteúdo; a coleta operacional usa o espaço disponível.
- **Vídeo:** player, recortes e revisão do scouting. Abre em Pontos do jogo;
  contatos do vídeo ficam no mesmo painel. Sincronização, formato, lados e
  conferência automática permanecem recolhidos até serem necessários.
- **Câmera:** captura pelo celular, com a conexão e gravações locais existentes.
  Continua restrita ao desenvolvimento local. É uma nova captura; não adiciona
  pontos automaticamente às análises oficiais selecionadas na área Vídeo.

O cabeçalho é único, fixo e permanece montado nas três áreas. As ações próprias
do vídeo ocupam um slot retido do cabeçalho do workspace. Portal, bloqueio do
fundo, retorno de foco e guarda de navegação têm um único dono. Modais permanecem
para configuração ou confirmação pontual.

## Estado e dados

Cada ferramenta monta na primeira visita e permanece montada ao alternar áreas.
Ocultar usa `hidden` e `inert`, sem trocar IDs ou recriar hooks. No vídeo,
`visible` controla reprodução/atalhos; `active` continua significando foco da
rota, para não cancelar processamento ao alternar ferramentas. A câmera mantém
peer e DataChannel; o coletor conserva contato em edição e histórico em RAM.

A saída real encadeia as guardas de coleta, vídeo e câmera. Operações da coleta
em voo bloqueiam saída/troca de análise. Falha ao encerrar a sala da câmera
preserva conexão, sessão e confirmação aberta.

O workspace mantém `videoSessionId` e `manualSessionId` separados. Trocar o set
em Registrar passa pela guarda da coleta e recria somente o coletor; vídeo e
câmera permanecem montados, com processamento e conexão preservados. Trocar a
análise do vídeo passa pelas guardas do conteúdo e mantém a câmera independente.

A lista de sets em Registrar recebe as fontes efetivamente vinculadas ao vídeo,
carregadas pela revisão dentro do escopo autorizado. Não é inferida pelos títulos
nem pela ordem do histórico. Ao abrir um documento de revisão que não é um set,
o registro limpo e sem operação em voo adota o primeiro set vinculado; se a
análise aberta pelo histórico já pertence às fontes, sua seleção é preservada.
Uma escolha manual explícita não é substituída por atualizações da revisão.

Os callbacks de edição e operação em voo atualizam referências síncronas antes
do próximo render. Assim, uma lista de fontes recebida no mesmo lote de eventos
não remapeia um coletor que acabou de ficar em edição ou ocupado. Atualizações
tardias de outro vídeo também são ignoradas. Os testes focados de workspace
(13 casos) e revisão do scouting no vídeo (29 casos) cobrem esse fluxo e o
callback de fontes.

Nenhum contrato de persistência foi substituído. Organização, usuário, turma,
sessionId, fingerprint, chaves de rascunho e sidecars dos vínculos permanecem
iguais. A reorganização não reescreve os registros feitos durante o jogo.
O coletor nativo mantém sua apresentação modal padrão.

## Rendimento

O panorama usa apenas análises concluídas, com totais de análises, ações observadas
e pontos registrados. Não chama sets de jogos. Contextos como 6 × 6 e Outro são
separados antes de calcular indicadores; os critérios existentes de recepção,
ataque e saque são reutilizados. Eficiência negativa continua visível; ausência
de observações é indicada por traço, sem fabricar zero.

A evolução de recepção usa duas ou mais análises com amostra no mesmo contexto.
Detalhar fundamentos revela distribuição, critérios e pontos recebendo/sacando.
A coleta parcial permanece explícita, sem tratar ausência de contato como erro.

## Coleta v3

O coletor reconhece `captureVersion: 3` retornado pelo backend para habilitar
desfechos explícitos de ace/falta e os novos resultados de continuidade. Sem
essa capacidade, mantém a coleta v2; a interface não presume a migração aplicada.
Falta da equipe é separada dos contatos técnicos e não inventa erro de recepção.
Bola de graça devolvida fica fora da eficiência de ataque; bloqueio com
continuidade não encerra o ponto.

A migração aditiva preparada em `20261102163000_scouting_rally_outcomes.sql`
foi **aplicada remotamente com autorização explícita**, no projeto ativo
verificado. O pós-cheque confirmou coluna/constraint de `outcome` e capacidade
`captureVersion: 3`. Sem backfill: os históricos permanecem sem desfechos
inferidos. O pacote não reescreve a coleta original nem os 99 vínculos com vídeo
revisados. O esquema 5 × 1 do mockup continua ilustrativo, sem afirmar um motor
completo de rodízio. O frontend permanece somente no localhost, sem deploy.

## Mockups

[Proposta interativa](mockups/scouting-unified-2026-11-02.html) com estados de
visão geral, registro, vídeo e câmera. Dados ilustrativos são sinalizados
permanentemente; o SVG da quadra não é vídeo real nem resultado do detector.
[Notas e tokens](mockups/scouting-unified-2026-11-02.md).

A [proposta v2](mockups/scouting-unified-2026-11-02-v2.html) preserva as áreas
Registrar/Vídeo/Câmera, abas Recortes/Scouting/Informações e transporte/timeline
reais como referência. Explora registro compacto e 5 × 1 ilustrativo, começando
em Sem atleta. [Estados e limites](mockups/scouting-unified-2026-11-02-v2.md).
A [pesquisa comparada de seis produtos](SCOUTING_PESQUISA_COMPARADA_2026-11-02.md)
separa funcionalidades documentadas, decisões propostas e limites da automação.

## Validação local

Testes focados cobrem retenção entre áreas, carregamento sob demanda, guardas,
escopo, captura em painel, contexto dos indicadores e toolbar no cabeçalho.
Tipos, org-scope, arquitetura e perf-hygiene passaram. Smoke no localhost
confirmou o workspace e a retenção de um campo em edição entre Registrar/Vídeo,
sem enviar o formulário. A troca real de Set 3 para Set 2 conservou o mesmo
iframe do vídeo. Câmera, formulário de nova análise (aberto e cancelado),
detalhes dos fundamentos, histórico e retorno de foco foram conferidos.

Inspeção visual em 390 × 844, 834 × 1194 e 1440 × 1024: reflow de vídeo e
inspetor, áreas do Estúdio acessíveis e sem overflow horizontal da página.
As capturas reais e os mockups são evidências distintas; o mockup usa dados
ilustrativos e não certifica hardware ou processamento.

Hashes do documento e dos vínculos do jogo permaneceram iguais ao baseline:
118 recortes, 51.233 posições e 100 referências (99 com vídeo e uma sem imagem).
Export web local concluído: 124 rotas e chunks separados de Workspace,
Vídeo e Câmera gerados em `dist`. O cache precisou de nova varredura; os avisos
de exports de dependências tiveram fallback e não impediram a compilação.
Esse export não representa publicação nem validação remota.

Na extensão local da coleta v3, 126 casos focados passaram: 43 do núcleo de
rallies, 54 de frontend e 29 da revisão em vídeo. SQL foi validado em banco em
memória, com fixtures limpas e cenário sintético de compatibilidade do schema
hospedado. Tipos, org-scope, arquitetura e perf-hygiene passaram. A migração
remota autorizada teve pós-cheque separado: snapshot de 118 rallies, 159 ações
e 12 sessões com contagens/hashes idênticos antes/depois e zero desfechos
históricos preenchidos. IDs e valores originais foram preservados.

Conferência real desta extensão concluída em 1063 × 704 e 390 × 844, sem
overflow. Recortes/Scouting/Informações conservaram o mesmo iframe, player e
timeline; hashes do sidecar e dos 118 recortes iguais ao baseline, com os 99
vínculos preservados. Não foi criado ponto artificial no jogo: essa conferência
não valida uma nova escrita RPC pela interface. [Contrato da coleta v3](SCOUTING_COLETA_V3_2026-11-02.md).

O rascunho local preservado ainda pode informar sincronização remota pendente
quando a análise recebida não corresponde ao vídeo. A reorganização não aceita
essa versão remota nem esconde o aviso. Os novos controles físicos e a ativação
pública do modo câmera continuam pendentes conforme a
[operação local](../operations/scouting-live-local.md); o funcionamento básico
Android/Wi-Fi foi relatado pelo usuário, sem medição de latência.

## Correção posterior de UI e reprodução — 02/11/2026

As ações do cabeçalho revelam a área Vídeo antes de abrir seus diálogos,
mesmo quando acionadas de Registrar/Câmera. Câmera usa a mesma grade, largura
lateral e início vertical das outras áreas;
conexão fica inline, instruções de certificado recolhidas e ações de ponto
ocultas antes de existir sessão. Em Registrar, `ScoutingRecordedReview` navega
pontos e contatos concluídos em leitura. No Vídeo, navegação de revisão mantém
respiro de 12 px/gap de 8 px, sem repetir o adversário no resultado do ponto.

O player usa busca absoluta e preserva o pedido de reprodução enquanto aguarda
ready/fonte, inclusive no estado BUFFERING. O normalizador SQL que aceita o
primeiro recorte em 00:47.640 foi aplicado com autorização explícita: preflight
conferiu alteração restrita à guarda do primeiro início, hashes e ACLs. A
migração não editou dados existentes. Avisos de sincronização ficam compactos,
com detalhes, exportação e retry; rejeição do servidor é distinta de divergência
entre documento e vídeo, sem repetição de avisos.

Suítes focadas de reprodução, revisão, sincronização, workspace/câmera e leitura
dos registros passaram, assim como SQL, tipos e org-scope. QA real em 1063 × 704
e 390 × 844 confirmou navegação dos pontos/contatos, margens e início vertical
consistentes, cabeçalho retido e ausência de overflow horizontal. Assistir lance
abriu em 01:02 e avançou com imagem; não houve tela preta nos saltos conferidos.
Isso não certifica todas as falhas intermitentes do provedor YouTube.

Nova análise usa a camada acima do Estúdio e altura ajustada ao formulário;
abertura e fechamento foram conferidos sem criar sessão. Após a correção do
normalizador, a interface informa Sincronizado, sem o alerta antigo. Hashes do
documento e do sidecar iguais ao baseline: 118 recortes e 99 vínculos com vídeo.
A migração não reescreveu registros; nenhuma pontuação/vínculo foi editado nem
ponto artificial criado. Frontend somente localhost, sem deploy.

## Câmera: captura, término e exclusão — 02/11/2026

Preparar abre prévia/RTC sem gravar; Gravar aguarda onstart real. Finalizando
aguarda evento final, fila de trechos e commit antes de liberar áudio/vídeo.
Append falho retém Blob/índice em RAM para retry com a tela aberta; exportação
e exclusão ficam bloqueadas até concluir. Reconectar na tela aberta preserva
captura, sem novo QR durante a gravação; captura encerrada exige novo QR.

Horizontal é o padrão, com Vertical antes da captura. Uma barra inferior reúne
gravar/parar, tempo, armazenamento, formato, tela cheia e gravações; preparo e
reconexão ficam no centro da imagem, com QR lateral no notebook.
Tela cheia/orientação são best-effort, sem rotação por CSS/canvas.
Celular confirma exclusão definitiva do recordingId e seus trechos/eventos;
notebook confirma lixeira durável/restaurável escopada, bloqueando ativos e
cópias pendentes, sem ressuscitar gravação excluída. A identificação inclui HH:mm.
Nenhum desses caminhos grava nas análises ou vínculos anteriores.

21 casos da câmera e suítes focadas de host/armazenamento/UI passaram, além de
tipos, org-scope e perf. Interface conferida em 1055×487 e 390×844 sem overflow,
incluindo formato, painel de gravações e cancelamento da exclusão no notebook.
Hashes dos 118 recortes e 99 vínculos revisados idênticos ao baseline.
Novos controles no Android ainda não foram validados fisicamente. Uma aba já
aberta precisa de atualização manual após finalizar/exportar; sem reiniciar o
companion ou publicar. [Fluxo, recuperação e limites](../operations/scouting-live-local.md).
