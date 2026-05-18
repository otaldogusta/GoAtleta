# CONSULTORIA 3 - Historico e progresso

## Objetivo

O CONSULTORIA 3 transforma execucoes de treino em acompanhamento simples, sem dashboard pesado e sem conclusoes agressivas com poucos dados.

## Summary

Foi criado `ConsultationProgressSummary` no dominio core.

Campos:

- `studentId`
- `workoutsPublished`
- `workoutsCompleted`
- `adherencePercent`
- `averageRpe`
- `averagePain`
- `lastCompletedAt`
- `attentionFlags`

Flags:

- `initial_history`
- `high_pain_recent`
- `high_rpe_recent`
- `low_adherence`

## Regras conservadoras

- Menos de 3 execucoes marca `initial_history`.
- Dor alta recente: dor >= 7 nas ultimas 3 execucoes.
- PSE alta recente: PSE >= 8 nas ultimas 3 execucoes.
- Baixa adesao: menos de 60%, apenas quando ha pelo menos 3 treinos publicados/concluidos no historico.
- Sem execucoes, medias aparecem como vazio, nao como tendencia.

## UI professor

A aba `Evolucao` em `/consultation` agora mostra:

- adesao;
- PSE medio;
- dor media;
- ultima execucao;
- pontos de atencao;
- ultimos feedbacks.

## UI aluna

A tela `/student-consultation` mostra um resumo simples:

- treinos concluidos;
- adesao;
- historico inicial quando ainda ha poucos dados;
- PSE medio e dor media quando houver dados suficientes.

## Fora de escopo

- Grafico historico.
- Snapshots de progresso.
- Relatorio/PDF.
- Notificacoes.
- Ajuste semanal assistido.
- Interpretacao automatica forte.
