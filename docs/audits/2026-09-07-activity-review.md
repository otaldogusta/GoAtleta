# Revisão proativa de períodos sem chamada

Implementado em 07/09/2026. Frontend validado no localhost:8081; sem commit ou publicação do frontend.

- Detecta pelo menos três datas previstas consecutivas sem registro de chamada nos últimos 28 dias, excluindo hoje, datas anteriores à criação/ciclo e pausas conhecidas. Exige alunos vinculados à turma.
- Ausência de chamada não significa falta dos alunos. Qualquer chamada registrada interrompe a sequência.
- Coordenação revisa turmas, período e motivo: férias/recesso, suspensão ou aulas realizadas. Somente Confirmar grava. Aulas realizadas mantêm chamadas pendentes; pausas confirmadas criam exceções de calendário sem apagar registros existentes.
- A confirmação alimenta os consumidores existentes de exceções de calendário e o contexto do assistente. A detecção não faz chamadas a modelos.
- Limites: horários atuais, sem reconstrução de versões históricas; janela de detecção de 28 dias; confirmação de até 93 dias. O alerta não diagnostica evasão nem assume férias.

## Backend aplicado

- Migração `20260907234850_organization_activity_reviews.sql`: tabela com RLS e RPC restrita à administração da organização, validação das turmas, transação e idempotência.
- Assistente ativo v59, JWT preservado. Publicação construída a partir dos arquivos remotos v58, alterando somente a inclusão de contexto de calendário e o novo helper; outras dependências remotas preservadas.
- Nenhuma revisão de período real foi gravada durante os testes.

## Validação

- Testes do detector, contexto do assistente e painel passaram. O teste do painel confirma que abrir/escolher motivo não grava e que aulas realizadas não inventam presença.
- Migração executada em PGlite: autorização, isolamento, limites, idempotência, preservação de exceções manuais e bloqueio de escrita direta.
- Typecheck, org-scope, perf-hygiene strict, lint dos arquivos novos, build web e diff-check dos arquivos alterados passaram.
- Smoke autenticado: aviso real com duas turmas, abertura do painel, seleção de motivo, botão Confirmar habilitado e fechamento sem gravação. Inspeção visual desktop e mobile; viewport restaurado.
