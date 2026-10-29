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
