# Go Atleta — teste Android de acessos e convite

## Ambiente e alcance

Teste em 08/10/2026 no Samsung Galaxy S25 (SM-S931B), por ADB, com Expo Go
57.0.9 executando este checkout e Supabase **local** em Docker. Cinco contas
sintéticas, uma organização, uma turma e um atleta; nenhuma mensagem enviada a
destinatário real. As contas foram preparadas com e-mail já verificado: este teste
não comprova cadastro por convite, entrega de e-mail, OTP ou aceite completo.

O APK `com.otaldogusta.goatleta.perf` não foi alterado. Não houve publicação de
OTA nem confirmação do runtime/produção nesse APK. Evidências locais e credenciais
descartáveis ficam em `.tmp/adb-invite-qa/`, ignorado pelo Git; não copiar o arquivo
de contas para relatórios. Base: `32695bb2`, com a correção de boot abaixo ainda local.

## Resultados iniciais observados

| Conta | Resultado no aparelho |
| --- | --- |
| Coordenação | Login, painel operacional e gestão com três membros/uma turma. Modal aceitou digitação com teclado Samsung aberto, exibiu a turma e gerou link compartilhável. Banco local confirmou papel 10, turma selecionada e convite não consumido. |
| Professor | Login direto, início e turma atribuída. Deep link para gestão redirecionou ao início do professor. |
| Estagiário | Login, turma atribuída e perfil. Gestão redirecionou ao início. Rótulo do próprio perfil/menu aparece como **Professor**, apesar do membro ter nível 5. |
| Responsável | Login direto no portal da família, atleta vinculado e agenda. Pagamentos exibiu **Financeiro restrito**, conforme capacidade da fixture. Gestão redirecionou ao início familiar. |
| Aluno | Login reconheceu atleta e solicitou completar o perfil. Inicial e turma abriram, mas o salvamento do perfil apresentou falso sucesso; novo acesso retornou à exigência de completar cadastro. Fluxo reprovado. |

Trocas entre as contas foram feitas pelo logout da interface. Nenhuma seleção
indevida de instituição/professor foi observada nesses logins já vinculados.
Isso não valida a persistência do convite durante um cadastro novo.

## Correção local e problemas encontrados

- **Corrigido localmente: boot nativo.** `browser-pending-edits.ts` verificava apenas
  a existência de `window`; React Native fornece esse objeto sem
  `addEventListener`. O import no bootstrap derrubava o aplicativo. Agora o guard
  só registra histórico quando existem APIs de navegador. Regressão cobre ambiente
  sem `window` e com `window` nativo, preservando os cenários web.
- **Pendente: falso sucesso no perfil do aluno.** Após preencher dados sintéticos,
  a interface mostrou “Alterações salvas”, mas `students.birthdate` e `phone`
  continuaram vazios. A conta consegue ler seu cadastro; a policy local de UPDATE
  exige administrador/equipe. `updateStudent` usa PATCH sem comprovar linha
  alterada. Não se adicionou permissão ampla ao aluno. A correção precisa de um
  contrato de autoedição limitado e confirmação de persistência, com teste de
  autorização. Estado remoto dessa falha não foi verificado.
- **Pendente: Voltar com teclado aberto.** No modal de convite, o botão Android
  abriu “Sair sem salvar?”. “Continuar editando” preservou os dados. A visibilidade
  do campo/botões passou, mas o comportamento do primeiro Voltar requer ajuste.
- **Pendente: rótulo do estagiário.** Perfil e menu usam “Professor”. Não foi
  observada concessão de acesso administrativo por esse rótulo.

## Limitações e preparação do ambiente

- A primeira entrada da coordenação exibiu erro de inicialização; “Tentar novamente”
  carregou o início. Causa não isolada. Gestão abriu depois de iniciar o runtime
  local das Edge Functions, que antes retornava erro de resolução de nome.
- O banco local não tinha `guardian_name`, `guardian_phone` e `guardian_relation`.
  Isso primeiro causou PGRST204 (“Atualize o app para continuar”). Foram adicionadas
  somente essas colunas locais, sem relaxar RLS; então ficou evidente o falso
  sucesso descrito acima. Não houve reset nem mudança remota para preparar o teste.
- Metro usou porta 8082 com ponte USB de loopback. Uma recarga falhou ao baixar o
  bundle quando Metro parou; essa ocorrência é do ambiente de desenvolvimento,
  sem evidência de regressão do APK distribuído. Após reiniciar Metro, a recarga
  funcionou, manteve a sessão de aluno e voltou a exigir completar o cadastro.
- Não cobertos: convite de familiar/aluno, aceite novo de equipe, vínculo de
  professor cadastrado só pelo nome, tema claro, e-mail/WhatsApp externos e matriz
  completa de RLS entre duas organizações.

## Validação da correção de boot

- Jest focado: 7 testes aprovados.
- `npm run typecheck:app`: aprovado.
- `npm run check:org-scope`: aprovado.
- `git diff --check`: aprovado; checklist regenerado, preservando títulos/IDs.
- App nativo abriu e os cinco logins acima foram exercitados após a correção.

Capturas locais: `coord-invite-keyboard.png`, `coord-home.png`,
`professor-classes.png`, `intern-classes.png`, `guardian-home.png`,
`guardian-finance-denied.png`, `athlete-home.png` e `athlete-save-retry.png`.
O toast de sucesso da última captura **não é evidência de gravação**.

## Correções e revalidação local

- Perfil do aluno: a nova RPC `save_my_student_profile` limita campos e exige
  identidade verificada e vínculo ativo. O cliente exige recibo correspondente
  ao aluno/organização; não usa mais PATCH genérico no perfil próprio.
  Migration `20261008235145_student_self_profile.sql` aplicada apenas localmente.
- No Galaxy S25, salvar nascimento, telefone e CPF sintéticos persistiu no banco;
  CPF ficou cifrado e o campo de entrada foi limpo. Após recarregar, o aluno
  entrou direto no início, sem repetir a exigência de completar o perfil.
- Testes HTTP no backend local: coordenação, professor, estagiário e responsável
  receberam 403 ao tentar usar essa RPC para editar o aluno; o próprio aluno
  recebeu 403 ao enviar alteração de turma. Dados e turma permaneceram corretos.
- Voltar nativo: primeira ação fechou o teclado e manteve o convite/rascunho;
  segunda ação exibiu a confirmação de descarte. Conferido no aparelho.
- Rótulo Estagiário corrigido no perfil/menu e protegido por teste de renderização.
  A conferência visual nativa desse rótulo e dos últimos textos permanece pendente.
- Barra de salvar usa margem nativa de 12px. Removidos toast rotineiro de sucesso,
  subtítulos e explicações redundantes; erros acionáveis e descrição da permissão
  financeira permanecem. O balão arrastável de chat não foi alterado.

Validação: 38 testes Jest em seis suítes; integração PostgreSQL isolada cobre
campos proibidos, identidade não verificada, outro vínculo, revogação e RLS.
Typecheck, escopo organizacional, arquitetura e higiene de performance aprovados.
Capturas: `profile-after-save-fixed.png`, `athlete-reload-fixed.png` e
`invite-back-keyboard-fixed.png` em `.tmp/adb-invite-qa/`.

Preparação adicional: segredos aleatórios de cifragem/HMAC foram criados somente
na base local, que ainda não os tinha, para exercitar os triggers reais do CPF.
Nenhum segredo de produção foi lido ou alterado. A última revisão visual encontrou
Metro encerrando por `EMFILE` durante HMR; isso limita a certificação dos últimos
textos no aparelho. Não houve nova publicação, OTA ou migration remota.


## Indicador de puxar para atualizar

Restaurado o RefreshControl nativo Android sem captura manual ou overlay duplicado.
ADB no Galaxy S25 confirmou o indicador durante o gesto na Home do professor
(`refresh-pull.png`). Nove testes, typecheck e lint aprovados. Expo mantido ligado
para teste do usuário. Sem publicação.


## Nova turma durante sessão ativa

Conta de professor real da fixture, sem privilégio administrativo. Antes do
vínculo, GET autenticado não retornava `adb-refresh-new` e a Home não a exibia.
Com a sessão aberta, foi adicionada a associação local em `class_staff`.
Puxar para atualizar trouxe “Turma Nova Refresh” na próxima aula e na agenda,
sem logout, novo login ou recarga do bundle. Captura `new-class-after-refresh.png`.
A atribuição foi simulada diretamente na base local: não certifica a interface
de gestão usada pela coordenação para conceder o vínculo.

O refresh agora também chama `refreshMemberPermissions`. Retirar a permissão
`students` e puxar removeu o atalho Alunos; restaurá-la e puxar trouxe o atalho
de volta. Permissão original restaurada; turma sintética mantida para teste.
16 testes focados, typecheck, org-scope, lint, perf-hygiene e diff aprovados.
Expo permanece ligado com a conta de professor de teste. Nenhuma mudança remota.


## Feedback visual da Home

A pedido do usuário, conteúdo da Home recebe shimmer durante a busca. Cabeçalho
e navegação permanecem; conteúdo montado preserva estado, fica sem interação e
fora da acessibilidade enquanto oculto. Primitive existente respeita reduced
motion. ADB confirmou início/carregamento/retorno, com captura
`refresh-home-shimmer.png`. Para observar a espera foi usado lock transacional
de 5s em classes somente no banco local, encerrado por rollback; não há atraso
artificial no app. Typecheck, lint e teste focado conferidos; sem publicação.


## Transição do refresh

Substituída troca instantânea por crossfade de 120/220ms com uma Animated.Value
compartilhada entre conteúdo e shimmer. Driver nativo Android, sem animar layout
ou atrasar a rede; reduced motion zera duração. Dois testes cobrem término,
interrupção, desmontagem e acessibilidade. Typecheck e higiene aprovados; ADB
confirmou refresh e retorno ao conteúdo sem erro. Não foi medido ganho de FPS.


Contraste do refresh: fundo nativo passou a usar o tema. ADB conferiu ícone claro
sobre círculo escuro em Turmas (`refresh-contrast.png`); sete testes focados
aprovados. Correção compartilhada, sem mudança no gesto e sem publicação.


## Padrão compartilhado de refresh

Shimmer/fade removidos da Home e centralizados no RefreshFeedbackProvider. Todos
os consumidores de AppRefreshControl compartilham cor, estado e animação: Home,
Turmas, Alunos, Perfil, Exercícios, Eventos, aluno, família, Gestão e Financeiro.
Adicionado gesto a Planejamento, Calendário, Notificações, Periodização e
Regulamentos, ligado às buscas próprias. Planejamento bloqueia refresh com edição
pendente. useScreenRefresh evita concorrência e encerra carregamento após erro.
Não é recarga de bundle nem sincronização de todas as entidades em cada gesto.

ADB local confirmou overlay global na Home e no Planejamento, este sem plano
selecionado; último em `refresh-global-planning-confirmed.png`. Não certifica
edição de plano nem cada rota/perfil/tema. 14 testes focados, tipos, lint, escopo
organizacional e higiene de performance aprovados. Outros editores, rotas sem
lista e pesquisas sob demanda não receberam gesto automático nesta rodada.
Expo mantido ligado. Sem nova publicação, migration ou mudança remota.


Duplicação visual do refresh: removido o ActivityIndicator do provider global
e a alternância de transparência do nativo. O provider fica responsável apenas
pelo shimmer/fade. Dez testes focados passaram; correção local disponível no Expo.


Sobreposição visual: removida a composição global de três shimmers sobre a tela.
O provider agora anima somente a opacidade do conteúdo montado (1 até 0,72),
sem bloquear toques, duplicar conteúdo ou alterar posições. Indicador nativo
preservado. Teste de montagem confirma uma única instância antes/durante/depois.
Dez testes focados e typecheck aprovados. Ajuste local disponível no Expo.


Usuário informou duplicação persistente. Captura do Perfil não reproduziu o
problema; removida também a opacidade global da árvore de navegação. Provider
agora retorna filhos sem wrapper visual e sem registrar estado de feedback.
O gesto e a busca permanecem nos controles nativos. Oito testes passaram.
Esta alteração não constitui confirmação visual de resolução do relato.


Causa do flick do Perfil identificada pelas capturas do usuário: efeito limpava
staffClassIds em toda busca e PersonProfilePage trocava lista/contador pelo texto
de loading. Mantidos vínculos no mesmo contexto e lista visível enquanto há
dados anteriores. Erro/troca de contexto continuam limpando vínculos. Teste
cobre atualização e resultado vazio final. ADB com consulta de class_staff
retardada por lock local de 5s confirmou contador e duas turmas presentes durante
a busca (`profile-refresh-stable.png`); lock encerrado por rollback. Dez testes,
tipos, lint e org-scope aprovados. Sem publicação.


Após o usuário confirmar que o flick foi resolvido, adicionado feedback por
barra fina de atividade no topo, sem ocultar conteúdo. Entrada imediata, fade
de saída 420ms, sem atraso de rede; reduced motion preservado. Três testes
de provider/transição passaram. Conferência visual final pelo usuário pendente.
