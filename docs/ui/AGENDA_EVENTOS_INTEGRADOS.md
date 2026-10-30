# Agenda e eventos integrados — 26/10/2026

Implementação local. A Agenda passa a ser a entrada única para aulas e eventos.
As rotas /coord/events e /events são aliases; links de detalhe existentes seguem
válidos. Menu, atalhos do painel e ação radial apontam à Agenda, sem segunda
entrada Eventos. A lista diária e o mês continuam no fluxo; o editor explícito
abre em modal no desktop e painel inferior em largura móvel.

A especificação atual de continuidade mês/lista e a nova comparação por ADB
estão em [Gestos da Agenda — 27/10](AGENDA_GESTOS_REFERENCIA_2026-10-27.md).
Os ensaios abaixo registram as etapas anteriores; a passagem que antes parava
na borda passou a consumir a sobra do mesmo movimento.

O contrato atual de criação/edição e a inspeção física de 29/10 estão em
[Referência Samsung e adaptações](AGENDA_SAMSUNG_REFERENCIA_2026-10-29.md).
Os registros datados abaixo preservam as etapas e limites de cada rodada.

## Referência observada

Samsung Calendar no SM-S931B conectado por ADB: seleção de dia, lista de horários,
adição na data selecionada e editor com título, início/fim, dia todo e campos
complementares. Inspeção pela UI e hierarquia de acessibilidade, sem extrair APK,
código, base de dados ou copiar recursos proprietários. Nenhum evento foi salvo
no aparelho. Capturas privadas ignoradas em .tmp/calendar-samsung/.

## Comportamento e limites

- Criar evento herda o dia selecionado. Consultar e editar ocorrem na Agenda.
- Metadados persistidos: título, descrição, período, dia todo, local, categoria,
  esporte e vínculos de turmas. Reutiliza APIs e validação/versionamento de torneios.
- Datas e horários inválidos bloqueiam Salvar. Rascunho alterado pede descarte.
  Salvar é explícito; confirmação de regulamento não pode aceitar avisos sozinha.
- Gestão mantém o nível administrativo existente (role_level >= 50); demais atores
  só consultam seus eventos autorizados. Atletas continuam sem leituras gerais nem
  gestão. Filtros organization_id e RLS permanecem existentes.
- Etapas assíncronas conferem sessão, organização, papel, foco e rascunho antes de
  continuar. Se o vínculo de turmas falhar após criar, nova tentativa atualiza o
  mesmo ID. Não há nova transação de backend; operação já enviada não é desfeita.
- Eventos de vários dias são exibidos nos dias abrangidos. A Agenda pede intervalo
  sobreposto (fim > início do recorte e início <= fim do recorte). Os outros
  consumidores de listEvents conservam o filtro anterior por início.
- A nova interface não promete entrega de convidados/lembretes: o formulário antigo
  mostrava esses campos, mas submitCreate não os enviava à API. Nenhuma integração
  de notificações ou calendário externo foi adicionada.

## Validação

77 testes em dez suítes de editor/calendário/API/menu/gestos passaram. Tipos, lint,
org-scope, arquitetura, higiene de performance, diff e exportação web passaram. Browser autenticado em localhost:8081 (checkout
577e, código sincronizado ao 031b): alias Eventos abriu Agenda; 30/09 selecionado
preencheu início/fim; rascunho confirmou continuar/descartar; categoria atualizou.
Layout conferido em desktop e viewport web 390x844, restaurado após teste.
Capturas ignoradas em .tmp/agenda-integrada/. Criação, edição, exclusão, perda de
sessão/organização e retry testados com transporte fictício. Não houve mutação
real dos eventos da organização; isso não é atestação de RLS remoto nem smoke
nativo do Go Atleta. Sem commit, push ou novo deploy desta alteração.

## Calendário e criação rápida Samsung

Referência conferida novamente por ADB em 26/10 no mesmo SM-S931B: semana
recolhida, mês expandido por arrasto sobre o calendário, células com barras,
lista do dia e barra inferior. Tocar no texto abre título/sugestões/confirmação;
o + abre os detalhes. Não houve salvamento no aparelho nem extração de APK.

O Go Atleta agora usa uma coluna em desktop e celular. Domingo abre a semana;
o mês exibe somente suas 4–6 linhas. O dia selecionado usa número contrastante; pontos usam as cores existentes
das turmas/eventos. A altura reserva
espaço para a lista inclusive com mês expandido. Esse contrato substitui a antiga
composição em duas colunas. A preferência posterior por pontos foi preservada.

A barra inferior é um footer fora do ScrollView e do alvo de arrasto, inclusive no
adaptador nativo. O texto abre a criação rápida; o + abre o editor completo. Título
com sufixo explícito, por exemplo Reunião às 18h ou Reunião 18:30, preenche uma
hora de duração. Sem sufixo, usa o horário escolhido. Datas não são inferidas.
Detalhes recebe título/data/horário sem salvar nem pedir descarte. A confirmação
rápida reaproveita o mesmo fluxo guardado de persistência e regulamentos.

Refino local de 28/10: texto da barra sem retângulo interno de hover ou escala;
o + mantém o feedback circular. Editor rápido preserva os 360px máximos, raio de
24px e fundo da barra fechada. Durante a importação, a barra fica visível e
temporariamente sem ações, evitando abrir dois editores. Hover do texto/+, abertura
e fechamento conferidos no localhost em 1036×704; 31 testes focados, tipos e diff
aprovados. Evidência privada em .tmp/agenda-hover-20261028/. Sem alteração de dados
ou publicação; não houve nova inspeção física Samsung nesta rodada.

A alça consome o clique residual de um arrasto para não reabrir o mês ao soltar.
No browser móvel 390x844, recolhimento e expansão por arrasto preservaram a data;
rolagem até a última aula manteve a barra na mesma posição (y=669 CSS px neste
viewport). Transferência da criação rápida do dia 27 para detalhes conferida sem
mutação real. Referências e evidências em .tmp/calendar-samsung/ e
.tmp/agenda-samsung-v2/, privadas e ignoradas. Teclado/gestos do Samsung foram
observados no aparelho; esta rodada do Go Atleta foi testada no navegador local,
não em novo APK nativo. Sem commit/push/deploy desta continuação.

Fechamento desta continuação: 77 testes aprovados, tipos, lint, higiene de
performance e org-scope aprovados; exportação web final concluída. Regra de retry
carrega o ID parcial também ao passar da criação rápida para os detalhes.

## Ajuste de densidade e pesquisa em 26/10

A coluna no desktop tem no máximo 440 px incluindo margens internas; os dias usam pontos
coloridos, sem barras ou preenchimento retangular. O topo oferece pesquisa do
mês e um calendário com o número de hoje. A pesquisa filtra somente os dados
já autorizados do mês/unidade, mostra as datas e conserva o destino das aulas.
No modo atleta continua restrita aos treinos vinculados, sem consulta de staff.

Validação deste ajuste: 30 testes focados, tipos, lint e org-scope aprovados.
Localhost conferido em 1063 e 390 px: mês/semana, pontos, pesquisa com e sem
resultado e retorno ao dia atual. Sem salvar eventos reais ou publicar.

## Revisão detalhada pelo ADB e proporções

Referência inspecionada em 26/10 no SM-S931B (1080×2340, densidade 420):
mês expandido, seletor de mês/ano, criação rápida, editor completo e
pesquisa. Nenhuma gravação no aparelho; retorno ao calendário após inspeção.
Capturas e hierarquias ficam ignoradas em .tmp/agenda-samsung-review/.

| Padrão observado | Adaptação no Go Atleta |
| --- | --- |
| Topo único com mês, pesquisa e hoje | Celular sem breadcrumb duplicado; mês 22px e ações 40px. Filtro e navegação na mesma linha discreta. |
| Salto direto de mês/ano | Picker 4×3 com ano selecionável, confirma apenas o mês; dia 31 é limitado ao último dia válido. Cancelar não altera a data. |
| Agenda compacta e cor por compromisso | Coluna 440px, linhas com horário e título limitado a uma linha, cor existente e pontos no grid. |
| Adição curta no rodapé | Barra 48px, largura 360px; editor rápido menor com sugestões e confirmação 44px. Rodapé continua fora do gesto/rolagem. |
| Pesquisa e detalhes progressivos | Busca no mês/unidade autorizados; rascunho rápido sobrevive à busca e passa aos detalhes sem salvar. |

Em 390px, o filtro passou de y=121 para y=54: 67px recuperados no topo. A barra
fechada passou de 56 para 48px. O grid conserva alvos 40–46px, em vez de encolher
os dias para compensar o cabeçalho. São medidas locais de layout, sem benchmark
de desempenho ou alegar reprodução de curvas proprietárias.

Recorrência de eventos, convidados, alertas externos, stickers e ditado
continuam fora deste ajuste; não foram criados controles sem suporte
de persistência/entrega. Turmas conservam sua recorrência já existente.

Nesta revisão, 44 testes em cinco suítes passaram (incluindo os 22 do picker/
carregamento reexecutados após a guarda de rascunho). Tipos, lint, org-scope e
higiene da tela aprovados. Browser em 320, 390, 834 e 1440px: sem overflow horizontal,
seleção de setembro/Hoje, unidade longa, busca com rascunho, passagem para
detalhes e descarte, arrasto contínuo e barra fixa.

## Scroll e atualização discreta

O texto solto de carregamento foi substituído por um indicador de 12px no espaço
reservado ao lado do ano. A agenda permanece visível sem deslocar o grid.
O botão de dobra saiu da linha de navegação. Roda/trackpad sobre grid ou
lista dobram o mês também no desktop; a lista só volta a expandir o mês
quando está no topo. O listener web cancela apenas a rolagem usada na dobra,
sem dupla movimentação; rodapé permanece fora dele. Zoom e gesto horizontal
não são consumidos. Enter/Espaço com foco na grade alternam mês/semana.

Validação desta correção: 35 testes focados (10 de gestos/listener e 25 de
calendário/carregamento/atleta), tipos, lint e higiene da tela aprovados. No
localhost, desktop confirmou 60px de dobra para 60px de scroll, lista parada
no cruzamento e rolagem seguinte normal; reversão aguardou o topo. Versão
móvel 390px conferida também após reload, sem avisos de listener passivo.
Enter na grade e indicador de atualização natural ao mudar para setembro
conferidos; captura privada scroll-clean-desktop.png. Sem publicação.

## Continuidade visual no fim da dobra

A web alternava componentes por calendarCollapsed/interacting. Isso desmontava o
mês ao encaixar e recriava um paginador inicialmente sem largura/offset alinhado.
Agora CalendarFold mantém as duas representações no mesmo viewport durante
início, encaixe e reversão. A opacidade usa o mesmo progresso; a semana só
aparece após medir/alinhar o paginador em useLayoutEffect. Até lá, o mês
traduzido mostra a semana selecionada. A camada inativa não recebe foco,
ponteiro ou leitura assistiva. O adaptador nativo preserva a composição existente.

Teste de regressão confere identidade de month/week/pager/ScrollView em expansão,
parada e inversão, incluindo fallback antes do primeiro layout. Foram 42 testes
focados aprovados em seis suítes (25 de tela/atleta e 17 de viewport/paginador/
gestos), tipos, lint e higiene da tela. No localhost 1063×704, ciclos repetidos
mantiveram mês e paginador presentes e a semana 26 visível nos encaixes. Em 390px,
rolagem horizontal levou de 26 para 19 e Hoje restaurou 26. Capturas privadas de
viewport inteiro em .tmp/agenda-flick/after/. A captura recortada de diagnóstico
foi descartada da evidência de proporções por alterar temporariamente o viewport.
Não é benchmark de FPS nem nova validação do APK. Sem publicação.

## Stress de scroll lento, rápido e reversões

A sequência lenta revelou encaixe antecipado entre pequenos deltas. O idle do
wheel passou de 140 para 350ms; a curva/duração de 180ms e movimento reduzido foram
preservados. O adapter controla o settle sem segundo timing do efeito-base.
Novo gesto invalida timers/conclusões antigas; atingir o limite atualiza o estado
imediatamente, permitindo a rolagem seguinte sem aguardar o idle. O paginador
horizontal conserva seu debounce de 140ms.

No localhost 1063×704, após a correção:

- Dois ciclos lentos completos: 64 amostras, deltas de 12px, nenhum retorno contrário
  ao sentido do input nas sequências registradas.
- Oito ciclos rápidos, mantendo extremos de 63,5/247,5px e data 26 de outubro.
- Vinte movimentos alternados intermediários: posição acompanha cada delta,
  opacidades somam 1 e data preservada.
- Em 390×844, três fases no mesmo arrasto (expandir/recolher/expandir); segurar
  no meio por 500ms manteve a altura de 187,5px antes de retomar.

Registros privados em .tmp/agenda-motion-stress/. O ensaio browser de wheel
seguido de pointerdown antes do idle foi inconclusivo por latência do driver e
coordenada da alça mudando; sua guarda foi verificada com clock controlado nos
testes, sem considerar essa captura como prova de sucesso. São medidas locais
de posição e comportamento, sem comparação de FPS/curvas proprietárias.

21 testes em quatro suítes cobrem timer antigo durante drag, conclusão obsoleta,
um timing por encaixe, deltas pequenos espaçados 200ms, endpoint imediato e
inversões. Tipos, lint e higiene aprovados. Sem publicar ou modificar dados.

## Edição do horário rápido — 29/10/2026

Etapa anterior, substituída pelo seletor abaixo.

O horário atual deixou de ser um botão que reaplicava o próprio valor e passou
a campo editável HH:mm com a primitive TimeInput. As sugestões seguem clicáveis.
Digitação manual substitui o horário explícito anterior do título; valor incompleto
bloqueia salvar. A duração continua de uma hora, inclusive ao atravessar meia-noite.

No localhost 1036×704: digitação 2330 exibiu 23:30; detalhes receberam término às
00:30 do dia seguinte; nenhum evento real foi salvo. 19 testes focados, tipos e
diff aprovados. Evidência privada em .tmp/agenda-time-20261029/. Ajuste local.

## Seletor de horário por rolagem — 29/10/2026

Tocar no horário abre duas rodas (00–23 / 00–59), com seleção central e ações
Cancelar/Concluído. O modal usa os tokens e a primitive ModalSheet existente, com
largura máxima de 320px. A escolha permanece temporária até confirmar; fechar por
Cancelar, fundo ou Escape não altera o evento. Sugestões de horário continuam
diretas; confirmar o seletor não salva evento. Web usa encaixe CSS por linha de
44px; nativo mantém snapToInterval. Só as rodas e ações participam do Tab.

Conferência autenticada no localhost em 1036×704 e 390×844: abertura com horário
atual, rolagem curta/rápida/reversão, clique, confirmação, cancelamento e reabertura.
23:59 chegou aos detalhes com término 00:59 no dia seguinte. A sequência de Tab
passou por Horas → Minutos → Cancelar → Concluído. 23 testes focados em três suítes,
tipos, lint e diff aprovados. Capturas privadas em .tmp/agenda-time-picker-20261029/.
Nenhum evento real salvo; sem publicação. ADB sem aparelho nesta rodada; o seletor
é uma adaptação visual por rodas, sem nova comprovação de paridade física Samsung.

## Recarregamento sem cena vazia clara — 29/10/2026

MemberPermissionBoundary passa a mostrar FullscreenLoadingState enquanto restaura
organização/permissões ou aguarda redirecionamento negado. Os filhos permanecem
ocultos até a autorização, com URL e regras de acesso preservadas. As abas de
professor/coordenação usam sceneStyle com o fundo do tema; antes, o retorno null
do guard podia expor a cor clara padrão do navegador interno. O boot global
continua sem bloquear a montagem da navegação.

O branco persistente não apareceu na primeira reprodução; o caminho vazio foi
identificado no código. Após a correção, três recarregamentos autenticados no
localhost exibiram carregamento escuro e voltaram a /prof/calendar sem erro no
console. Capturas privadas em .tmp/agenda-reload-20261029/. 21 testes focados em
cinco suítes, tipos, lint, org-scope e diff aprovados. Sem publicação.

## Editor e referência física atualizados — 29/10/2026

Nova observação pelo ADB do SM-S931B, com Samsung Calendar 12.8.01.0, orienta
o refinamento desta etapa. Capturas e vídeos privados ficam em
.tmp/agenda-samsung-20261029/. A inspeção anterior sem aparelho descrita acima
continua sendo o registro daquela rodada; a nova referência está
[documentada separadamente](AGENDA_SAMSUNG_REFERENCIA_2026-10-29.md).

A criação rápida anima a expansão/retração no mesmo rodapé, preservando título,
sugestões e passagem aos detalhes. O seletor rápido tem duas rodas circulares,
três linhas visíveis e todos os minutos; a escolha é temporária até Concluído.
Fechar ou cancelar não aplica a escolha nem salva o evento. No editor completo,
horários e calendário se expandem inline; abrir um fecha o outro. Rodas fechando
ficam desabilitadas e trocar Início/Fim troca sua identidade, cancelando trabalho
do alvo anterior. Movimento reduzido conserva os valores sem esperar animações.

O modal completo usa linhas agrupadas, ícones e período de início/fim, mantendo
local, categoria, esporte, descrição e vínculos de turmas. O rodapé oferece
Cancelar/Salvar; salvar continua explícito e desabilitado para rascunho
inválido. Alterar data ou horário inicial desloca o término mantendo a duração,
inclusive ao atravessar meia-noite; Dia todo preserva o intervalo de dias.
DatePickerModal recebe inline opcional, com o modo modal padrão preservado.

Na etapa inicial, ModalSheet permanecia montado na saída de 180ms (substituída
pelo perfil lateral descrito abaixo); onExited avisa ao concluir, sem timer paralelo, ou fecha
imediatamente com movimento reduzido.
O limite numérico de altura max(160, height - 64) pertence somente ao editor e
mantém cabeçalho/rodapé dentro do viewport móvel; não é uma correção geral de
ModalSheet. Permanecem as guardas de sessão, instituição, permissão, foco,
rascunho, descarte, regulamento e retry do mesmo ID após falha de vínculo.

Validação local final: 86 testes focados em sete suítes, tipos, lint e higiene
strict aprovados. Smoke autenticado conferiu 390×844, 834×1194 e 1440×1024,
seletores, duração, categoria/esporte e descarte sem salvar evento real. Hovers
dos quatro controles foram medidos iguais: fonte 16px, pílula 32px, alvo 44px,
sem escala. Rodapé 200×50px, modal até 440px e margem móvel de 12px. Data com
ano diferente usa DD/MM/AAAA para não cortar o ano. Na dobra web, 32 entradas
lentas preservaram a direção; oito ciclos rápidos e vinte inversões conservaram
mês/paginador montados e a data selecionada. A conferência se restringe ao localhost. A referência física Samsung não comprova o
comportamento de um novo APK do Go Atleta, equivalência de curvas ou benchmark
de desempenho. Pontos e precisão de um minuto são adaptações deliberadas.
Esta rodada não inclui publicação.

## Interruptor Dia todo — 29/10/2026

O interruptor usa a composição compacta já existente nas telas de turma: trilho
38×22px, círculo interno de 18px e alvo de toque de 44px. O deslocamento de 16px
anima por 160ms, com interrupção e movimento reduzido. Mantém estado acessível,
clique, Espaço e Enter; durante gravação fica desabilitado. Ativar fecha os
seletores e oculta as horas; desativar preserva os horários do rascunho.

Vinte testes do editor e tipos passaram. Clique/teclado e ambos os estados foram
conferidos no localhost, sem salvar evento. Capturas privadas em
.tmp/agenda-all-day-switch-20261029/. Ajuste local, sem publicação.

## Movimento do editor refinado por vídeo — 29/10/2026

Nova comparação via ADB do Samsung Calendar 12.8.01.0 no SM-S931B mostrou
entrada e saída laterais, com superfície opaca. O Go Atleta aplica esse perfil
somente ao editor de eventos: entrada pela direita em 260ms e saída em 240ms,
com desaceleração cúbica. Os tempos são aproximações da observação, sem extração
ou equivalência demonstrada de curvas proprietárias.

`ModalSheet transition="calendar"` conserva o progresso em interrupções e a
barreira de interação até terminar a saída; `onExited` permanece o único aviso
de conclusão. Movimento reduzido elimina a espera. O perfil padrão dos demais
modais permanece igual. O editor mantém altura `min(max(160, height - 64), 704)`
enquanto edita: cabeçalho e rodapé não se recentralizam ao expandir seletores.
O formulário continua rolável e o detalhe somente leitura mantém altura natural.

Data e hora usam uma única área de expansão. A altura medida anima a partir da
altura visível, inclusive ao trocar o seletor ou sua visualização; a linha de
hora recolhe ao ativar Dia todo. Fechar a data conserva o mês explorado durante
a saída. A área fechando fica inerte no web e oculta da acessibilidade, e callbacks
antigos não aplicam seleção nem desmontam uma reabertura.

Validação desta rodada: 49 testes focados em três suítes, tipos, lint e higiene
strict; smoke autenticado no localhost em viewport padrão desktop e 390×844.
Amostras DOM registraram o card opaco, posição/altura constantes durante trocas
rápidas entre data/hora e Dia todo; Cancelar por Enter durante a entrada inverteu
o movimento sem reiniciá-lo. A data conservou Novembro durante o recolhimento,
com `inert` ativo. Vídeos e amostras privados em
`.tmp/agenda-modal-motion-20261029/`, incluindo `samsung-modal-nav-clean.mp4`,
`samsung-selectors.mp4`, `samsung-all-day-motion.mp4` e
`localhost-modal-final.mp4`. Nenhum evento real salvo e nenhuma publicação.

O primeiro vídeo de navegação Samsung não valida os cancelamentos: a abertura
do teclado deslocou o alvo. A repetição limpa orienta a comparação. Tentativas
iniciais de cancelar o Go Atleta por coordenadas móveis também não contam como
interrupção; a sequência validada usa Enter em Cancelar. Escape com foco no
TextInput não chega ao listener do documento porque o React Native Web interrompe
a propagação; esse limite anterior foi registrado, sem alterar atalhos globais.
A referência física e o smoke web não validam um novo APK do Go Atleta nem FPS.

## Anotações e anexos ativados — 29/10/2026

Anotações cresce/recolhe como uma linha sem caixa; o rascunho description e suas
proteções permanecem. Anexos aceita imagens, PDF e documentos privados da
instituição, com até 10 arquivos/20 MiB cada, seleção múltipla, retry estável e
progresso real por arquivo. Adicionar azul, remoção vermelha, miniatura de imagens
e tiles de formato mantêm a fonte do Go Atleta. Scrollbar opt-in de 4px e hovers leves
foram conferidos sem alteração de largura ao abrir dropdown.

A migration 20261029144812 foi aplicada no Supabase com autorização explícita.
103 testes focados/7 suítes, tipos/lint/org-scope/higiene e SQL isolado passaram.
O smoke real pelo localhost salvou/baixou/removeu PNG/PDF/DOCX; bytes conferidos,
miniatura privada carregada e notas preservadas. A limpeza removeu arquivos e
evento temporários; dois eventos anteriores permaneceram. Cliente local, sem
commit/push/deploy web. [Registro completo](AGENDA_ANOTACOES_ANEXOS_2026-10-29.md).

## Detalhe compartilhado de aulas e eventos — 29/10/2026

`CalendarEntryDetails` reúne a apresentação de leitura da Agenda: título,
período, linhas com ícones e ações do chamador. Ao tocar uma aula no calendário
professor/coordenação, `CalendarClassDetails` mostra essa composição com os dados
já carregados da turma e da ocorrência selecionada. Data, horário, unidade,
local, faixa etária, nível e esporte aparecem conforme disponibilidade; abrir o
detalhe não cria um registro de evento nem busca a turma novamente.

A ação **Ir para a turma** aguarda a saída animada e navega com a origem
permitida, a data da ocorrência e o filtro de unidade, incluindo a chave de
retorno quando disponível. A seleção pertence ao escopo de leitura da
instituição; troca de contexto ou alvo obsoleto impede a navegação antiga.
Fechar o detalhe mantém a Agenda. No modo estudante, o toque continua abrindo
`/student-plan` com turma/data, sem esse detalhe de gestão.

A leitura de eventos usa a mesma primitiva, preservando as ações existentes de
Editar/Excluir e suas permissões. Anotações, vínculos e anexos continuam nos
fluxos próprios; esta composição de leitura não muda suas gravações ou acesso.
O detalhe segue `ModalSheet transition="calendar"`, com saída concluída por
`onExited` e respeito ao movimento reduzido. A tipografia permanece a do Go Atleta.

A referência física é o detalhe de evento salvo da Samsung, observado pelo ADB;
o vídeo privado de abertura de seis segundos fica em
`.tmp/agenda-event-detail-20261029/samsung-open.mp4`. Essa observação não demonstra
igualdade de curvas proprietárias nem valida um novo APK do Go Atleta.
**Validação desta etapa:** 83 testes focados em seis suítes aprovados, tipos
nos checkouts de edição e execução, lint e escopo/higiene strict. O primeiro
teste do editor excedeu 5s durante a rodada combinada; a repetição isolada
aprovou os 28 testes sem alterar timeout. No localhost autenticado, a aula
Primeiros Saques abriu o detalhe sem navegar; Ir para a turma e o retorno
preservaram 29/10 e os filtros Todas/Rede Esperança. Fechar manteve a agenda;
390×844 e o desktop foram inspecionados, incluindo três fechamentos/reaberturas
(dois por Enter durante a entrada). Um clique automático no botão em movimento
não concluiu e não conta como ciclo válido. A guia anterior ainda usava o bundle
antigo; a rodada válida ocorreu após recarga. O detalhe de evento usa o mesmo
conteúdo; metadados/ações/permissões de evento foram cobertos pelos testes do
editor. Não houve criação, edição ou exclusão de evento real nesta etapa.
Capturas e ciclos: `.tmp/agenda-event-detail-20261029/`.
Sem publicação desta alteração.

## Paridade estrutural da ficha — revisão de 29/10/2026

A nova inspeção física do Samsung Calendar 12.8.01.0, por ADB, confirmou que
Voltar fica acima do cartão sólido e a barra de ações fica abaixo dele. A leitura
agora usa essa composição: título 20px normal, datas com dia da semana em 14px,
horas em 16px, linhas compactas com ícones e separadores contínuos. A família de
fonte continua a do Go Atleta. O formulário de edição mantém sua apresentação.
O shell da leitura neutraliza somente localmente o degradê/desfoque, borda,
sombra e padding herdados de ModalSheet; não altera os demais modais.

No celular, o fundo opaco evita sobrepor a agenda à ficha. O cartão rola por
dentro e a barra de ações permanece fora dele. A altura desconta as safe areas;
os testes incluem 47/34px em 844px. A ficha de aula reutiliza o mesmo CSS fino
de rolagem do editor, via useCalendarEditorScrollbars. Não foram acrescentadas
ações Samsung sem contrato correspondente no produto.

O smoke encontrou e corrigiu uma divergência do CTA: calendarDate só preservava
o retorno e a turma podia mostrar a próxima aula. Ir para a turma também envia
agora `date` com a ocorrência exibida, mantendo calendarDate/unidade/origem.
64 testes focados em quatro suítes, tipos, lint, org-scope e higiene strict
aprovados nesta revisão. Conferência autenticada no localhost em 390×844,
834×1194 e 1440×1024; com 390×420, rolagem interna alcançou os dados inferiores
mantendo a ação fixa. Capturas/vídeo Samsung ficam privados em
`.tmp/agenda-detail-parity-20261029/`. Não houve escrita de evento real,
publicação ou validação de um novo APK. O vídeo confirma a referência de entrada
lateral; não mede FPS nem certifica igualdade das curvas dos aplicativos.

## Campos editáveis e cinco ações — rodada local de 29/10/2026

A ficha mantém a fonte do Go Atleta e a composição compacta da leitura. Título,
datas, horários e linhas só viram controles quando o chamador fornece uma ação
autorizada; tocar um campo de evento abre o editor existente no campo ou seletor
correspondente. O valor continua no rascunho até Salvar. Leitores sem gestão não
recebem controles de edição. Cor sem contrato de gravação continua informativa.

A barra usa Duplicar, Editar, Compartilhar, Excluir e Mais conforme o papel e o
recurso. As ações têm alvos de toque preservados e rótulos completos. Mais abre
um menu real: foco inicial no primeiro item habilitado, setas/Home/End, Escape
com retorno ao botão e invalidação de medições/fechamentos de aberturas antigas.

- **Duplicar evento** prepara uma instância nova do editor, sem ID do evento,
  retry/resumeId ou IDs/intentos de anexos. Conserva a configuração e os vínculos
  autorizados; não grava ao abrir. Havendo anexos ou falha na leitura deles,
  confirma explicitamente que os arquivos ficam no original. Salvar continua
  obrigatório. Duplicar aula cria apenas um rascunho de evento vinculado à turma
  na ocorrência selecionada; não copia a turma/série nem seus dados operacionais.
- **Editar evento pelo campo** reutiliza foco/seletores do formulário real,
  preservando baseline, intervalo e proteção de descarte. **Editar aula** confirma
  que a alteração alcança a turma e seus horários recorrentes, então abre a seção
  existente de configurações. Não oferece remarcação fictícia de uma ocorrência.
- **Excluir evento** conserva a confirmação e o fluxo de exclusão existentes.
  Na ficha de aula, **Excluir** confirma e cancela somente a data selecionada
  por uma exceção `no_training`, sem excluir turma, planos ou chamadas. Uma pausa
  já existente não é sobrescrita; a Agenda atualiza as pausas após sucesso.
- **Compartilhar** envia o resumo da ocorrência. **Mais** oferece Copiar
  informações e Exportar .ics; na aula também conserva Ir para a turma e a
  edição da série quando autorizada. O ICS representa um único compromisso,
  sem `RRULE`, anexos ou links privados/assinados. Cancelar o compartilhamento
  não vira erro de salvamento.

Callbacks e continuações assíncronas conservam organização, identidade/geração
da sessão, foco e seleção atual. A saída concluída por `onExited` precede
navegação e abertura da cópia; permissão nova não reaproveita confirmação antiga.
O modo estudante mantém sua entrada própria no plano.

A inspeção ADB desta rodada confirmou que tocar o título na Samsung abre
`EditActivity` com cursor e tocar o horário abre o editor completo com rodas.
A inspeção foi descartada sem salvar dados no Samsung. Capturas privadas:
`.tmp/agenda-details-actions-20261029/`. Isso orienta a interação; não comprova
igualdade exata, desempenho ou publicação.

**Evidência local recebida dos agentes:** 11 testes da primitiva compartilhada;
blocos de classe de 86 testes/6 suítes e 12 testes/3 suítes, com sobreposição,
além de tipos/lint/escopo nos respectivos pacotes. Não somar esses blocos.
No localhost, o menu abriu, fechou por Escape e reabriu; Duplicar abriu um novo
rascunho com título/data/turma e rodas, descartado sem salvar. Tocar o horário
abriu a seção de agenda; o perfil abriu a seção correspondente na mesma turma
retida. A ficha compacta foi inspecionada no desktop e no celular. O .ics baixado
foi conferido com um VEVENT para 29/10, 14:00–15:00, sem RRULE.
Copiar informações foi acionado sem erro, mas a leitura do clipboard não
confirmou conteúdo; essa capacidade não foi atestada pelo smoke.
Não houve teste de exclusão/cancelamento, salvamento ou compartilhamento externo
com dados reais nesta rodada. Testes com dependências simuladas não atestam
gravações reais, RLS remoto ou produção.
Sem commit, push ou deploy desta alteração.

Fontes: [apresentação e menu](../../src/screens/calendar/CalendarEntryDetails.tsx),
[editor de evento](../../src/screens/calendar/CalendarEventEditor.tsx),
[ocorrência de aula](../../src/screens/calendar/CalendarClassDetails.tsx),
[rascunho](../../src/screens/calendar/application/event-draft.ts) e
[resumo/ICS](../../src/screens/calendar/application/share-calendar-entry-content.ts).

## Densidade responsiva dos elementos — 29/10/2026

O refino passa a tratar a proporção interna da composição: fontes, ícones,
controles, gaps, ficha e navegação usam o preset opt-in `compactUiMetrics` de
`src/theme/tokens.ts`, conforme a [regra de produto](DESIGN_SYSTEM.md#escala-operacional-compacta).
O corpo operacional usa 12/18, metadados 11/16 e títulos 16/22. A escala base de
14 px e os contratos de autenticação permanecem; a fonte do Go Atleta e os alvos
de toque são preservados. Não há zoom global, alteração de canvas da Quadra
Visual ou migração automática das telas legadas.

A Agenda usa a capacidade mobile compartilhada de 768 px, coerente com a
navegação. A ficha organiza datas/horários sem ampliar seus controles; o relógio
mantém alvo de 44 px. A navegação compacta tem 56 px de altura, ação central de
44 px e largura máxima de 440 px. Anexos acompanham a escala: texto de 12 px,
ícone de 16, linha de 44 e prévia de 32, sem mudança de persistência.

Conferência autenticada no `localhost:8081`, com imagens privadas em
`.tmp/responsive-density-20261029/`:

| Viewport | Evidência observada |
| --- | --- |
| 633×704 | Navegação 440×56, ação central 44; cartão de leitura 400×282, com alvo de relógio de 44. |
| 390×844 | Ficha com 366 px, sem overflow horizontal; navegação 358×56, ação central 44 e menu de ações abriu/fechou. |
| 834 e 1440 px | Sidebar disponível e navegação inferior ausente; Agenda compacta sem crescimento dos elementos. Em 1440, editor e rodas abriram e fecharam sem salvar. |

Passaram 82 testes focados em cinco suítes da ficha, carregamento da Agenda,
navegação e resolvers responsivos. Separadamente, passaram 42 testes do editor
e oito de anexos; os blocos não devem ser somados aos registros de rodadas
anteriores ou tratados como uma suíte completa. Tipos nas duas raízes, lint,
perf-hygiene strict e diff-check passaram.

Uma falha transitória de módulo no Metro durante HMR deixou de ocorrer após
recarregamento completo, que foi a base da conferência final. Não houve nova
gravação de dados de evento, alteração remota ou publicação nesta rodada. A evidência
se limita à composição exercitada, sem certificar produção ou uniformidade de
todo o aplicativo.
