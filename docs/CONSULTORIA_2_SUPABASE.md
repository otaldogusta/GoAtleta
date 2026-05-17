# CONSULTORIA 2 - Supabase canonico

## Objetivo

O CONSULTORIA 2 transforma o piloto local da consultoria online em persistencia canonica no Supabase, preservando o fallback local para ambientes onde a migration ainda nao foi aplicada ou onde a sessao/organizacao nao esta disponivel.

## Tabelas

- `consultation_profiles`: perfil individual de treino da aluna.
- `prescribed_workouts`: treinos prescritos pelo professor.
- `prescribed_exercises`: exercicios da ficha do treino.
- `workout_execution_logs`: execucoes enviadas pela aluna.
- `completed_exercise_logs`: exercicios marcados dentro de uma execucao.

Os ids sao `text`, nao `uuid`, para manter compatibilidade com os ids ja criados pelo dominio local do piloto.

## Fluxo professor

1. Seleciona ou cria a aluna do piloto.
2. Salva o perfil de treino.
3. Cria ou edita a prescricao.
4. Salva/publica o treino no Supabase.
5. Ve execucoes recebidas.
6. Marca a devolutiva como revisada.

Se Supabase nao estiver disponivel, a tela continua usando o fallback local controlado do CONSULTORIA 1.

## Fluxo aluna

1. Le treinos publicados.
2. Conclui o treino.
3. Envia PSE, dor e observacao.
4. O log fica disponivel para revisao do professor.

## Repositorio

`src/db/consultation.ts` e a camada unica usada pelas telas. Ela tenta Supabase primeiro e recorre ao fallback local quando encontra:

- migration ainda ausente;
- sessao expirada;
- erro de rede;
- bloqueio de RLS/permissao.

Funcoes expostas:

- `saveConsultationProfile`
- `getConsultationProfileByStudent`
- `savePrescribedWorkout`
- `publishWorkout`
- `deletePrescribedWorkout`
- `listPublishedWorkoutsForStudent`
- `saveWorkoutExecutionLog`
- `submitWorkoutExecution`
- `listExecutionsForCoach`
- `markExecutionLogReviewed`

## RLS e permissoes

A migration habilita RLS e permite acesso apenas a membros da organizacao. Policies especificas para o papel da aluna ficam para o CONSULTORIA 7, porque dependem do contrato final de login/vinculo aluno-professor.

Nao foi criada policy aberta para anon.

## Fica para os proximos pacotes

- CONSULTORIA 3: historico e progresso.
- CONSULTORIA 4: notificacoes internas/push.
- CONSULTORIA 5: midia de exercicios.
- CONSULTORIA 6: relatorio/devolutiva.
- CONSULTORIA 7: permissoes robustas aluno/professor.
