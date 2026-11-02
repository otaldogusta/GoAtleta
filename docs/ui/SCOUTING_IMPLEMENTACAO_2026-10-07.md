# Scouting — implementação e ativação do banco

Aplicação autorizada do [mockup](SCOUTING_MOCKUP_2026-10-06.md), iniciada em
06/10 e validada em 07/10/2026. **Migration aplicada no Supabase em 07/10, após
autorização explícita. Pacote validado para revisão e prévia; produção pendente.**

## Experiência

- Treinos e Jogos com o mesmo destaque. Continuação da análise em andamento,
  histórico paginado, busca por título/adversário, filtros de ano/mês e contexto.
- Leitura de um fundamento por vez, distribuição, critérios e denominadores.
  Somente análises concluídas carregadas entram no recorte. Contextos diferentes
  pedem filtro antes de comparar. Ausência de observação não vira erro.
- Jogo: escolha de atleta/equipe, fundamento e resultado; contatos em sequência,
  edição/remoção, zona e fase opcionais. Fechamento atribui o ponto explicitamente.
  Placar e botões permanecem visíveis durante a rolagem.
- Reabrir o último ponto do set recupera contatos, placar anterior, saque e
  posição do levantador. R1→R6 quando recupera o saque; rodízio desconhecido fica
  desconhecido. Formatos diferentes de 6×6 não recebem rodízio presumido.
- Treino: resultado registra uma repetição. Desfazer remove a última observação.
- Set e placar iniciais são explícitos; próximo set é manual, sem impor regra de
  25 pontos a atividades adaptadas. Sessões concluídas ficam em consulta.
- Sugestão de próximo fundamento é determinística e substituível. Não há modelo
  de IA executando, vídeo, súmula oficial ou atribuição automática de atleta.

## Implementação e dados

Rotas finas usam `src/screens/scouting/ScoutingScreen.tsx`, `ScoutingCollector.tsx`
e `use-scouting-collection.ts`. Primitives: `ModalSheet`, `Pressable`, `Button`,
`DateInput`, tema e ícones existentes. Foco web contido no modal, Escape e retorno
ao acionador quando ainda existe; se a conclusão remover esse acionador, retorno
à aba de visão geral/histórico.

`src/db/scouting-collection.ts` usa RPCs com organização explícita e identidade
capturada. A visão geral carrega 50 sessões por página e contagens agregadas,
evitando baixar contatos de todas as análises. Histórico anterior fica acessível
com **Carregar análises anteriores**; filtros/indicadores descrevem o recorte carregado.

[Migration aditiva](../../supabase/migrations/20261007112922_scouting_rallies.sql):

- Sessões recebem formato opcional, revisão e estado do jogo. Ações recebem
  vínculo ao ponto, ordem, zona e versão da rubrica. Nenhum backfill inventa
  contatos, atletas, contexto, placar ou rodízio de registros antigos.
- O preflight remoto encontrou `rally_id` e `zone` textuais anteriores ao contrato
  local. A nova coleta usa `rally_event_id` e `capture_zone`, sem reinterpretar os
  campos antigos. Guardas executam depois dos triggers de compatibilidade existentes.
- `scouting_rallies` guarda pontos e contatos, com RLS de leitura. Reabertura
  anula o ponto, remove suas ações ativas e restaura o rascunho na sessão.
- `apply_scouting_command` verifica organização/turma/equipe autorizada e vínculo
  do atleta; bloqueia sessão para serializar comandos, exige revisão e recibo de
  idempotência. Placar, ações e contagens legadas são gravados na mesma transação.
- Recibos privados guardam hash do comando, sem duplicar nomes/contatos no recibo.
  Não há escrita direta de cliente nas novas tabelas. Funções auxiliares não são
  executáveis pelo cliente. Campos de autoria não impedem remoção da conta.
- Guardas preservam ações avulsas legadas, mas bloqueiam alteração direta de
  pontos vinculados/placar, mudança de contexto após coleta e edição de concluídos.
- Rubrica v2 distingue ataque bloqueado que encerrou o ponto (`bloqueio_ponto`,
  nível 0) de continuidade. `bloqueado` antigo não é reinterpretado nem incluído
  silenciosamente como erro na eficiência de ataque.

Rascunhos locais incluem usuário, organização e sessão na chave. O recibo é
persistido **antes** da requisição. Toques repetidos são bloqueados; falha ou
resposta perdida conserva o mesmo comando para confirmação idempotente.
Conflitos de revisão exigem conferir o placar atual, preservando os contatos.
Não há promessa de sincronização automática offline: o professor confirma o reenvio.

## Validação inicial, antes da ativação

Nível 3 da [escada](../operations/validation-ladder.md):

- 22 testes Jest em cinco suítes: domínio, compatibilidade, adaptação de API e
  hook de coleta. Incluem toque duplo, envio incerto, falha de storage antes/depois
  do servidor, conflito de revisão, recuperação do rascunho e mudança de identidade.
- `scripts/validation/scouting-rallies-sql.mjs`: PostgreSQL PGlite isolado, com
  migrations e funções de permissão reais e identidades sintéticas. Verifica
  rollback, replay, acesso negado, atleta de outra organização, escopo divergente,
  reabertura, imutabilidade, agregados, contagens legadas e exclusão em cascata.
- `typecheck:app`, `check:org-scope` e `check:perf-hygiene` passaram. Diff conferido.
- No app autenticado em localhost:8081: leitura real do histórico e estado de
  atualização pendente. Supabase configurado é remoto; nenhuma escrita de QA foi
  enviada a ele.
- Em aba separada no mesmo localhost, RPCs do scouting interceptadas com fixtures:
  12–10→13–10→reabrir12–10, três contatos recuperados, correção de recepção, resposta
  perdida/reenvio com mesmo ID mantendo um ponto; treino 0→1→0 e conclusão.
  Desktop e 390×844 no tema escuro; foco contido por Shift+Tab, Escape, sem overflow
  horizontal. Essa simulação exercita UI/adaptador; não certifica PostgREST remoto.

## Ativação remota — 07/10/2026

Nível 4 da escada, autorizado pelo usuário ao continuar a aplicação da migration:

- Destino conferido com a configuração local: projeto `hgmdpetpwclucvquoklv`.
  Migration `scouting_rallies`, versão **20261007112922**, aplicada com sucesso.
  Arquivo local renomeado para a versão registrada pelo serviço; conteúdo preservado.
- Preflight de colunas, constraints, triggers, permissões e histórico de migrations.
  Compatibilidade reproduzida sem dados pessoais em
  `scripts/validation/fixtures/scouting-hosted-compat.sql`. SQL passou tanto no
  schema limpo quanto com `node scripts/validation/scouting-rallies-sql.mjs --hosted-compat`.
- **23 testes Jest** em cinco suítes, `typecheck:app`, `check:org-scope`, diff e
  `npm run build -- --max-workers 2` passaram após o ajuste de compatibilidade.
  O build manteve avisos de resolução de exports do Expo/React DOM, sem falha.
- RPCs remotas disponíveis ao papel autenticado, indisponíveis a `anon`;
  auxiliares privados, RLS nas tabelas novas e escrita direta de cliente revogada.
- Smoke pelo app autenticado em **localhost:8081**, sem interceptar RPCs:
  criação de jogo 6×6, placar 12–10, recepção Boa na zona 5, levantamento Organizou
  e ataque Ponto. Salvar gerou 13–10, saque nosso e R6; reabrir restaurou 12–10,
  saque adversário, R1 e os três contatos. Novo fechamento e conclusão passaram.
  Tentativa de atribuir ponto contraditório ficou desabilitada na UI.
- Treino 3×3: repetição 0→1→desfazer0 e conclusão. Conferidos estado, vínculos,
  zona, revisões, contagens legadas e indicadores da análise concluída no banco/app.
- As duas sessões temporárias e seus dados dependentes foram removidos por IDs
  exatos. Contagens retornaram a 5 sessões, 3 ações e 3 logs anteriores; hashes dos
  campos preexistentes coincidiram antes da migration, após ela e após o smoke.
  Nenhum contato foi atribuído a um atleta real durante o teste.

O app local está apto a gravar a nova coleta no banco remoto. Publicação do código
do app continua separada. O fallback anterior permanece somente para leitura caso
a mesma versão do app seja executada contra um banco que ainda não tenha as RPCs.

Não foram certificados dispositivo nativo, concorrência multi-conexão no serviço
hospedado, tema claro ou uma partida em campo.

## Entrega em branch e prévia — 07/10/2026

Após autorização de commit e push, pacote separado em
`codex/scouting-rallies-release`, partindo da `main` `2fe4c659`. Destino desta etapa:
PR para revisão e deploy de prévia; merge e distribuição de produção ficam separados.

`PERF_BASE_REF=origin/main npm run build:verified` passou em 122 segundos:
562 suítes / 3.153 testes, lint sem erros/avisos, tipos, encoding, marca, JWT,
escopo, assets, arquitetura, performance estrita e export web. A suíte SQL foi
reaproveitada pelo executor por conteúdo idêntico, após aprovação das 9 suítes na
execução anterior. O CI continua executando seus próprios gates.

O gate estrito identificou a instrumentação retirada das rotas ao simplificá-las.
Marcadores foram restaurados nas rotas e nos carregamentos reais de visão geral
e detalhe, sem incluir dados pessoais nos breadcrumbs. A regressão do schema
legado entra agora no runner SQL/CI via `scouting-hosted-compat-sql.mjs`.

Smoke real de jogo/treino registrado acima reaproveitado; leitura autenticada da
tela conferida novamente após instrumentação. Alterações documentais posteriores
ao executor exigem geração do checklist e diff, sem repetir testes do runtime.

## Correção de fidelidade ao mockup — 07/10/2026

A primeira implementação preservou a coleta, mas divergiu da composição aprovada.
Esta revisão usa o mockup `scouting-2026-10-06.html?coleta=jogo` como referência
visual, sem alterar RPCs, migration, rubricas ou isolamento de organização.

- Modal de 640px, placar central com equipes identificadas e cabeçalho/rodapé fixos.
- Contatos em sequência horizontal editável, desfazer o último contato e confirmação
  do ponto no rodapé. Atletas e resultados lado a lado no desktop; resultados abaixo
  da grade no celular. Mobile usa a altura disponível para acomodar turmas maiores.
- Atleta ou “Sem atleta” é uma escolha explícita; fechar ponto fica bloqueado enquanto
  falta o resultado do contato. Treino mantém a seleção para repetições sucessivas.
- Nomes curtos são desambiguados; o nome completo permanece no rótulo acessível.
  Números de camisa fictícios do mockup não são inventados para atletas reais.
- Quadra opcional em posições 4–3–2 / 5–6–1, critérios sob demanda, fundo sólido e
  links discretos. Abas, contexto/período em dropdown e distribuição dos resultados
  recuperam a hierarquia visual da referência.

Validação visual/interativa no app autenticado em localhost, com respostas de
scouting substituídas somente na aba de QA: editar contato, registrar ponto
12–10 → 13–10, reabrir e recuperar três contatos/saque/rodízio, zona, filtros,
Tab/Shift+Tab e retorno de foco. Nenhuma gravação remota nesta revisão.
Conferidos desktop 1055×704, tablet 834×1194 e mobile 390×844 em tema escuro;
desktop 1440×1024 e mobile 390×844 em tema claro. Evidência visual privada em `.tmp/`.
Cinco testes de interação novos cobrem seleção explícita, contato pendente,
edição/desfazer, repetição de treino e próximo set sem pontos registrados. Aprovação estética final e uso em campo
continuam pendentes; esta revisão não certifica dispositivo nativo.

Release desta revisão aprovado em 138s: 563 suítes / 3.158 testes, lint sem
avisos, tipos, escopo, arquitetura, performance e export web. SQL reutilizado
pelo executor por inputs inalterados. Na tentativa anterior, um teste de
redelivery concorrente de webhook Asaas falhou ao presumir qual chamada seria
a duplicada; passou isoladamente e na repetição completa, sem mudanças nesse módulo.
Também exercitados treino registrar/desfazer/concluir, distribuição dos resultados
e início do set 2 no browser de QA. Respostas simuladas removidas e tema original
restaurado ao terminar; o app real continua conectado normalmente.

## Integração com os perfis — 08/10/2026

O usuário autorizou o fechamento na `main` pelo [PR #98](https://github.com/otaldogusta/GoAtleta/pull/98),
incluindo os dois commits de scouting e a unificação das configurações de perfil.
O [padrão de configurações](FORM_SETTINGS_PATTERNS.md) descreve esse segundo fluxo.
Checks e estado de integração são rastreáveis no PR; o deploy utiliza as filas
existentes de Vercel e EAS. Este fechamento não acrescenta novas migrations nem
certifica uso em campo, dispositivo nativo ou atualização aplicada ao aparelho.

## Elenco local por jogo — 01/11/2026

O coletor manual permite selecionar os relacionados e camisas de 0 a 99, sem
alterar o cadastro ou vínculo dos atletas. Camisas duplicadas são rejeitadas;
camisa em branco é opcional. Os botões mostram número e nome, ordenados pela
camisa. Os contatos continuam vinculados ao ID e nome real do atleta.

A preferência usa AsyncStorage por usuário, organização e sessão. Só aparece
como salva após a escrita local terminar; erros mantêm a edição. Trocar o elenco
requer concluir/cancelar o contato atual. Alterar o elenco não modifica pontos
ou contatos existentes. Sem preferência salva, o coletor mantém a lista da turma.

Esta etapa é local: não sincroniza entre aparelhos/origens nem filtra o estúdio
de vídeo. Nenhuma migration remota ou publicação. Validação focada: nove testes
do coletor/persistência, tipos e org-scope aprovados. No localhost autenticado,
os 16 foram selecionados e numerados pela interface; ao fechar e reabrir,
os 16 botões foram restaurados e os demais ocultados. Nenhum ponto foi gravado
durante essa conferência.

No mesmo ajuste local, o cabeçalho fixo mostra “Quem saca agora” junto ao
placar, com Elenco/Vídeo agrupados. O preparo do set pergunta “Quem começa
sacando?” com opções explícitas. O saque atual segue o estado salvo e muda
com os pontos; este ajuste visual não corrige um saque inicial já gravado.
Sete testes do coletor e conferência visual em 8081 aprovados.
“Desfazer ponto” fica no cabeçalho fixo, ao lado do placar, com botão contornado.
Reutiliza a reabertura existente, inclusive seus bloqueios de envio, contato em
edição e set anterior. O rodapé mostra a contagem, sem duplicar a ação.

Atalhos locais no coletor de jogos: Ctrl/Cmd+Z reabre o último ponto e
Ctrl/Cmd+Shift+Z repõe o último ponto desfeito nesta abertura do coletor.
Refazer usa o vencedor e contatos originais, apenas na revisão/set esperados
e enquanto os contatos recuperados não forem alterados. Nova confirmação ou
edição de contato invalida esse refazer. Campos de texto, repetição de tecla,
edição de elenco/preparo do set, envio pendente e conflitos não acionam atalhos.
Comandos existentes mantêm revisão/idempotência; sem migration ou publicação.
Dez testes focados (coletor e teclado) e tipos aprovados.

Próximo set fica no cabeçalho fixo, disponível sem abrir o histórico. A ação
de conclusão passou a dizer “Encerrar jogo”; ela conclui a sessão inteira,
não apenas o set. Uma sessão já concluída não pode ser reaberta pelo contrato
atual; a continuação pode ser uma nova análise, preservando a anterior.

### Lado inicial no vídeo — 01/11/2026

Informações do vídeo permite salvar “Nossa equipe no início” (perto da câmera
ou fundo da quadra), somente neste aparelho, com chave por usuário, organização,
sessão e fingerprint. Não altera contatos nem presume o lado após trocas de set.
Não participa da sincronização remota ou do compartilhamento.
Antes da adaptação abaixo, a análise pelo YouTube era limitada aos primeiros 30 minutos; rastreio ONNX
exige original com até 30 minutos. O jogo de 61min40s não está coberto integralmente
por esses fluxos. Iniciar análise gera sugestões para revisão, não pontos oficiais.

### Jogo completo e retomada por minuto — 01/11/2026

YouTube aceita até 2 horas em chamadas de até 60 segundos; o cache anterior do
serviço permanece no mesmo formato/chave. O estúdio grava as sugestões após cada
trecho no IndexedDB, com escopo de conta/organização/sessão/vídeo, e retoma somente
os trechos ausentes. Os inícios de rally são mesclados como recortes não revisados,
sem substituir pontos, contatos ou rallies revisados. Atribuição de contatos exige
revisão das trocas de lado; o lado inicial não vale para o jogo inteiro.

Tracking do original local também aceita até 2 horas, em janelas de 60 segundos
com timestamps absolutos, worker ONNX local e checkpoint confirmado por minuto.
Pausa/falha preserva os minutos concluídos; reabrir e escolher o mesmo original
permite retomar. A janela em andamento pode precisar ser repetida. O original não
é enviado ao serviço de IA. Os dois processamentos podem permanecer ativos com
o rastreio aberto no inspetor do estúdio.

A trajetória completa permanece nos checkpoints deste aparelho. O contrato remoto
continua limitado a 54.000 posições; quando necessário, sincroniza uma prévia
com menos amostras, sem apagar a íntegra local. No aparelho que possui todos os
checkpoints, o player recupera a íntegra somente quando ela corresponde exatamente
à prévia sincronizada e ao original. Outro aparelho recebe apenas a prévia.
Sem migration remota ou publicação. Isso não certifica a precisão do detector.

### Acompanhamento no estúdio — 01/11/2026

O acompanhamento do YouTube fica no inspetor lateral, sem modal nem bloqueio do
player/timeline. Mostra trecho atual, porcentagem, tempo concluído, contagens e
quatro recortes recentes que levam ao instante no player. Recolher os controles
ou trocar a aba do inspetor mantém o componente e o processamento ativos; sair
do estúdio ainda aborta o trabalho em andamento e preserva os checkpoints.

O rastreio local abre no mesmo painel. A prévia copia o último quadro do lote
inferido, marca apenas a posição candidata acima do limiar do detector e limita
a atualização visual a 5 vezes por segundo. É uma prévia provisória, não validação
de precisão nem trajetória confirmada. Quadros não são persistidos/enviados por
esse caminho. O resultado temporal filtrado e os checkpoints mantêm o contrato
anterior. O player principal continua livre para assistir e revisar recortes.

Conferência local em 1384×704: seek do recorte no YouTube e preview local avançando
com GPU; recolher análise manteve o rastreio ativo. YouTube concluiu 61min40s com
184 sugestões de inícios de rally e 909 contatos sugeridos; 185 segmentos incluem
o segmento inicial. Números de sugestões não são pontos, contatos confirmados ou
medida de precisão. Rastreio integral ainda em andamento. Testes focados de
minimização, seek, pausa/retomada e preview, tipos e perf hygiene aprovados.

### Scouting ao lado do vídeo e aba Acompanhamento — 01/11/2026

O inspetor tem três abas: Rallies, Scouting e Informações. Scouting reúne os
modos Durante o jogo e No vídeo. A revisão apresenta set, navegação por registro,
placar, contatos e associação ao instante do vídeo; a seleção das análises fica
nos ajustes. Informações reúne análise/preview e ajustes recolhidos de vídeo,
equipe e trajetória. O processamento fica montado ao trocar abas (oculto por
CSS), mantendo o trabalho ativo. Scouting carrega análises da mesma turma e
organização pelas APIs autenticadas existentes, sugere origens pelo mesmo
adversário/data e permite escolher os sets. A seleção é explícita.

As sessões oficiais são somente lidas. Um sidecar no IndexedDB, isolado por
usuário/organização/turma/sessão de revisão/fingerprint, guarda IDs de origem e
correspondências confirmadas com um instante/recorte, ou marcação Sem imagem.
Remover um vínculo não remove pontos ou contatos. Nenhum vínculo entra na
projeção pública ou na sincronização remota do documento de vídeo nesta etapa.

Scouting mostra placar, vencedor e contatos originais do ponto selecionado;
ponto sem contato permanece Somente placar registrado. Vincular aqui registra o
instante mostrado, sem reescrever o resultado. Depois de uma referência
confirmada, outra jogada do mesmo set/sessão pode sugerir um horário pelo delta
do horário de coleta, limitado a cinco minutos. É apenas navegação para revisão:
não confirma pontos, não atravessa sets e não presume continuidade após pausas
na gravação. Recortes alterados são sinalizados para conferir a correspondência.

Validação local: dez testes focados do núcleo, hook e interface aprovados, além
de tipos, org-scope e perf hygiene. No navegador 1384×704, três análises de origem
vinculadas explicitamente (117 registros), com zero correspondências temporais
inventadas. Alternância Scouting/Acompanhamento manteve o tracking na GPU e
restaurou o scroll por aba. Vínculos permanecem locais; sem deploy ou migration.

Conclusão dos recortes: troca a barra de progresso por confirmação de sucesso
com ícone, resumo e ação Revisar recortes, que abre Rallies. A confirmação é
sticky no inspetor para permanecer visível durante a rolagem. Loading, requisição
em andamento ou erro de gravação impedem exibir sucesso. O rastreio mantém status
próprio; conclusão da análise YouTube não significa conclusão do rastreio.
Sete testes focados e tipos aprovados; confirmação/CTA conferidos no localhost.

Reorganização local do inspetor em três abas: oito testes focados da revisão e
vínculos, tipos, org-scope e perf hygiene aprovados. Conferência em 1384×704 dos
modos Durante o jogo/No vídeo e Informações, com 117 registros preservados e
rastreio ativo. Nenhuma correspondência temporal foi confirmada automaticamente.

### Armazenamento medido sem interromper tracking — 01/11/2026

Medição física do IndexedDB de toda a origem localhost:8081 no IAB: 2.925.497
bytes (2,79 MiB), incluindo outros rascunhos e overhead do banco. Não isola este
jogo, cache HTTP/modelos ou RAM. Original: 26.016.203.737 bytes, sem cópia no IDB.
Snapshot externo em D:/Taça Paraná/2026/SUB19 Masculino/Backups scouting:
873.811 bytes compactados, nove arquivos, hashes e estabilidade durante cópia
conferidos. É cópia física pontual; restauração da aplicação não testada e não
inclui minutos futuros, localStorage, arquivo de vídeo ou proteção contra falha
do próprio disco de destino. Não substituir o banco em uso para testar restore.

`scripts/scouting-storage-snapshot.py` copia somente os diretórios IndexedDB da
origem localhost:8081, exclui LOCK, compara hashes antes/depois e conteúdo do ZIP,
sem abrir/gravar o banco ou controlar a aba. Fixture conferiu integridade,
escopo de origem e rejeição de destino dentro da origem. Tracking observado
ativo em 18,9%, prévia 11:39, sem reload ou alteração de runtime.

Diagnóstico de código, ainda sem benchmark/implementação: cada janela inicia e
termina um worker/modelo; a leitura faz seek por quadro. Reutilização do modelo e
leitura sequencial são candidatos a reduzir custo, exigindo comparação de
precisão e tempo. A recuperação integral lê todos os chunks para RAM; carregar
por trecho e manter índice temporal pode reduzir memória ao revisar. Não reduzir
amostragem ou descartar posições originais sem validar precisão. Proteção
contínua exige exportação lógica dos checkpoints/vínculos com restore testado e
backup fora do navegador; preview sincronizado não é backup integral do tracking.

### Backup automático e recuperação isolada — 01/11/2026

Incremento da medição anterior: helper externo ativo a cada 30 s, ZIPs por
mudança, sem recarregar o app. Recuperação física + parsers reais + roundtrip de
17 registros em IndexedDB isolado passaram (185 segmentos, três sets, 12 minutos
de tracking). Reprodução simultânea pausada; detector continua. Otimização de
worker e cópias preparada em patch isolado, com 55 testes e tipos aprovados,
**não ativada** enquanto o rastreio atual roda. Não há garantia de perda zero do
minuto em inferência ou reinício automático do helper após reboot.
[Operação, evidências e recuperação](../operations/scouting-backup-local-2026-11-01.md).

### Revisão após o rastreio — 01/11/2026

O primeiro recorte pode começar depois de zero, com precisão de milissegundos.
A edição preserva IDs, marca do ponto, contatos e tracking; sugestões anteriores
à preparação excluída não recriam recortes. Primeiro início não negativo e ordem
estrita continuam validados. A migration aditiva
`20261101234500_scouting_video_first_rally_start.sql` compatibiliza o normalizador
SQL; teste isolado aprovado e aplicação remota autorizada concluída em
02/11/2026. Preflight confirmou alteração restrita à guarda do primeiro início,
com hashes/ACLs conferidos e sem editar dados existentes. Isso não aceita
automaticamente um documento divergente do vídeo.

Scouting prioriza Assistir/Associar antes dos contatos e mostra contagem por set
com Próximo pendente; Sem imagem é resolução explícita. Informações distingue
rastreio pronto para salvar de associado ao documento, oculta prévia do detector
fora do processamento e não fixa conclusão dos recortes sobre outras tarefas.
Otimização local reutiliza worker por execução e evita cópias das posições sem
offset quando a prévia corresponde. Não altera o resultado de detecção existente.

[Evidência, backup e limites](../operations/scouting-backup-local-2026-11-01.md#ativação-local-após-a-conclusão--01112026).

### Sincronização assistida entre scouting e vídeo — 01/11/2026

O painel Scouting cruza automaticamente os registros selecionados com referências
já revisadas, recortes, horários e contatos observados nos checkpoints do vídeo.
O conciliador permite lacunas e recortes extras, descarta relógios retrospectivos
ou descontínuos e mantém candidatos incertos separados. Horário isolado não
confirma correspondência. Fundamentos ausentes na coleta parcial não são erros.
Vínculos existentes, inclusive Sem imagem, nunca são substituídos pelo aceite.
Não altera sessões, placares, contatos oficiais, recortes ou trajetórias.

As sugestões mostram evidência e permitem Assistir/Confirmar; lote recebe apenas
maior confiança. A aplicação recalcula o relatório e rejeita propostas obsoletas.
Persistência dos vínculos compara a versão lida na mesma transação IndexedDB;
uma aba desatualizada exibe conflito e oferece recarregar. Preferências de formato
e lado ficam em chave separada, com escopo de usuário/organização/turma/vídeo.
O formato de 21 pontos, teto 23, identifica registros posteriores ao fim do set
como pendentes de revisão sem corrigi-los ou excluí-los.

Conferir trechos com vídeo é explícito: requer lado da equipe no trecho e envia
somente vídeo público, intervalo, sequência anônima de pontos/fundamentos e
referências temporais ao companion local `/align`. Não envia nomes ou IDs de
alunos. Gemini 3.1 Flash-Lite observa até 60 s com 2 FPS e thinking mínimo;
retorna início/fim e vencedor próximo/distante/desconhecido, nunca associações.
Resultados dessa passagem são sempre sugestões para conferência. Cada execução
faz no máximo oito chamadas novas, uma por janela; não repete automaticamente
falhas ou reprocessa trechos salvos. A quantidade de chamadas é limitada, não
representa teto financeiro. Cancelar/falhar preserva janelas concluídas.
Uma resposta parcialmente inválida conserva somente observações válidas, sem
ajustar tempos. Janela sem leitura confiável fica registrada para conferência
manual e permite continuar as demais; nova chamada para ela exige Reanalisar
trechos sem leitura. Erro de rede, limite do provedor ou falha de armazenamento
interrompe com progresso anterior preservado. Alterar lado remapeia observações
próximo/distante sem nova chamada; novas referências não invalidam footage salvo.

Cache `alignment-v1` do companion é separado do cache `v2` anterior e inclui
contexto/modelo/FPS. Checkpoints no navegador usam a identidade da revisão.
Só o processamento visual solicitado usa API paga; o cruzamento local não usa.
Qualidade de corte/vencedor continua experimental, sem benchmark esportivo que
comprove precisão. Fonte YouTube requer conectividade e companion local ativo.
Sem publicação, deploy, alteração de regras remotas ou promessa de sincronização
entre aparelhos para os vínculos locais.

Validação local: 104 casos focados (motor, UI, preferências, transporte, cache e
persistência), 16 casos do companion, tipos, org-scope, perf-hygiene e diff
aprovados. Smoke autenticado em localhost, 1063×735: seleção de formato/lados,
conferência real pelo Gemini, retomada de cache, sugestões e reprodução original.
No jogo revisado, os hashes do documento e das 100 referências permaneceram
idênticos (99 com vídeo + 1 sem imagem). Geradas 8 sugestões para conferência,
9 registros ainda sem correspondência; nenhuma sugestão confirmada no smoke.
Recuperação física isolada de 69 registros passou nos parsers da aplicação e
reconstruiu o mesmo relatório: 51.233 posições, 118 recortes, 9 janelas visuais
(uma sem leitura confiável), preferências e vínculos intactos. Sem roundtrip novo
no perfil ativo, medição de precisão certificada ou validação de produção.

## Modo ao vivo local — 02/11/2026

Entrada **Ao vivo** na turma, disponível somente no web de desenvolvimento em
localhost:8081. Cria uma gravação independente: não escreve nos pontos, contatos,
recortes, trajetórias ou 99 vínculos revisados do jogo anterior. O portal segue
o estúdio, com fundo inerte e foco restaurado ao sair.

Companion local com capacidades distintas para notebook e câmera, sala de duas
horas, uma câmera por sala, validação de origem/Host, limites de sinais e geração
de negociação. HTTP somente no loopback; câmera Wi-Fi em HTTPS com certificado
preparado fora do Git. Nenhuma instalação de confiança ou regra de firewall
automática. Vídeo e eventos seguem diretamente pelo WebRTC/DataChannel.

O Android grava MediaRecorder em chunks persistidos em IndexedDB. Reconectar
preserva recordingId e relógio; gravar continua sem o notebook. Falhas de espaço
ou escrita interrompem a captura e preservam trechos confirmados. Exporta vídeo
e manifesto próprio; não importa automaticamente no estúdio oficial. Mantenha
a página aberta e salve os arquivos ao terminar; a gravação não vai sozinha
para a galeria ou nuvem.

Pontos, desfazer e próximo set têm armazenamento separado por conta/org/turma.
Cada ponto usa a referência temporal do quadro recebido, com relógios calibrados;
fallback estimado fica explícito. Referências antigas ou ausência de quadros
desabilitam a marcação. Cópias no celular exigem confirmação após commit local.
Fila de ponto/desfazer e recibos também persistem no notebook; a retomada só
reenvia para o mesmo recordingId. ACK só limpa a fila depois do commit do
manifesto. Canal congestionado ou falha de envio preservam a fila para nova
tentativa, com limite de buffer de 256 KiB.

Histórico e sessão encerrada oferecem **Rever vídeo**: seleciona o MP4/WebM
exportado no celular, valida recordingId no nome e duração suficiente para os
pontos. Clique num ponto posiciona o player no tempo salvo, sem escrever nos
registros. BlobURL é liberada ao trocar/sair; conexão ao vivo continua montada.
Importação/conversão para estatísticas oficiais permanece fora deste fluxo.

Smoke no localhost com câmera sintética: transmissão entre duas abas, clique,
ponto/desfazer/set, confirmação no celular, exportação de MP4 e JSON, reabertura
da base e seek decodificado em 13,948 s. Vídeo recuperado de 12.347.323 bytes,
172,707 s e dois pontos ativos. Hashes do documento anterior (118 recortes,
51.233 posições) e das 100 referências (99 com vídeo) permaneceram idênticos.
Interrupção simulada de peer preservou a gravação; desfazer offline chegou ao
celular após reconectar, no mesmo recordingId, com recibo durável e fila vazia.
No modal de revisão, seleção do MP4 e clique no ponto abriram 13,948 s com
reprodução decodificada. Tipos, org-scope, arquitetura, perf-hygiene e export web
aprovados. Os testes focados cobrem também fila durável, armazenamento, arquivo
incompatível, duração, seek e liberação da URL local.
Isso não valida câmera física, Wi-Fi, confiança do Android, sessão longa nem
goatleta.com. [Preparação, recuperação e limites](../operations/scouting-live-local.md).

## Organização do scouting — 02/11/2026

Visão geral concentra rendimento e histórico; uma entrada Estúdio reúne coleta
embutida, revisão em vídeo e câmera local. Alternar áreas preserva ferramentas
montadas e processamento; as guardas ficam na saída real. Cabeçalho e navegação
únicos, com ajustes e sincronização recolhidos. Os contratos de gravação e as
chaves existentes permanecem intactos. [Contrato atual, mockups e evidências](SCOUTING_ESTUDIO_UNIFICADO_2026-11-02.md).

A [pesquisa comparada de seis produtos](SCOUTING_PESQUISA_COMPARADA_2026-11-02.md)
orienta a [proposta visual v2](mockups/scouting-unified-2026-11-02-v2.html), com
abas e timeline preservadas; o 5 × 1 permanece ilustrativo. Coleta v3
habilitada somente com `captureVersion: 3` do backend: desfecho de
ace/falta separado dos contatos, bola de graça fora da eficiência de ataque e
continuidade sem ponto. Migração aditiva `20261102163000_scouting_rally_outcomes.sql`
aplicada remotamente após autorização explícita, com pós-cheque de schema e
histórico preservado: 118 rallies, 159 ações e 12 sessões com contagens/hashes
iguais e zero desfechos históricos preenchidos. Sem backfill ou reescrita dos
99 vínculos revisados. 126 casos focados, SQL limpo/compatibilidade sintética,
tipos, org-scope, arquitetura e perf aprovados. QA real em 1063 × 704 e
390 × 844 sem overflow, com iframe/player/timeline e hashes dos vínculos/cortes
preservados. Nenhum ponto artificial criado; nova escrita RPC pela UI não
atestada. Frontend somente localhost, sem deploy.
[Contrato da coleta v3](SCOUTING_COLETA_V3_2026-11-02.md).

### Correção posterior de UI e reprodução — 02/11/2026

Cabeçalho fixo nas três áreas, Nova análise no cabeçalho e toolbar de vídeo
retida. Câmera compartilha grade/largura/início vertical, conexão inline,
certificado recolhido e pontos ocultos antes da sessão. Registrar navega
pontos/contatos concluídos em leitura sem vídeo; coleta ativa preservada.
Revisão do vídeo com respiro compacto e sem resultado redundante. Busca
absoluta/reprodução aguardam ready/fonte e tratam BUFFERING; avisos de sync
distinguem rejeição de divergência, com detalhes/exportação/retry sem repetição.
Suítes focadas, SQL, tipos e org-scope aprovados. QA real em 1063 × 704 e
390 × 844 confirmou cabeçalho/margens, pontos/contatos navegáveis e reprodução
avançando com imagem após Assistir lance em 01:02. Nova análise abre acima do
Estúdio e ajusta a altura ao formulário, sem criar sessão no smoke. Status
Sincronizado e hashes dos 118 recortes/99 vínculos preservados. Migração não
reescreveu registros; frontend localhost, sem deploy nem ponto artificial.
A conferência não certifica todas as falhas intermitentes do YouTube.
[Estado e limites atuais](SCOUTING_ESTUDIO_UNIFICADO_2026-11-02.md#correção-posterior-de-ui-e-reprodução--02112026).
