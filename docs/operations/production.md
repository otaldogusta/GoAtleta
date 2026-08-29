# Produção e operação

Este é o documento canônico para deploy, checklist, prontidão, rollback,
monitoramento e sign-off do GoAtleta. Os documentos antigos continuam
arquivados para consulta histórica, mas não devem receber conteúdo novo.

## Fluxo operacional

1. Confirmar `git status --short` limpo antes de iniciar.
2. Rodar os checks aplicáveis: `check:encoding`, typechecks, testes, lint,
   `check:org-scope` e build.
3. Commitar e enviar para a `main` somente depois dos checks passarem.
4. Confirmar deployment `READY` na Vercel para o commit enviado.
5. Validar `https://goatleta.com` com HTTP `200` e
   `https://www.goatleta.com` redirecionando para o domínio principal.
6. Fazer smoke visual nas rotas críticas antes de abrir nova frente.

## Plano mestre Android: estabilização, AAB e Play Store

Este plano é o gate canônico entre uma alteração local no aplicativo e uma
versão Android distribuída pela Play Store. Ele separa o que pode ser concluído
somente no notebook daquilo que exige aparelho físico, conta da Play Console ou
autorização explícita de publicação.

### Resultado esperado

- O aplicativo restaura a sessão autenticada após Fast Refresh, recarga completa,
  encerramento e nova abertura.
- O plano de aula mantém o documento editável no tamanho original, com arraste,
  zoom por pinça, salvamento e download/compartilhamento funcionais.
- Os fluxos críticos não apresentam tela branca, erro de bundle, crash, ANR ou
  redirecionamento incorreto.
- O pacote candidato passa pelos checks locais, por um APK de validação e por um
  AAB de produção antes de qualquer liberação pública.
- Cada gate deixa evidência objetiva: comando, resultado, commit, build, canal,
  versão, dispositivo e pendências reais.

### Regras de controle

- Não misturar correção funcional, mudança de infraestrutura e melhoria de
  produto sem necessidade para fechar um gate.
- Não apagar nem sobrescrever alterações não relacionadas no worktree.
- Não considerar build, OTA ou upload como prova de que a experiência funciona.
- Não enviar para `main` antes da validação autorizada: o push em `main` aciona
  a publicação EAS Update de produção pelo GitHub Actions.
- Não gerar AAB com bug P0 aberto, worktree desconhecido ou validação física
  explicitamente pendente.
- Não promover produção, alterar segredos ou publicar na Play Store sem
  autorização explícita no trabalho corrente.

### Mapa de execução

| Fase | Entrega | Pode rodar sem celular | Gate de saída |
| --- | --- | --- | --- |
| 0 | Inventário e congelamento do escopo | Sim | arquivos e riscos classificados |
| 1 | Persistência da sessão | Sim, exceto aceite físico | testes de armazenamento e roteamento verdes |
| 2 | Visualizador/editor PDF | Sim, exceto gestos e compartilhamento reais | testes focados e diff revisado |
| 3 | Regressão dos fluxos críticos | Parcial | smoke web e testes automatizados verdes |
| 4 | Qualidade e compatibilidade Expo | Sim | checks técnicos completos |
| 5 | Validação no Android físico | Não | checklist físico assinado |
| 6 | APK candidato | Build sim; aceite não | APK instalado e aprovado |
| 7 | AAB e Play Console | Parcial | teste interno aprovado |
| 8 | Liberação gradual e monitoramento | Não | estabilidade observada e sign-off |

### Backlog executivo desta release candidate

| ID | Prioridade | Item | Depende de celular | Dependência | Aceite resumido |
| --- | --- | --- | --- | --- | --- |
| AUTH-01 | P0 | Persistir sessão nativa sem acoplar ao e-mail lembrado | Não | nenhuma | reload conserva login |
| AUTH-02 | P0 | Separar revogação de falha transitória no refresh | Não | AUTH-01 | offline/5xx não fazem logout |
| AUTH-03 | P0 | Unificar o dono da restauração inicial | Não | AUTH-01 | sem corrida nem flash de Welcome |
| PDF-01 | P0 | Recalcular shells após edição longa | Não | patch atual | conteúdo sempre alcançável |
| PDF-02 | P0 | Compatibilizar pan com seleção/caret | Parcial | patch atual | edição e gesto coexistem |
| PDF-03 | P1 | Cobrir menu, intent, share e falhas | Parcial | patch atual | toda saída tem resultado claro |
| QA-01 | P0 | Testes focados de auth, bootstrap e PDF | Não | AUTH/PDF | suítes verdes |
| QA-02 | P0 | Typecheck, org-scope, diff e build | Não | QA-01 | gates técnicos verdes |
| QA-03 | P0 | Matriz Android física autenticada | Sim | QA-02 | sessão/PDF aprovados no aparelho |
| REL-01 | P1 | Corrigir o workflow Android que hoje gera APK | Não | QA-02 | job de loja gera AAB |
| REL-02 | P0 | Gerar e aprovar APK candidato sem Metro | Sim | QA-03 | smoke instalável aprovado |
| REL-03 | P0 | Gerar AAB do commit aprovado | Não | REL-02 | build production concluído |
| STORE-01 | P0 | Play Store - teste interno | Sim | REL-03 | instalação pela loja aprovada |
| STORE-02 | P1 | Rollout gradual e monitoramento | Não | STORE-01 | sign-off operacional |

Ordem crítica: `AUTH-01 -> AUTH-02/AUTH-03 -> PDF-01/PDF-02 -> QA-01 ->
QA-02 -> QA-03 -> REL-02 -> REL-03 -> STORE-01 -> STORE-02`.

Itens que podem avançar com o notebook ligado e sem aparelho: `AUTH-01` a
`AUTH-03`, `PDF-01`, a parte automatizada de `PDF-02/PDF-03`, `QA-01`, `QA-02`
e a preparação de `REL-01`. Os gates `QA-03`, `REL-02` e `STORE-01` permanecem
explicitamente abertos até existir um aparelho disponível.

### Estado local em 28/08/2026

Concluído no notebook, ainda sem commit ou publicação:

- `AUTH-01`, `AUTH-02` e `AUTH-03`: a sessão deixou de depender da preferência
  de lembrar e-mail, falhas transitórias não apagam o refresh token e o
  bootstrap é o único responsável pela restauração inicial.
- `PDF-01` e a parte automatizada de `PDF-02/PDF-03`: o shell é recalculado por
  `ResizeObserver` e pelos eventos de edição; o drag ignora alvos editáveis; pan,
  pinch, menu `Baixar PDF` e falha sem destino de compartilhamento têm cobertura.
- `REL-01`: o job Android em `.eas/workflows/create-production-builds.yml` usa o
  perfil `production`, que gera `app-bundle`.
- O Metro ignora saídas geradas na raiz (`tmp`, `dist`, Storybook e artefatos
  de QA), reduzindo a pressão do mapa de arquivos no Windows sem ocultar
  `src`, `assets` ou dependências empacotadas.
- Evidência automatizada: 7 suítes, 47 testes verdes; `typecheck:app`,
  `check:org-scope`, `git diff --check`, `expo install --check`, Expo Doctor
  21/21 e `npm run build` verdes.
- Smoke HTTP local: `/login` respondeu `200` em `http://127.0.0.1:8081` após o
  aquecimento do Metro.

Evidência física parcial no Galaxy S25 (`SM-S931B`), Android 16/API 36, com o
development build `1.0.2-dev` (`versionCode 3`) conectado por USB:

- O modo `localhost` reproduziu o EOF porque a porta estava vinculada apenas ao
  loopback IPv6. Com `--host lan` e `adb reverse tcp:8081 tcp:8081`, o bundle
  Android foi carregado pelo development client sem `Render Error`, `Could not
  load bundle`, tela branca, crash ou ANR.
- A sessão autenticada foi restaurada antes do guard tanto na abertura inicial
  quanto após `force-stop` e reabertura completa; não houve flash nem retorno ao
  Welcome.
- Uma recarga já com o cache aquecido recompilou a entrada em `193 ms`; o
  bootstrap terminou em `649 ms` e preservou a sessão e a rota autenticada.
- Um plano aplicado abriu no canvas A4 editável e o pan horizontal revelou as
  colunas que estavam fora do enquadramento.
- O canvas nativo passou a preservar explicitamente a folha A4 em `210 x 297 mm`
  com `box-sizing: border-box`; no telefone, o plano abre em `125%` para manter
  leitura próxima à de um editor móvel, sem alterar o HTML/PDF exportado.
- A pinça para ampliar e reduzir foi aprovada pelo usuário no aparelho. Depois
  da calibração para `125%`, um novo pan horizontal por ADB continuou revelando
  a extremidade oposta da tabela sem travar o cabeçalho do modal.
- O menu de três pontos exibiu `Baixar PDF` e `Remover plano`; `Baixar PDF`
  gerou o arquivo, abriu o seletor nativo e iniciou o Adobe Acrobat. A integridade
  visual do arquivo foi registrada em captura do Adobe Acrobat fornecida pelo
  usuário; a alteração de escala ficou restrita ao preview do GoAtleta.
- A Home nativa agora exibe o acionador de menu no canto esquerdo. A gaveta
  lateral expandida abriu no Galaxy, manteve as rotas principais visíveis e
  fechou pelo botão físico Voltar sem mudar de rota.
- Depois do pan, uma célula editável recebeu foco e exibiu seleção/caret sem
  crash ou perda da prévia; alteração de texto e persistência ainda não foram
  executadas para não modificar o plano real sem confirmação.

Limites e gates ainda abertos:

- Pan vertical, edição/caret completa e persistência após salvar ainda precisam
  de aceite físico. A pinça, o pan horizontal e a abertura no leitor externo
  estão aprovados.
- O APK candidato sem Metro (`REL-02`) e os cenários de rede lenta/offline ainda
  não foram executados; o development build não substitui esses gates.
- A compilação fria, executada com `--clear`, levou `128,7 s` para 3.444 módulos
  e o processo do Metro ainda manteve cerca de 19 mil handles. O EOF foi fechado
  pela escuta IPv4/LAN e os diretórios gerados deixaram de ser observados, mas
  o consumo frio do bundler continua registrado como dívida de desempenho.
- O aceite visual autenticado foi iniciado e cobre sessão, preview, pan
  horizontal e seletor de PDF, mas `QA-03` permanece parcial até completar a
  matriz física.
- O lint focado do núcleo alterado não apresentou erros, mas manteve seis
  avisos preexistentes. O lint ampliado ainda encontra dívida anterior em telas
  grandes de login, perfil, layout e preview do plano; não considerar lint
  global verde nesta evidência.
- Branch local `main`, base `92173acd`; worktree misto preservado e sem commit,
  push, EAS build, OTA, AAB ou publicação nesta rodada.

### Fase 0 - inventário e congelamento

Achados da auditoria inicial desta release candidate:

- O projeto corrente usa Expo SDK 57; qualquer checklist histórico de SDK 56 é
  apenas referência e não substitui `expo install --check`/`expo-doctor` atuais.
- `eas.json` possui `production` como AAB e `production-apk` como APK.
- `.eas/workflows/create-production-builds.yml` aponta o job Android para
  `production-apk`, apesar do nome do workflow sugerir builds de produção para
  loja; não usar esse job como prova de AAB sem corrigi-lo ou substituí-lo.
- `.github/workflows/eas-update.yml` publica OTA no canal de produção a cada push
  em `main`/`master`.
- A versão pública declarada é `1.0.2`; o `versionCode` local é apenas referência,
  pois o EAS usa `appVersionSource: remote` e `autoIncrement` em produção.
- `runtimeVersion` segue `appVersion`, portanto alteração de versão pública muda
  a compatibilidade do grupo OTA.

- [ ] Registrar branch, `HEAD`, `git status --short` e `git diff --stat`.
- [ ] Classificar cada arquivo como correção de sessão, PDF, teste, configuração
  de release ou alteração não relacionada.
- [ ] Definir a lista fechada de bugs P0 e P1 desta versão.
- [ ] Confirmar que não há migração, Edge Function, segredo ou permissão Android
  escondida no pacote.
- [ ] Verificar se houve mudança nativa que exige novo runtime/build ou se o
  pacote é integralmente entregável por OTA.
- [ ] Impedir commit parcial que deixe implementação e testes fora de sincronia.

Gate: escopo explícito, worktree preservado e nenhuma alteração desconhecida.

### Fase 1 - sessão e retorno indevido ao Welcome

Contrato desejado:

- A sessão autenticada é persistida no armazenamento seguro do aplicativo.
- A opção de lembrar dados controla somente conveniência de preenchimento, não a
  sobrevivência da sessão após uma recarga do bundle.
- Logout explícito limpa sessão, tokens e estado sensível.
- Token expirado tenta renovação; falha definitiva ou revogação encerra a sessão
  com mensagem compreensível.
- Timeout, ausência de rede, rate limit ou resposta 5xx preservam a sessão local
  e entram em estado transitório/offline; não são tratados como revogação.
- Payload ilegível do SecureStore falha de forma segura sem travar o bootstrap.
- O guard de rotas só decide por `/welcome` depois que a restauração terminou.
- Bootstrap e `AuthProvider` não competem pela restauração: deve existir um único
  dono da leitura, validação e publicação do estado autenticado inicial.

Checklist de implementação e teste:

- [ ] Separar preferência de e-mail lembrado da persistência da sessão.
- [ ] Manter a sessão nativa no SecureStore independentemente dessa preferência.
- [ ] Preservar o comportamento de logout e de sessão inválida.
- [ ] Testar login com a preferência marcada e desmarcada.
- [ ] Testar bootstrap com sessão válida, ausente, expirada e ilegível.
- [ ] Testar renovação revogada (`400/401/403`) separadamente de timeout, `429`,
  offline e `5xx`.
- [ ] Garantir que falhas transitórias não apagam o refresh token armazenado.
- [ ] Eliminar a restauração concorrente entre bootstrap e `AuthProvider`.
- [ ] Testar que o guard aguarda `bootstrapLoading` e `loading`.
- [ ] Testar que uma recarga não redireciona um usuário autenticado para Welcome.
- [ ] Testar que logout continua redirecionando e impedindo acesso protegido.
- [ ] Registrar telemetria sanitizada para sessão restaurada, revogada, ilegível
  ou mantida offline, sem incluir token ou dado sensível.

Gate sem celular: testes de sessão, bootstrap e roteamento, typecheck e revisão
do diff verdes. Gate final: recarga e reabertura aprovadas no Android físico.

### Fase 2 - plano de aula e PDF mobile

Contrato desejado:

- O documento conserva o layout do PDF/web editável e não é refluído como um
  cartão mobile.
- Um dedo desloca a câmera nos dois eixos sem selecionar texto acidentalmente.
- Dois dedos aplicam zoom mantendo uma faixa segura e permitindo voltar ao
  enquadramento inicial.
- Edição, teclado e gestos não entram em disputa destrutiva.
- O menu de três pontos expõe `Baixar PDF` e `Remover plano` com estados de
  carregamento, desabilitado e erro coerentes.
- Download abre o compartilhamento/salvamento nativo e não perde as edições.

Checklist automatizado no notebook:

- [ ] Cobrir geração do HTML nativo, viewport, canvas, escala e largura mínima.
- [ ] Cobrir os props nativos necessários do WebView e a paridade web/native.
- [ ] Cobrir a presença e a ordem das ações do menu.
- [ ] Cobrir bloqueio de download durante carregamento e feedback de erro.
- [ ] Cobrir mensagens da ponte de edição e salvamento.
- [ ] Revisar limites de zoom, dimensões do canvas e múltiplas páginas.
- [ ] Recalcular `page-shell` quando a edição altera altura/largura do documento,
  usando observação de tamanho ou eventos `input`/`compositionend`.
- [ ] Testar texto longo sem corte, sobreposição de páginas ou área inacessível.
- [ ] Garantir que o drag manual não rouba seleção, caret, long-press ou alças de
  um campo `contenteditable`; filtrar alvo/estado de edição se necessário.
- [ ] Executar em DOM o comportamento de `updateScale`, shell, `scrollLeft`,
  `scrollTop` e transição entre um e dois dedos; inspeção de strings não basta.
- [ ] Testar o menu com React Native Testing Library: abrir, baixar, estados
  loading/dirty/desabilitado e preservação de `Remover plano`.
- [ ] Testar exportação com visualizador instalado, fallback para compartilhar,
  cancelamento, intent com falha e compartilhamento indisponível.
- [ ] Renderizar amostras A4 com texto curto, texto longo e duas páginas para
  comparação visual por imagem.
- [ ] Verificar ausência de regressão no preview web.

Checklist físico posterior:

- [~] Arrastar esquerda/direita e cima/baixo nas bordas e no centro. Pan
  horizontal aprovado; eixo vertical e bordas ainda pendentes.
- [x] Pinçar para ampliar e reduzir repetidamente.
- [ ] Editar célula após mover e ampliar; fechar teclado sem perder o estado.
- [ ] Selecionar, colar e editar texto longo sem o gesto de pan roubar o caret.
- [ ] Salvar, fechar, reabrir e confirmar a persistência do conteúdo.
- [x] Baixar/compartilhar e abrir o arquivo gerado em um leitor externo.
- [ ] Repetir com e sem um visualizador de PDF instalado e cancelar o share.
- [ ] Repetir com plano pequeno, plano longo e conteúdo que ocupe múltiplas páginas.

Gate: nenhum corte inacessível, gesto bloqueado, perda de edição ou arquivo
inválido.

### Fase 3 - regressão dos fluxos críticos

Executar em ordem, registrando o primeiro ponto de falha:

1. Inicialização fria e restauração de sessão.
2. Login, logout e retorno ao aplicativo.
3. Painel e troca do perfil operacional aplicável.
4. Lista de turmas, filtro de unidade e abertura da turma.
5. Aula do dia, geração, edição e salvamento do plano.
6. Chamada com data explícita e salvamento.
7. Relatório da aula e histórico recente.
8. Planejamento e periodização sem perda de `cycle_id`.
9. Gestão, membros e isolamento por organização.
10. Operação com rede lenta, queda de rede e retorno à conectividade.

Se um fluxo falhar, registrar rota, perfil, horário, ação anterior, mensagem,
stack, screenshot e se o problema reproduz em recarga limpa.

### Fase 4 - gates técnicos no notebook

Rodar do mais barato para o mais caro:

```powershell
npx jest <testes-focados> --runInBand
npm run typecheck:app
npm run check:org-scope
git diff --check
npx expo install --check
npx expo-doctor
npm run build
```

Regras:

- [ ] Falha nova bloqueia a versão.
- [ ] Dívida global preexistente deve ser diferenciada de regressão do pacote.
- [ ] Mudança em TSX relevante recebe lint focado quando aplicável.
- [ ] O build web é gate de compilação, não aceite visual mobile.
- [ ] O relatório final inclui duração, resultado e qualquer aviso aceito.

### Fase 5 - matriz Android física

Executar quando o aparelho estiver novamente disponível:

| Cenário | Resultado esperado |
| --- | --- |
| Fast Refresh | sessão e rota preservadas |
| Reload completo | sessão restaurada antes do guard |
| Fechar e abrir | usuário continua autenticado |
| Reiniciar Metro | aplicativo reconecta sem perder sessão |
| Sem Metro no APK | inicialização normal pelo bundle instalado |
| Wi-Fi lento | loading controlado, sem tela branca |
| Offline e retorno | estado coerente e sincronização retomada |
| PDF com um dedo | pan nos dois eixos |
| PDF com dois dedos | zoom suave e reversível |
| Compartilhar PDF | arquivo válido no destino |

Evidência parcial de 28/08/2026:

| Cenário | Resultado observado |
| --- | --- |
| Reload completo | aprovado; sessão restaurada antes do guard |
| Fechar e abrir | aprovado após `force-stop`; usuário permaneceu autenticado |
| Reiniciar Metro/development client | aprovado em `--host lan` por USB/ADB reverse, sem perder sessão; reload aquecido em 193 ms |
| PDF com um dedo | pan horizontal aprovado; eixo vertical pendente |
| PDF com dois dedos | aprovado pelo usuário; zoom por pinça suave e reversível |
| Compartilhar PDF | geração, seletor nativo, abertura e renderização no Acrobat aprovados |

Registrar modelo do aparelho, versão do Android, versão do app, build/runtime,
rede, perfil usado e resultado de cada cenário.

### Fase 6 - APK candidato

O APK serve para validação instalável; ele não substitui o AAB da loja.

- [ ] Confirmar que o perfil `preview-apk` ou `production-apk` usa o ambiente
  pretendido sem imprimir segredos.
- [ ] Gerar somente depois dos gates locais.
- [ ] Instalar em aparelho sem depender do Metro.
- [ ] Repetir sessão, PDF e regressão crítica.
- [ ] Registrar URL/ID do build, commit, versão e status.

Gate: APK aprovado no aparelho e nenhuma dependência do servidor de desenvolvimento.

### Fase 7 - AAB e Play Console

- [ ] Usar o perfil `production`, cujo `android.buildType` é `app-bundle`.
- [ ] Confirmar a versão pública e o incremento remoto de `versionCode` antes do
  build; `appVersionSource` está configurado como `remote`.
- [ ] Confirmar compatibilidade do `runtimeVersion` baseado em `appVersion` com o
  canal OTA de produção.
- [ ] Corrigir ou não usar qualquer workflow que aponte Android para
  `production-apk` quando a intenção declarada for criar AAB.
- [ ] Gerar o AAB a partir do commit aprovado e limpo.
- [ ] Conferir assinatura, package name, permissões, ícones e deep links.
- [ ] Enviar primeiro para teste interno da Play Store.
- [ ] Preencher notas da versão, instruções de acesso para revisão e declarações
  de segurança de dados aplicáveis.
- [ ] Aguardar processamento e relatório de pré-lançamento.
- [ ] Instalar pela faixa interna e repetir a matriz física sem Metro.

Gate: build interno aprovado, sem crash/ANR bloqueante e com fluxo autenticado
funcional.

### Fase 8 - liberação e monitoramento

- [ ] Promover em porcentagem controlada, não diretamente para 100%, quando a
  Play Console e o estágio do produto permitirem.
- [ ] Monitorar crashes, ANRs, falhas de login, bootstrap, downloads e geração de
  plano.
- [ ] Validar o canal EAS Update e o runtime atendido pelo binário publicado.
- [ ] Parar a liberação diante de regressão P0/P1.
- [ ] Registrar decisão de continuar, pausar ou corrigir.
- [ ] Só marcar a versão como concluída depois do período de observação definido.

### Estratégia de rollback

- Código local: manter o pacote isolado e não descartar alterações do usuário.
- OTA: promover/republicar o grupo estável compatível com o mesmo runtime.
- Play Store: interromper rollout gradual e preparar novo `versionCode`; um AAB
  já publicado não deve ser tratado como reversível por substituição local.
- Dados: não incluir migração destrutiva nesta versão; qualquer migração futura
  precisa de compatibilidade regressiva e plano próprio.
- Segurança: logout forçado ou invalidação ampla de sessão só pode ser usado com
  justificativa, impacto conhecido e comunicação ao usuário.

### Definição de pronto

A versão só está pronta quando todos os itens abaixo forem verdadeiros:

- [ ] Bugs P0 fechados e P1 aceitos explicitamente.
- [ ] Sessão sobrevive a reload e reabertura; logout continua seguro.
- [ ] PDF móvel aprovado para pan, pinch, edição, salvamento e compartilhamento.
- [ ] Testes focados, typecheck, escopo organizacional, diff e build verdes.
- [ ] Worktree do commit conhecido e sem arquivos acidentais.
- [ ] APK candidato aprovado sem Metro.
- [ ] AAB corresponde ao mesmo commit aprovado.
- [ ] Teste interno da Play Store aprovado.
- [ ] Evidências e pendências registradas.
- [ ] Autorização explícita recebida para cada ação de publicação aplicável.

### Registro mínimo de evidência

```text
Commit:
Branch:
Arquivos incluídos:
Checks locais:
Versão / versionCode:
Runtime / canal OTA:
Build APK:
Build AAB:
Faixa Play Store:
Dispositivo / Android:
Smoke autenticado:
Sessão após reload:
PDF pan / pinch / edição / download:
Crashes / ANRs:
Pendências:
Decisão:
```

## Documentos ativos

| Documento | Uso |
| --- | --- |
| [Release checklist](../../RELEASE_CHECKLIST.md) | Checklist curto antes/depois do deploy |
| [Segurança](../security/overview.md) | Riscos, auditorias e comandos de verificação |
| [NFC](../nfc/overview.md) | Estado e histórico da arquitetura NFC |

## Histórico arquivado

| Documento antigo | Cópia completa |
| --- | --- |
| `PRODUCTION_READINESS.md` | [archive/operations/PRODUCTION_READINESS.md](../archive/operations/PRODUCTION_READINESS.md) |
| `PRODUCTION_DEPLOYMENT_SUMMARY.md` | [archive/operations/PRODUCTION_DEPLOYMENT_SUMMARY.md](../archive/operations/PRODUCTION_DEPLOYMENT_SUMMARY.md) |
| `POST_DEPLOY_MONITORING.md` | [archive/operations/POST_DEPLOY_MONITORING.md](../archive/operations/POST_DEPLOY_MONITORING.md) |
| `SIGN_OFF_PRODUCTION.md` | [archive/operations/SIGN_OFF_PRODUCTION.md](../archive/operations/SIGN_OFF_PRODUCTION.md) |
| `VALIDACAO_FINAL_PRODUCAO.md` | [archive/operations/VALIDACAO_FINAL_PRODUCAO.md](../archive/operations/VALIDACAO_FINAL_PRODUCAO.md) |
| `RELEASE_NOTES_v2.1.0.md` | [archive/operations/RELEASE_NOTES_v2.1.0.md](../archive/operations/RELEASE_NOTES_v2.1.0.md) |

## Observações

- `POST_DEPLOY_CHECKLIST.md` não é mais um documento separado. Use este arquivo
  junto com [Release checklist](../../RELEASE_CHECKLIST.md).
- O sign-off de produção é uma decisão operacional, não um documento duplicado.
  Registre a evidência no checklist ou no changelog quando necessário.
- Todo novo runbook de deploy deve atualizar este arquivo ou o checklist curto,
  sem criar outro `.md` na raiz.
