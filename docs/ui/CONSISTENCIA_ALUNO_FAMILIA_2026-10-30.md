# Consistência de Aluno e Família — 30/10/2026

**REGISTRO LOCAL — recortes conferidos, sem aceite do usuário.** Esta rodada
aplica a composição operacional de Agenda/Studio/Plataforma a Aluno e Família.
Cards, padding, margens, gaps, ações e hover são tratados em conjunto. O
[registro histórico por papel](DENSITY_ROLES_2026-10-30.md) permanece delimitado e
rejeitado quanto à composição. O [refinamento da Plataforma](CONSISTENCIA_PLATAFORMA_2026-10-30.md)
é uma rodada distinta; suas imagens não são reutilizadas como antes/depois aqui.

## Escopo e ambientes

- Código de origem em `031b`; runtime em `577e`.
- O `localhost:8081` recebeu o smoke final do Aluno. Os novos pares
  desta rodada usam `localhost:8082`, Auth/RPC reais do Supabase local em
  loopback `54321`, contas e dados sintéticos. Não equivalem a Auth/RLS
  hospedados ou contas de produção.
- As imagens originais ficam privadamente em `.tmp/student-family-composition-20261030/`.
  O gerador revisado lê imagens/contexto e escreve somente HTML/manifesto,
  com hashes dos originais, sem transformar imagens, acessar rede ou publicar.
- Os 22 pares completos são das 11 superfícies listadas abaixo, cada uma em
  390/1440. Inspeções de 320/834, hover, foco, vínculo restrito, boas-vindas e
  menus ficam separadas e não entram na contagem dos pares de páginas.
- Sem publicação, migração remota ou ampliação de permissões neste escopo.

A regra canônica continua em [Proporção dos elementos](RESPONSIVE_RULES.md#proporção-dos-elementos).
Pintura de controle e alvo de toque são independentes; campos especializados,
escala de texto, foco, teclado e safe areas conservam seus contratos. Não se
aplica zoom de página, escala global ou bloqueio da ampliação de texto.

## Composição e recortes conferidos

| Superfície | Alteração/estado delimitado | Conferência nesta rodada |
| --- | --- | --- |
| [Início do Aluno](../../src/screens/student/StudentAthleteHome.tsx) | Treino com altura pelo conteúdo, informação e ação em linha quando cabem; dias compactos, CTA tonal de conteúdo, hover neutro sem escala. | Antes/depois em 390/1440. Boas-vindas e ações rápidas em 390. Ver detalhes preservou classId/date ao abrir student-plan. |
| [Conquistas](../../app/student-badges.tsx) | Mês/pontuação em linha; badges sem mínimo de 80 px, nome/meta em linha com wrap. Último refino evitou três linhas persistentes: aproximadamente 62 px de altura, pelo conteúdo. | Antes/depois em 390/1440; sem mudar pontos, critérios ou estado conquistado. |
| [Plano](../../app/student-plan.tsx) | Teto de leitura de 960 px, etapas agrupadas com separadores e ação de ausência por conteúdo. | Antes/depois em 390/1440 no estado vazio sem parâmetros. Etapas de plano publicado não exercitadas. |
| [Scouting](../../app/student-scouting.tsx) | Teto de 960 px, grade no desktop, ação Salvar por conteúdo, contraste desabilitado e hover contido. | Antes/depois em 390/1440 fora da janela ativa de treino; contraste de Salvar desabilitado conferido. Envio ativo e gravação não exercitados. |
| [Consultoria](../../app/student-consultation.tsx) | Ações por conteúdo e controles com pintura de 32 px/alvo de 44 px preparados no código. | Antes/depois em 390/1440 sem treino publicado. Fluxo publicado, PSE/dor e envio não exercitados. |
| Perfil do Aluno | Visão geral compartilhada, com identidade e rascunhos preservados. | Antes/depois em 390/1440. Nenhum perfil foi salvo. |
| Configurações do Aluno | Cabeçalhos de seção46 com padding de 6×8 px; campos de 50 px preservados. | Antes/depois em 390/1440 com Dados aberto; inspeções recolhidas em 320/834 sem overflow. Tab em Responsável manteve outline visível de 1 px e sem transform. |
| [Início da Família](../../src/screens/family/FamilyHomeScreen.tsx) | Atividade, resumo de frequência em linha e atalhos de conteúdo; composição conforme capacidade do viewport. | Antes/depois em 390/1440 e seletor em 390. |
| [Agenda familiar](../../src/screens/family/FamilyAgendaScreen.tsx) | Cartões e ações nas métricas operacionais. | Antes/depois em 390/1440; hover de Agenda com alvo de 44 px/pintura de 32 px, fundo neutro e sem transform. |
| [Pagamentos](../../src/screens/family/FamilyPaymentsScreen.tsx) | Indicadores com rótulo/valor em linha, mínimo de 160 px e wrap. Refino corrigiu palavra quebrada em 320. | Antes/depois em 390/1440; uma coluna em 320, duas em 390 e inspeção em 834 px sem overflow. Sem operação financeira. |
| [Perfil familiar](../../src/screens/family/FamilyProfileScreen.tsx) | Cards, ações e seletor coerentes com o restante do papel, preservando capacidades. | Antes/depois em 390/1440; sem convite ou gravação. |

[StudentUi](../../src/screens/student/StudentUi.tsx) e
[FamilyUi](../../src/screens/family/FamilyUi.tsx) usam as métricas/cores existentes;
não importam o domínio da Plataforma. Em Ver detalhes, o navegador confirmou
alvo de 44 px/pintura de 32 px, tonal alpha 0.2 e ausência de escala no hover.
Os tamanhos são CSS/pontos lógicos do viewport, não pixels de uma imagem redimensionada.

## Validação e limites

| Conjunto | Resultado local registrado | Limite |
| --- | --- | --- |
| Aluno | 11 testes em 4 suítes: student-home-menu, student-home-training-navigation, student-achievements e student-standalone-workspace-shell. Lint/diff aprovados; auditoria AST conservou callbacks onPress e chamadas de dados/estado nas cinco fontes existentes. Recibos em `.tmp/student-composition-20261030/`. | Ajustes finais de teto/grade e wrap dos badges são somente layout; suítes de comportamento reaproveitadas. Não substitui o smoke. |
| Perfil/ações rápidas do Aluno | 23 testes em 4 suítes: PersonProfilePage, profile-unsaved-feedback, tab-config e bottom-tab-navigation; lint/diff aprovados. Recibo em `.tmp/student-profile-composition-20261030/validation.json`. | O recibo do especialista antecede o smoke do agente principal; os recortes renderizados finais estão neste registro e em root-final-validation.json. |
| Família | 9 testes em 2 suítes: family-request-races e family-access-actions. Lint/diff aprovados; hooks de finanças/convite preservados. Recibo em `.tmp/family-composition-20261030/validation.json`. | Refino literal dos indicadores reaproveitou testes de comportamento; não é validação financeira hospedada. |
| Tipagem e escopo | O agente principal confirmou typecheck:app aprovado (chunk 74eb59) e check:org-scope aprovado (chunk 9fc1aa). Três patches aplicados no runtime (chunk 77fee9); lint final dos três arquivos refinados aprovado (chunk 284540). | Últimos refinamentos de wrap dos badges e indicadores financeiros alteraram somente estilo; sem callback/tipagem. Não houve build de release ou certificação nativa. |
| Leitura/contexto | Bruno restrito continuou sem valores financeiros; ao voltar para Ana autorizada, apareceram suas duas cobranças. Ver detalhes do Aluno preservou classId/date da ocorrência de 30/10. | Nenhum pagamento, convite, salvamento de scouting, feedback ou perfil executado. |

Preferência visual não concede capacidade; finanças dependem da projeção
autorizada do vínculo. Os recortes exercitaram Auth/RPC reais locais com dados
sintéticos. Não certificam todas as telas, estados com conteúdo publicado,
backend hospedado, motion, build nativo ou performance de produção. A presença
de imagens e testes passando não concede aceite visual automático.

Os resultados são registrados por grupo, sem somar contagens históricas. O recibo
privado `root-final-validation.json` reúne escopo, dimensões, limites e prova da
rodada principal.

## Estado do ambiente

O agente principal confirmou o encerramento somente do frontend QA8082
(processo 15628), sem listener restante; Supabase e fixtures sintéticas foram
preservados. O localhost8081 continuou ativo (processo 12292). A sessão voltou
para Coordenação em `/coord/dashboard`, viewport foi resetado e a aba 8 ficou
aberta. Recibo privado: `cleanup-proof.json`.

O smoke final do Aluno no localhost8081 foi inspecionado em 390/1440, com largura
da página igual à largura rolável nos dois tamanhos, sem overflow horizontal.
Nenhuma captura dessa sessão real entrou na galeria por privacidade; seus pares
continuam exclusivamente do QA8082 sintético. Recibo: `main-student-smoke.json`.
As 19 fontes do produto são equivalentes nos dois roots ao normalizar CRLF
(chunk 179664); diffs finais passaram (chunk 8075c6). Sem commit, push ou deploy.
