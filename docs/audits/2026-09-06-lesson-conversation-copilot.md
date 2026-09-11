# Copiloto conversacional da Aula do Dia

## Estado

Implementação local sobre `27d32c58`. Sem commit, push, migração ou publicação em produção deste pacote.
Build Android de preview despachado no EAS: [0d2418fc-5662-407e-b920-f636cd37be5d](https://expo.dev/accounts/otaldogusta/projects/goatleta/builds/0d2418fc-5662-407e-b920-f636cd37be5d), perfil `preview-apk`, versão/runtime `1.0.3`. Upload e registro aceitos; conclusão do build e teste em dispositivo ainda não confirmados. Snapshot inclui alterações locais ainda não commitadas.
O backend publicado anteriormente não implementa este protocolo; a interface rejeita suas respostas para este fluxo.

## Fluxo entregue

- Conversa de aula integrada ao chatbot flutuante existente nas telas da turma e de sessão. O bloco separado `Organizar aula` foi removido a pedido do usuário.
- Contexto fixado por conta, organização, turma e data; mudança desmonta a conversa e cancela solicitações.
- `Conversar` ajuda a desenvolver a intenção sem entregar rascunho automaticamente.
- `Montar aula com isso` solicita os três blocos com tempos; saída incompleta não pode ser aplicada.
- `Falar com o Go` grava até um minuto. A transcrição preenche o campo editável e não envia a conversa automaticamente.
- Revisão com turma, data, atividades e duração; `Aplicar à aula do dia` é uma ação explícita.
- Aplicação cria uma versão para aquela data e preserva a anterior. Detecta mudança do plano desde a revisão.
- ID estável por rascunho permite reconhecer uma tentativa já salva após falha de rede; trava local impede clique duplo.
- O resize entre celular e desktop preserva a conversa, corrigindo a desmontagem causada pelos wrappers do workspace.

## Fronteiras do código

| Camada | Responsabilidade |
| --- | --- |
| `CopilotLessonChat` / `lesson-context` | Conversa dentro do chatbot e registro da aula ativa sem renderizar um bloco na turma |
| `useLessonConversation` | Estado da conversa, cancelamento, protocolo e aplicação explícita |
| `lesson-draft` / `apply-lesson-draft` | Validação do rascunho e criação da versão datada |
| `LessonVoiceInput` / `LessonVoiceRecorder` | Disponibilidade nativa, captura e limpeza do áudio |
| `src/api/lesson-audio` | Transporte autenticado de gravação |
| `assistant-transcribe` | Limite de bytes, autorização e transcrição no servidor |
| `assistant/model-policy` | Seleção centralizada, Responses API e métricas do modelo efetivo |
| `assistant/lesson-conversation` / `lesson-history` | Contrato pedagógico e planos anteriores com origem explícita |

## Contexto e segurança

Reutiliza o resolver de documentos, relatórios realizados, memória e periodização do assistente.
Acrescenta até seis datas de planos previstos nos últimos 28 dias, com organização e turma explícitas.
Um plano previsto nunca é convertido em prova de exercício realizado. O conteúdo de um relatório deve sustentar a afirmação de execução.
Falha de consulta significa evidência indisponível, não ausência de prática. A repetição intencional para consolidação é respeitada.

O cliente valida o envelope `lessonContext` (versão, organização, turma e data), além do rascunho.
O servidor força a identidade da turma no rascunho e descarta rascunhos na conversa exploratória.
A resolução de papel no assistente filtra a associação pelo usuário autenticado.
Transcrição exige associação de professor/administrador e acesso à turma sob RLS.
O áudio tem limite de 8 MB, incluindo verificação de stream sem `Content-Length`, e limite de quatro tentativas/minuto por instância.
Esse limitador é de proteção contra rajadas; não representa quota global entre instâncias.
Áudio/transcrição não são persistidos nem registrados pelo endpoint. O arquivo temporário de captura é removido após uso.
As memórias de texto enviadas ao assistente seguem a política existente do app.

## Modelo

O candidato padrão local é `gpt-5.6-luna`; `OPENAI_ASSISTANT_MODEL` aceita somente Luna, Terra ou `gpt-4o-mini`.
O cliente não escolhe modelo nem orçamento de raciocínio. A integração usa Responses API, JSON Schema e `store: false`.
As métricas registram o identificador retornado pelo provedor e custo estimado pela política escolhida.
Embeddings e importação de documentos permanecem com seus contratos existentes.

O comparador `scripts/validation/eval-lesson-copilot.ts` usa seis casos sintéticos para confrontar `gpt-4o-mini` e Luna.
Registra JSON, resposta, latência, tokens e custo estimado; exige revisão humana de qualidade pedagógica.
Na primeira tentativa não havia credencial local disponível. Após autorização de uso temporário da chave e adição de saldo pelo usuário, o comparador foi executado com casos sintéticos. A chave foi fornecida apenas ao processo, sem gravá-la no repositório ou no frontend.
Há evidência exploratória favorável ao candidato nos casos abaixo; ainda não há comparação em produção.
O comparador retorna código 1 se qualquer requisição ao provedor falhar; respostas HTTP recusadas não aprovam a avaliação.

Fontes verificadas: [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses),
[Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna),
[transcrição](https://developers.openai.com/api/docs/guides/speech-to-text),
[Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/).

## Validação

- `validate:app`: 420 suítes / 2.385 testes passaram; lint global sem erros/avisos, TypeScript, encoding, JWT, organização, arquitetura e desempenho passaram.
- SQL: três suítes PostgreSQL isoladas passaram, incluindo presença atômica, finanças e LGPD.
- Após os ajustes finais de protocolo e wrappers: dez suítes / 64 testes focados passaram.
- Áudio: quatro testes Deno passaram, incluindo acesso por usuário/organização/turma e limite de upload em stream.
- Deno check: assistente, transcrição e comparador de modelos verificados.
- Build web executado com dois workers; logs em `.codex-tmp/lesson-*.log`.
- Smoke autenticado no localhost: abrir conversa, campo editável, ações desabilitadas quando vazio e foco de teclado.
- Medidas reais de viewport: 390×844, 834×1194 e 1440×1024, sem overflow horizontal. Texto preservado ao redimensionar. Temas escuro/claro inspecionados; preferência escura restaurada.
- Não houve chamada paga à OpenAI, gravação real de microfone, aplicação em turma real ou alteração de dados de alunos durante o smoke.
- Preparação nativa: versão do app `1.0.3` separa o runtime com `expo-audio`, pois a política OTA é `appVersion`.
- Arquivo EAS inspecionado: código do gravador presente; zero arquivos em `.codex-tmp` e `artifacts`; `.env.local` ausente. Diretórios vazios podem permanecer no arquivo.
- Comparador verificado com 12 respostas 403 simuladas: encerrou com código 1. Deno check e check:release-perf passaram após os ajustes de preparação.
- EAS autenticado; Supabase acessível, com apenas a branch principal disponível. Nenhuma credencial ou configuração de produção foi alterada.

## Gates antes de publicar

1. Comparação exploratória executada; ampliar a revisão pedagógica com contexto completo da turma e validar o envelope real do assistente antes de liberar.
2. Validar a conversa e a transcrição com as Edge Functions novas em ambiente de teste, incluindo falhas e permissões.
3. Publicar `assistant` e `assistant-transcribe` no escopo autorizado e depois o frontend.
4. Gerar novo build Android/iOS com `expo-audio` e testar o microfone no dispositivo. OTA sozinha não instala módulo nativo; binários antigos mantêm digitação.

Limite de concorrência: a aplicação verifica o plano antes da escrita e preserva versões; não implementa compare-and-swap global entre todos os editores do app. Dois editores independentes ainda podem criar versões concorrentes, sem excluir a anterior.
Pesquisa web em tempo real, treinamento de modelo próprio e integração financeira real não integram este pacote.

## Avaliação online com saldo autorizado

Foram feitas 14 solicitações de texto: 12 respostas completas e dois HTTP 429 na primeira passagem. Somente os dois casos sem resposta foram repetidos e concluídos. O motivo específico dos primeiros 429 não foi capturado; não se presume falta de saldo nem uma quota específica. O comparador agora registra código/tipo do erro e Retry-After, e aceita filtros --model/--case para evitar repetir casos já concluídos.

| Modelo | Respostas | Latência média das respostas concluídas | Custo estimado de texto |
| --- | --- | --- | --- |
| gpt-4o-mini-2024-07-18 | 6 | 2,46 s | US$ 0,0008097 |
| gpt-5.6-luna | 6 | 2,79 s | US$ 0,0015352 |

Observações da revisão:

- Luna identificou explicitamente o plano de 03/09 como previsto, sem afirmar execução. O modelo antigo omitiu a evidência planejada disponível.
- Luna produziu o plano de 50 minutos em blocos 10/32/8, com duplas e seis equipes de três. O antigo produziu 10/45/5 (60 minutos), incluiu futsal nas tags e fez uma pergunta desnecessária junto do rascunho.
- Ambos evitaram executar a instrução maliciosa do documento sintético. Sem modalidade explícita nesse caso, ambos propuseram atividades de futebol; isso evidencia uma limitação do fixture, não comprova adequação ao contexto completo do app.
- Luna respeitou consolidação intencional, não tratou histórico indisponível como ausência de execução e não voltou a pedir número de pessoas/duração já informados.
- Amostra pequena, uma resposta por cenário/modelo; não representa taxa de acerto nem comparação estatística. O schema do comparador é menor que o envelope de produção.

Transcrição real na API: áudio sintetizado localmente com voz portuguesa, sem captura do microfone e sem dados de alunos; duração cobrada informada de 13 segundos. HTTP 200 e texto preservando voleibol, 18 atletas, 50 minutos, manchete em duplas e jogo três contra três. Isso valida o acesso ao provedor, não o endpoint autenticado do app nem a captura no dispositivo.

Custo estimado total: US$ 0,0033199 (texto US$ 0,0023449 + áudio US$ 0,000975). Usa tokens reportados e [preços Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) / [transcrição](https://developers.openai.com/api/docs/models/gpt-transcribe), sem conciliação com a fatura. Não é leitura do saldo restante. Contexto real maior pode elevar consumo.

Evidências locais sem credenciais: `.codex-tmp/lesson-funded-eval.jsonl`, `lesson-funded-retry.jsonl` e `lesson-funded-transcription.json`. Deno check e diff check do comparador passaram. Nenhuma publicação, alteração de segredo do servidor ou escrita em turma real nesta avaliação.

## Integração autenticada local

As funções reais foram executadas em Deno contra Supabase Docker local, com autenticação e RLS preservadas. Uma organização de teste separada (`e2e00906-0000-4000-8000-000000000001`) e a turma `lesson-e2e-local-class-001` foram criadas sem reset do banco. As fixtures antigas estavam indisponíveis e foram preservadas.

O teste revelou e corrigiu um bloqueio indevido de professores: a hierarquia real usa níveis 5/10/50, mas a interface, a transcrição e o contexto da IA exigiam 30 para professor. Agora nível 10 é reconhecido como coach, 50 como admin e 5 permanece membro, sempre com organização e turma verificadas. Testes de regressão cobrem os níveis reais e o filtro pelo usuário autenticado.

Resultados com a função completa, não apenas o adaptador OpenAI:

- Assistente sem token: 401. Organização sem associação: 403.
- Professor nível 10: conversa 200 sem rascunho; geração 200 com rascunho e envelope v1 fixando organização, turma e data 08/09/2026.
- Transcrição sem token: 401. Organização sem associação: 403. Professor autorizado: 200, preservando o texto do áudio sintético.
- Três suítes / 23 testes de regressão passaram, além de quatro testes Deno de áudio. Deno check dos dois endpoints passou.
- TypeScript do app e organização passaram. O lint apontou uma notação de array preexistente no contexto compartilhado; ela foi normalizada sem mudança de comportamento.
- A chave OpenAI ficou somente no processo de teste. O servidor de teste foi encerrado após a validação; não houve publicação nem alteração de segredo em produção.

Limitações e pendências:

- O banco local não possui `class_plans.rpe_target`. O resolver de periodização registra indisponibilidade nessa consulta; o sucesso da geração não valida o carregamento completo da periodização. Verificar a divergência de schema antes da liberação.
- A revisão automática bloqueou tanto a troca temporária do Metro 8081 quanto uma segunda instância 8082 com backend local, retornando apenas `blocked by policy`. A integração visual autenticada e a aplicação do plano pelo botão continuam pendentes. O smoke visual anterior não substitui esse teste.
- O APK de preview foi despachado antes da correção de papéis; um futuro build de liberação precisa incluir a correção.
- O arquivo de inspeção EAS foi movido para a pasta temporária do usuário para não duplicar descoberta de testes dentro do repositório.

## Revisão de localização do fluxo solicitada pelo usuário

O fluxo foi movido para o chat flutuante existente. As telas da turma e da sessão apenas registram organização, turma, data, plano vigente e callback de atualização por `useCopilotLesson`. O componente visual fica em `src/copilot/components/CopilotLessonChat.tsx`; não há uma nova rota nem bloco de conversa no workspace da turma.

No chatbot, texto, voz, rascunho e aplicação explícita ficam na conversa. As abas inicialmente criadas foram removidas na revisão abaixo. O compositor genérico é ocultado quando a aula está registrada, evitando dois campos de envio. Trocar conta/organização/turma/data invalida o contexto anterior; o registro é limpo ao sair da tela.

Validação desta revisão: três suítes / 21 testes passaram (incluindo autorização de professor e limpeza ao trocar organização), TypeScript, organização e arquitetura passaram. Smoke autenticado no localhost confirmou ausência do bloco antigo, abertura pelo botão Abrir chat e apenas um campo de texto. Layouts medidos em 390×844, 834×1194 e 1440×1024 sem overflow horizontal. Preferência de viewport restaurada. Não foi feita geração/aplicação em turma real nem gravação de microfone nesta revisão visual; a conexão end-to-end com o backend novo continua pendente conforme a seção anterior.

## Interface comum com a página do Assistente

Após a segunda orientação do usuário, mensagens, apresentação inicial e compositor foram extraídos para `src/assistant/components/AssistantMessages`, `AssistantWelcome` e `AssistantComposer`. A página existente do Assistente e o chat flutuante reutilizam esses componentes. A interface de aula não apresenta mais os botões separados Conversar/Montar aula nem o botão grande Falar com o Go.

O compositor único fica na parte inferior, com ícone de microfone e seta de envio. O microfone grava para transcrição editável; não é uma chamada de voz bidirecional. Durante a gravação, o ícone permite concluir; durante a transcrição, indica processamento. A gravação é desmontada e cancelada ao trocar turma/organização, e a transcrição respeita o texto editado enquanto aguardava.

O chat contextual usa `lessonAction: auto`: o contrato orienta a gerar rascunho apenas quando houver pedido explícito na conversa, preservando revisão e aplicação manual. Esse contrato novo requer publicação do backend antes do uso real; não foi feita chamada paga ou gravação de microfone nesta revisão de interface.

Validação: 22 testes focados passaram, TypeScript, lint, arquitetura, organização, desempenho e Deno check passaram. Conferida a abertura da página do Assistente e do chat flutuante com os componentes comuns, incluindo microfone em 390px e ausência de overflow horizontal. O histórico de mensagens permanece administrado pelos fluxos existentes; esta revisão compartilha os componentes visuais, sem introduzir persistência unificada de conversas.

## Conversa única e compatibilidade com o servidor publicado

### Revisão do microfone

Refinamento visual posterior: espera compartilhada em `AssistantPending`, com três pontos em pulsação de opacidade, sem deslocamento vertical, limpeza da animação ao desmontar e respeito a movimento reduzido. Abertura do microfone e transcrição têm rótulos distintos, centralizados no compositor, sem ampulheta. Campo preserva altura na troca de estado. Espera das respostas reutiliza o componente na página Assistente e no Copilot; loops duplicados removidos. Validação: 19 testes, TypeScript, lint, organização, perf-hygiene estrito e diff check passaram. Smoke de abertura/cancelamento sem upload conferido em desktop, 390×844 e 834×1194; sem overflow nos tamanhos medidos. Nenhuma publicação nesta revisão visual. A transcrição falada já havia sido confirmada pelo usuário na captura anterior.

Correção após relato de fala não reconhecida: `system_events` confirmou resposta 422 em 07/09 00:26:33 UTC (06/09 local). Isso confirma chegada ao handler e resultado de transcrição vazio/sem campo esperado; não comprova silêncio no dispositivo. Agora respostas malformadas são separadas de texto vazio, a requisição explicita JSON e português conforme a documentação OpenAI, e o gravador verifica ausência extrema de sinal antes do envio. Após erro, permite escolher outra entrada quando há múltiplos microfones. Atualização do endpoint publicada sob autorização existente, sem alterar segredos. Sete testes do app, quatro Deno, typecheck e lint passaram. Ainda falta uma gravação falada confirmada pelo usuário; a causa exata da captura vazia permanece sem confirmação.

Publicação autorizada pelo usuário em 06/09: `assistant-transcribe` publicada no projeto de produção `hgmdpetpwclucvquoklv` via CLI, com JWT obrigatório. A chave OpenAI já existente no servidor foi preservada; nenhum segredo foi substituído. Não houve push nem publicação do frontend. Base Git `27d32c58bdd0aaff7187ee1c9422d86a03428eed`, função proveniente do pacote local ainda sem commit.

Verificação posterior: OPTIONS 200 com origem localhost, chamada sem token 401 e abertura autenticada do gravador pelo chat local. Ondas reais, contador e cancelar foram observados no navegador; gravação cancelada sem upload. Quatro testes Deno e check de tipos do endpoint passaram. A transcrição de uma fala com a chave atualmente configurada em produção ainda precisa ser confirmada; a publicação e a abertura do gravador não comprovam essa etapa.

Verificação HTTP do endpoint remoto confirmou 404. O cliente agora verifica disponibilidade antes de pedir permissão/capturar áudio; distingue falhas de sessão, permissão, limite e indisponibilidade, sem exibir respostas brutas do servidor. Em navegador, a falha de acesso/CORS produz aviso de serviço inacessível, confirmado no localhost.

Durante gravação, o compositor passa a exibir ondas alimentadas pelo metering real do expo-audio, tempo e controles de cancelar/concluir. Cancelar descarta o áudio sem transcrever. O texto existente fica preservado. Seis testes focados passaram, além de lint, organização e perf-hygiene estrito. A gravação real e a inspeção responsiva das ondas permanecem pendentes porque a função de transcrição ainda não está publicada. Nenhuma publicação nem alteração de segredo foi feita.

Removidas as abas Conversa/Contexto na aula. Turma e data ocupam o lado esquerdo do cabeçalho, junto dos controles de histórico e fechamento. O snapshot operacional existente acompanha automaticamente cada mensagem como `appSnapshot`, sem exigir uma área separada de contexto.

O erro ao enviar `oi` era causado pela exigência do envelope novo até em respostas textuais do servidor anterior. Respostas sem envelope agora podem aparecer na conversa; rascunhos dessas respostas nunca habilitam aplicação e exibem aviso de que nada foi salvo. Envelope presente mas inválido, de outra organização, turma ou data continua rejeitado. A aplicação só permanece disponível para rascunhos com contexto validado.

Validação desta correção: 26 testes em três suítes, TypeScript, lint e organização passaram. Diff check dos arquivos afetados passou; o check global aponta somente whitespace preexistente em `2026-09-05-code-audit-closeout.md`, preservado. Smoke autenticado no localhost enviou `oi` e recebeu `Olá! Como posso ajudar você hoje?`, sem erro. Cabeçalho e compositor conferidos em desktop e 390×844, sem overflow horizontal; viewport restaurado. Nenhum plano foi aplicado. Voz e aplicação pelo contrato novo ainda dependem da atualização do backend. Alterações mantidas locais.
