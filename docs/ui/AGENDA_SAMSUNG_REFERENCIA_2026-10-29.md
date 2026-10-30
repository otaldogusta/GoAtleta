# Agenda — referência Samsung de 29/10/2026

Registro da observação física e dos contratos locais de criação/edição do
Go Atleta. Esta etapa foi validada localmente, sem publicação.

## Referência física

A inspeção ocorreu pela UI via ADB no Samsung SM-S931B conectado, com
Samsung Calendar 12.8.01.0. Foram observados mês/lista, recolhimento do calendário,
criação rápida, escolha de horário e editor completo, incluindo datas inline e
ações inferiores. A referência é visual e de interação, sem equivalência
demonstrada de implementação ou curvas proprietárias.

Capturas, hierarquias e vídeos permanecem privados e ignorados em
`.tmp/agenda-samsung-20261029/`. Entre os registros desta etapa estão
`reference-fold.mp4`, `reference-time.mp4`, quadros correspondentes,
`quick.png`, `quick-time.png`, `details.png`, `modal-current.png` e
`modal-date.png`. Não incorporar esses artefatos autenticados à documentação
versionada.

## Adaptações implementadas

| Referência observada | Contrato no Go Atleta |
| --- | --- |
| Barra inferior com criação curta e acesso aos detalhes | A mesma barra abre/fecha o editor rápido com animação de altura; título, sugestões e passagem aos detalhes permanecem no rascunho. |
| Rodas circulares compactas com seleção central | Duas rodas de três linhas, horas 00–23 e minutos 00–59. O Go Atleta permite cada minuto, em vez do passo de cinco minutos observado no Samsung. |
| Edição do horário na criação rápida | No Go Atleta, Cancelar, fundo ou Escape no seletor temporário preservam o horário anterior; Concluído aplica somente ao rascunho. O evento depende de Salvar. |
| Editor organizado em linhas, ícones e grupos | Início/fim, Dia todo e local seguem essa composição; categoria, esporte, descrição e vínculos de turmas preservam os recursos próprios do Go Atleta. |
| Datas e horários expandidos dentro do editor | Seletores inline compartilham a expansão de altura; abrir calendário fecha rodas e vice-versa. DatePickerModal usa inline opcional, mantendo o padrão modal para outros consumidores. |
| Ações principais na base do editor | Rodapé Cancelar/Salvar permanece fora da área rolável do formulário. Valores inválidos ou gravação em curso bloqueiam Salvar. |
| Identificação dos compromissos no mês | Mantêm-se os pontos coloridos pedidos para o Go Atleta, com as cores existentes de turmas e eventos. |

A criação rápida conserva a duração padrão de uma hora e reconhece somente
sufixos explícitos de horário no título. Passar aos detalhes preserva título,
data e horário sem gravar o evento. A largura máxima da barra/editor rápido é
360px; o seletor rápido usa 320px e o editor completo, 440px, respeitando a largura
disponível.

## Datas, movimento e interrupções

No editor completo, mover a data ou o horário de início preserva a duração e
desloca o término, inclusive para outro dia. Eventos Dia todo conservam o número
de dias abrangidos; a persistência mantém seu fim exclusivo. Alterar o término
continua sendo uma escolha explícita.

As rodas encaixam na linha, mantêm precisão de um minuto e se recentralizam ao
concluir o movimento circular. Trocar Início/Fim troca a identidade das rodas
para não aplicar trabalho pendente ao campo novo. Ao fechar o seletor, eventos
de rolagem/encaixe pendentes ficam bloqueados durante a saída. Preferência de
movimento reduzido preserva a seleção e elimina a espera de animação.

O editor usa o perfil lateral opt-in de ModalSheet: entrada opaca de 260ms e
saída de 240ms, com desaceleração cúbica e continuidade ao interromper.
`onExited` avisa apenas ao concluir, sem timer paralelo; movimento reduzido
fecha imediatamente. Ao editar, a altura estável `min(max(160, height - 64), 704)`
evita recentralização do cabeçalho/rodapé durante a expansão. O detalhe somente
leitura conserva altura natural, e os outros consumidores de ModalSheet mantêm
o perfil padrão. Data/hora compartilham uma área cuja altura medida anima desde
a posição atual. Fechar a data preserva o mês explorado durante a saída e torna
o conteúdo inerte; Dia todo anima o recolhimento das horas.

## Dados e acesso preservados

Criar/editar exige o nível administrativo existente. Sessão, geração de
identidade, instituição, permissão, foco e rascunho continuam sendo verificados
nas etapas assíncronas. Campos de categoria, esporte, descrição e turmas usam
as APIs existentes; regras/versionamento de torneios e confirmação de avisos
permanecem no fluxo. Rascunho alterado pede descarte; retry após falha do vínculo
de turmas reaproveita o ID já criado.

Não se adicionam recorrência de eventos, convidados, notificações externas ou
integração com a conta Samsung por semelhança visual. As capacidades próprias
de turmas e os filtros/autorização existentes permanecem.

## Evidência e limites

A referência física vem do Samsung Calendar. As conferências do Go Atleta se
restringem a `http://localhost:8081`. Foram 86 testes focados em sete suítes,
tipos, lint e higiene strict aprovados; browser autenticado em 390×844, 834×1194
e 1440×1024. Seletores, mudança de ano, duração, configuração e descarte foram
conferidos sem salvar evento real. Hovers de data/hora: fonte 16px, pílula 32px,
alvo 44px e ausência de escala. Rodapé 200×50px, margem móvel 12px. O dispositivo
observado usa densidade lógica de 420dpi e fonte 0,9; as medidas foram adaptadas
aos tokens do produto. Datas fora do ano de referência usam DD/MM/AAAA.
A dobra web passou por 32 entradas lentas, oito ciclos rápidos e vinte inversões;
as amostras válidas mantiveram mês/paginador presentes e a data 29.
O primeiro registro de ciclos rápidos foi invalidado porque havia um modal aberto
na guia em revisão; a repetição usou uma guia separada e consta em
`localhost-fold-background-valid.json` e `localhost-fold-slow-valid.json`. Arquivos locais de observação do navegador no mesmo diretório
privado não constituem validação de um novo APK do Go Atleta.

Não há benchmark de FPS, latência ou igualdade de curvas entre os aplicativos.
Esta rodada não inclui commit, push, deploy nem publicação nativa.

Fontes locais: [editor](../../src/screens/calendar/CalendarEventEditor.tsx),
[rodas](../../src/screens/calendar/CalendarTimePicker.tsx),
[expansão inline](../../src/screens/calendar/CalendarInlineTimePicker.tsx),
[rascunho e intervalos](../../src/screens/calendar/application/event-draft.ts) e
[calendário reutilizado](../../src/ui/DatePickerModal.tsx).
Ver também [agenda integrada](AGENDA_EVENTOS_INTEGRADOS.md) e
[guia do módulo](../context/modules/regulamentos-relatorios.md).


## Calibração adicional do modal em movimento

A rodada de movimento posterior aos 86 testes acima tem 49 testes focados,
tipos, lint, higiene strict e smoke desktop/390×844 próprios. Os vídeos limpos
Samsung mostram entrada/saída pela direita, opacas, e expansão inline. A duração
260/240ms no Go Atleta é uma aproximação visual, sem medição de FPS ou paridade
proprietária. Cancelar por Enter durante a entrada foi conferido no localhost,
assim como trocas rápidas data/hora, Dia todo e mês preservado na saída inerte.
Capturas/vídeos privados ficam em `.tmp/agenda-modal-motion-20261029/`.
O primeiro vídeo de navegação Samsung, afetado pelo teclado, não conta como
validação dos cancelamentos. O registro detalhado e os limites estão em
[Movimento do editor refinado por vídeo](AGENDA_EVENTOS_INTEGRADOS.md#movimento-do-editor-refinado-por-vídeo--29102026).

## Anotações e anexos

A inspeção adicional por ADB encontrou Anotações inline, inicialmente uma linha,
sem caixa preenchida, crescendo em várias linhas. Anexo abre o seletor do sistema
(Meus Arquivos/Galeria); com arquivos, mostra contador, Adicionar azul, miniatura
ou identificação do formato e remoção vermelha. O Go Atleta adapta essa composição,
preserva sua fonte e usa DocumentPicker/Storage privados existentes na arquitetura.
[Implementação, ativação e teste real](AGENDA_ANOTACOES_ANEXOS_2026-10-29.md).

## Referência do detalhe salvo e composição de leitura

A inspeção adicional pelo ADB abriu o detalhe de um evento salvo da Samsung e
registrou um vídeo de seis segundos em
`.tmp/agenda-event-detail-20261029/samsung-open.mp4`, mantido privado. A referência
orienta o título, o período e as linhas com ícones; o Go Atleta preserva sua
própria tipografia, tokens e ações autorizadas.

`CalendarEntryDetails` passa a ser a composição comum da leitura de eventos e
aulas. `CalendarClassDetails` adapta a ocorrência da turma com data, horário,
unidade, faixa etária, nível e esporte disponíveis, usando os dados já carregados
e sem criar um evento. **Ir para a turma** conclui a saída e preserva origem,
data e unidade; o modo estudante conserva a rota atual para o plano. O editor
mantém Editar/Excluir e anexos com os contratos existentes, e a troca de
instituição invalida a seleção anterior.

A ficha de aula e a ida/volta com data e unidade foram conferidas no localhost
autenticado, em desktop e 390×844; 83 testes focados aprovados. A observação
física da Samsung serve de referência, sem certificar curvas ou um novo APK.
[Contrato e estado desta etapa](AGENDA_EVENTOS_INTEGRADOS.md#detalhe-compartilhado-de-aulas-e-eventos--29102026).

A [revisão estrutural posterior](AGENDA_EVENTOS_INTEGRADOS.md#paridade-estrutural-da-ficha--revisão-de-29102026) separa Voltar/cartão/barra, reduz a hierarquia tipográfica e remove o glass apenas da leitura. Inclui safe area, scrollbar compartilhada e data explícita no CTA. A referência física foi reinspecionada; esta rodada tem 64 testes e smoke local próprios.

## Campos e ações observados nesta rodada

A nova inspeção por ADB confirmou que o título abre `EditActivity` com cursor,
enquanto o horário encaminha ao editor completo com rodas. A barra observada
reúne Duplicar, Editar, Compartilhar, Excluir e Mais. A navegação de inspeção foi
descartada e o aparelho voltou à lista, sem salvar dados no Samsung. Capturas
privadas em `.tmp/agenda-details-actions-20261029/`.

No Go Atleta, campos encaminham ao editor real e a barra mostra apenas ações
com contrato e permissão: cópia em rascunho sem IDs/anexos, edição da série de
aula confirmada e exclusão limitada à ocorrência por `no_training`. Resumo,
cópia e ICS representam uma ocorrência, sem recorrência nem links privados.
A tipografia do produto permanece; o refino compacto não pretende reproduzir
dimensões ou recursos proprietários sem adaptação.

O menu Mais tem navegação por teclado, retorno de foco e proteção contra
callbacks de aberturas antigas. Testes focados dos componentes e adaptadores
passaram. No localhost foram conferidos o menu após Escape/reabertura, a cópia
em rascunho descartada, a reentrada nas seções reais e o .ics de uma ocorrência
sem RRULE. O conteúdo do clipboard não foi confirmado. Não houve salvamento,
cancelamento/exclusão ou compartilhamento externo real nessa conferência;
o registro não certifica produção.
[Contrato e evidência](AGENDA_EVENTOS_INTEGRADOS.md#campos-editáveis-e-cinco-ações--rodada-local-de-29102026).
