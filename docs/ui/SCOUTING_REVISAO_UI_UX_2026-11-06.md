# Scouting — revisão de interface e fluxo local

Rodada de 06/11/2026, solicitada para revisar a tela inteira e organizar a
conexão da câmera. Escopo: localhost, preparação, bancada, fontes, pareamento,
gravação, biblioteca e revisão. Não é certificação de produção nem de hardware.

## Método e percurso

1. Conferir a visão geral, abrir uma análise existente e inspecionar preparação.
2. Percorrer Registrar, Revisar, ferramentas, fundamentos e escalação.
3. Abrir Adicionar vídeo, entrar em Câmera e voltar para as fontes.
4. Conferir geração de QR, ajuda, teclado e painel do cabeçalho.
5. Abrir a biblioteca e o vídeo já salvo, preservando dados e arquivos.
6. Conferir câmera móvel sem pareamento, biblioteca e retorno de foco.
7. Cruzar as observações com código, estados de erro e testes de regressão.

A Home do professor foi inspecionada como referência de densidade. Capturas
autenticadas da rodada ficam em `.tmp/work/scouting-full-audit/`, ignorado pelo
Git; não devem ser publicadas. A inspeção usa o screenshot efetivamente salvo,
DOM e medidas renderizadas. Testes sintéticos são identificados separadamente.

## Achados e correções

| Área | Inconsistência confirmada | Correção local |
| --- | --- | --- |
| Palco inicial | Stream antigo/desconectado cobre o botão Adicionar vídeo e deixa área vazia | Prévia exige conexão, estado de câmera útil e track vivo; DOM da prévia continua montado, oculto quando inútil |
| Registrar compacto | Segundo bloco vazio de vídeo aparece sob a preparação | Oculta apenas o vazio da fonte visível, preservando mídia real e prévia |
| Estado da câmera | Botão Iniciar aceita condições que o host rejeita | Painel usa o mesmo estado canônico dos controles do cabeçalho |
| Desconectada | Nova gravação e Desligar aparecem desabilitados e sem utilidade | Ações por estado; reconexão orienta usar a mesma aba do celular |
| Identidade da cópia | Progresso/erro de cópia histórica pode ser atribuído à sessão atual | Estado atual separado de cópias de outras gravações |
| QR | Código e ações ocupam o painel mesmo após conectar | QR inicial direto; Mostrar QR secundário após interrupção/conexão, sem recriar sala |
| Densidade da conexão | Controles, duração antiga, cópia e QR excedem o popover | Seções compactas por estado, QR limitado e duração junto do arquivo correspondente |
| Foco | Tick do relógio recria referências e reposicionamento refoca o painel | Referências estáveis e foco de entrada, sem refoco em atualizações passivas |
| Fontes | Menu Fonte não oferece entrada direta para a câmera | Câmera do celular, gravações salvas e arquivos/links no seletor |
| Tipografia | Overrides locais de 14 px divergem da escala operacional | Corpo/controles e metadados usam `compactUiMetrics`; ícones do estúdio usam 16 px |
| Fechamento | X de ajuda/escalação anuncia Fechar análise | Nome acessível acompanha o diálogo que será fechado |
| Diálogos | Título com ID fixo compartilhado | ID de título próprio por instância |
| Revisão salva | Download de marcações compete com vídeo; UUID e status repetem informação | Download de vídeo no cabeçalho; marcações junto dos pontos; metadado curto |
| Revisão vazia | Coluna inteira reservada para zero pontos | Player usa a largura disponível; nota curta abaixo |
| Arquivo inválido | Escolha errada libera a fonte válida antes de conferir o arquivo | Validação antes de trocar/liberar a prévia existente |
| Salvamento | Nova identidade de callback/sessão abandona Promise e deixa Salvando permanente | Resultado pertence à URL e à instância montada; sem gravação duplicada |
| Integridade de importação | Arquivo curto pode ser aceito quando não há pontos posteriores | Duração conhecida da gravação encerrada conferida com tolerância de 2 s ou 5% |
| Galeria | Filtro de outra mídia continua aplicado após seu controle desaparecer | Filtros vinculados à mídia e opções atuais |
| Miniaturas | Cache ignora correção do offset da mídia | Chave inclui o offset, sem reutilizar quadro desalinhado |
| Escalação | X perde o rascunho silenciosamente | Rascunho retido; salvar ou descartar explícitos; saída para elenco/encerramento protegida |
| Nomes em quadra | Primeiro nome repetido não distingue atletas sem camisa | Inicial do sobrenome; sobrenome expandido se a inicial também colidir; largura e elipse preservadas |
| Timeline | Lista interativa declarada como tooltip; Espaço pode acionar play atrás | Diálogo não modal, gatilhos coerentes e teclado da lista isolado; desenho preservado |
| Reconexão móvel | Join/sinalização/JSON pendurados travam a tentativa | Deadline de 10 s e cancelamento no desligamento do transporte |
| Biblioteca móvel | Erro/progresso fica no HUD atrás da biblioteca | Feedback visível na própria biblioteca |
| Biblioteca móvel | Só as primeiras 20 gravações são acessíveis | Mostrar mais incremental, sem ler todos os Blobs |
| Biblioteca móvel | Overlay sem comportamento modal/foco completo | Diálogo nativo, Escape e retorno de foco, sem interromper captura |
| Cópia restaurada | Retomar gravação encerrada exige abrir a câmera | Reconectar dados sem adquirir câmera/microfone |
| Falhas de captura | Estado terminal pode não oferecer saída útil | Retry apenas antes do início seguro; parcial abre gravações; falha de finalização tem ação própria |
| Entrada móvel | Câmera sem QR mostra ação morta e números vazios | Instrução central de ler o QR; oculta dados/ações inaplicáveis |
| Atualização local | Cleanup de efeito mantém sala, mas deixa poll/peer/canal encerrados | Replay reanexa a mesma sala e aguarda commit pendente antes de reidratar a mesma gravação |
| Portal da prévia | Nó de vídeo novo pode ficar sem a fonte já existente | Reanexa MediaStream e descarta listeners/callbacks do nó anterior |
| Fonte móvel | Inter existe no computador, mas não é fornecida ao celular | Inter 400/600/700 local, licença completa, whitelist/MIME/CSP restritos |
| Tablet | Quadra cresce até consumir quase toda a altura da tarefa | Limite de 340 px com a geometria aprovada; alvos continuam com as mesmas medidas |
| Celular estreito | Transporte vira três linhas e ferramentas da galeria ficam soltas | Transporte em duas linhas; alternador grade/lista e ferramentas no menu em containers até 420 px |
| Ação flutuante | Chat cobre filtros e pontuação | Mesmo chat no menu do estúdio; launcher flutuante só é oculto enquanto esse acesso está disponível |

O desenho da quadra, o trilho compacto e os controles já aprovados foram
preservados. Não foram adicionados voz, IA para pontuar, rubrica nova ou rotação
automática de atletas. Esses itens exigem decisões de produto e domínio próprias.

## Acessibilidade e limites

Foco inicial, Escape, retorno ao gatilho, rótulos de ícones e conteúdo interativo
foram conferidos nos fluxos exercitados. Referência técnica:
[diálogos WAI-ARIA](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
O balão da timeline contém ações; por isso usa diálogo não modal em vez do
[papel de tooltip](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/).
Isso não atesta conformidade integral com WCAG ou leitor de tela físico.

A câmera móvel carrega Inter do companion, com fallback normal caso o arquivo
não esteja disponível; não depende de fonte remota. Os arquivos e a licença
ficam em `public/scouting-live/fonts/`. Captura física, encoder,
1080p/60, troca óptica e resistência ao Wi-Fi/suspensão do aparelho precisam de
rodada no celular após atualizar a mesma aba. Teste de browser não substitui
essa evidência. O vídeo antigo pixelado não foi reparado ou sobrescrito.

## Validação da rodada

Validação por fatia, sem apresentar reexecuções como novos casos:

- Câmera: 96 testes Node; companion: 14 testes Node.
- UI/status da câmera: 66 testes; host: 65; receiver/transfer: 22.
- Galeria/timeline/escalação/coletor: quatro suítes, inicialmente 115 casos;
  duas regressões adicionais da quadra passaram (total corrente: 117).
- Passada final de interface: 100 casos em seis suítes (workspace, revisão, menu,
  quadra, galeria e launcher). Biblioteca/workspace de câmera: 38 casos em duas
  suítes após simplificar seu cabeçalho. Há sobreposição com as fatias acima;
  os números não devem ser somados como casos exclusivos.
- `typecheck:app`, `check:org-scope`, `check:architecture`, `check:perf-hygiene`,
  lint dos arquivos alterados e diff-check aprovados. O runner mantém avisos
  conhecidos de `act`/handles no harness; execuções finais passaram com exit 0.

Inspeção autenticada no localhost em 1440×1024, 1366×768, 834×1194, 390×844
e 320×640; tamanho original de 1346×884 conferido na abertura. Sem overflow
horizontal da página. Grade/lista mantiveram o palco em 935,125×611 no desktop
e 276×155,25 no extremo compacto. No compacto pode ocorrer scroll de foco;
isso não foi descrito como estabilidade absoluta da posição da página.
O contato foi buscado em 7,1382 s pelo teclado sem iniciar play. Registrar/Revisar
preservaram a mesma URL local e posição 7,1382 s no ensaio sem HMR.

Ajuda fechou com Escape mantendo o diálogo de fontes e retornando ao ícone.
Voltar para fontes retornou ao gatilho da câmera. Biblioteca móvel abriu como
diálogo nativo e Escape devolveu foco. O chat abriu pelo menu e fechou sem enviar
mensagem; launcher ficou oculto dentro do estúdio e continua disponível fora.

Replay de efeitos com refs/estado retidos foi exercitado por fixture. Mudança de
assinatura dos hooks ou reload completo ainda constitui novo mount e pode exigir
novo pareamento. Após uma atualização ampla, a rota ficou no carregamento de
organização; reload limpo restabeleceu a tela. Não foi atribuído a falha do Wi-Fi.

O companion foi reiniciado isoladamente, com captura/cópia ociosas, para servir
as fontes. HTTPS validou a cadeia sem desativar TLS: fonte 200/font/ttf,
310.252 bytes idênticos ao arquivo local, `cameraReady=true`. Inventário do
browser observou os recursos Inter Regular/SemiBold. Reiniciar o companion
perde salas temporárias em memória; arquivos e marcações persistidos permaneceram.
A gravação de 28,349479 s foi reaberta localmente (1080×1920, sem MediaError) e
baixada pelo botão reorganizado: 20.398.116 bytes e SHA-256 idêntico ao arquivo
preservado. Isso não remove a pixelização já confirmada no original. Novo teste
físico contínuo e de retomada segue pendente.

Somente local: sem commit, push, migração, publicação ou alteração de produção.

## Ocorrência posterior: módulo 3349

O usuário relatou falha de carregamento depois do fechamento da revisão. A
recuperação operacional reiniciou apenas o Metro com cache de compilação limpo
e recarregou o cliente; não alterou os imports, as dependências ou a feature.
A preparação e o lazy da revisão voltaram a abrir, com vídeo/rally preservados.
O [registro operacional](../operations/workstations.md#módulo-numérico-desconhecido-no-metro--recuperação-local-de-06112026)
separa essa evidência da estabilidade prolongada e do teste físico ainda pendente.


## Continuação física: prévia e início da câmera

O início após parear voltou a funcionar sem módulo 3349. A primeira gravação
nova chegou a 100% após reconexão e foi baixada, mas continha imagem preta;
passar no decoder não foi tratado como qualidade de imagem aprovada.

A inspeção real identificou conteúdo da prévia com altura zero, concorrência
na atribuição do stream e alerta de autoplay obsoleto. Foram corrigidos o
preenchimento do stage, a atribuição no callback e o aviso; a prévia bloqueada
agora oferece ação real. Negociação RTC passou a ter prazo e início bloqueia
aba oculta/fonte indisponível, sem decidir pelo brilho da imagem.

Salvando no computador e Envio pausado substituem termos ambíguos de cópia.
Novo pareamento após as alterações mostrou imagem nos dois aparelhos, confirmado
pelo usuário e pelo browser. O teste seguinte teve início/fim pelo computador;
[arquivo, checagens e limites](../operations/scouting-live-local.md#início-prévia-e-negociação--teste-físico-de-06112026).


A rodada final confirmou vídeo novo em 1920×1080: envio completo sem queda
observada, reabertura/download e reprodução após 17 s até o final. Decoder sem
erros e imagem presente; 60 fps efetivos e velocidade de envio seguem pendentes
(o arquivo apresentou cerca de 23,58 fps). A correção de altura da prévia foi
conferida com fonte física em 1346×884; a matriz responsiva anterior não deve
ser citada como novo teste físico desse patch em todos os tamanhos.
