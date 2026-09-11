# Recomendação de feriado na Home

Implementação local para a coordenação. Feriados nacionais fixos são identificados pelo calendário, no fuso America/Sao_Paulo, sem chamada ao modelo. Não contempla feriados municipais nem pontos facultativos.

O aviso oferece manter as aulas, suspender todas ou escolher turmas. Suspensão exige confirmar a lista. Nenhuma decisão é tomada automaticamente. A primeira decisão é registrada por organização/data, com autor e horário; repetições iguais são idempotentes e decisões concorrentes diferentes exigem recarregar. Ajustes posteriores de dias sem treino continuam no calendário de exceções existente.

A migração `20260907214642_organization_holiday_decisions.sql` adiciona uma tabela e uma função com autorização de administrador. A função valida data e turmas da organização, grava decisão e exceções na mesma transação. Não altera segredos, registros de chamada, relatórios ou pausas manuais. Não substitui RLS. A leitura de decisões é exclusiva de administradores; gravações diretas estão revogadas.

Home, calendário e consultas de pendências passam a respeitar `class_calendar_exceptions`. Pendências de relatórios permanecem para outros dias previstos na janela de sete dias: suspender hoje não quita atrasos anteriores. O contexto do assistente que utiliza essas consultas recebe as pendências filtradas.

## Ativação

Migração aplicada no projeto hgmdpetpwclucvquoklv após autorização explícita do usuário, versão 20260907214642. Verificação remota confirmou RLS ativa, leitura anônima bloqueada, INSERT direto bloqueado e execução anônima da função bloqueada. Nenhuma decisão foi gravada durante a validação.

Home autenticada recarregada em localhost:8081/coord/dashboard: aviso de Independência do Brasil e as três opções visíveis. Aparência conferida em 1360x914. Validação visual em outras larguras e gravação com uma decisão real ainda não executadas. Frontend permanece local, sem publicação.

## Validação local

- PostgreSQL em memória (PGlite): autorização, organização, data, dias da turma, idempotência e preservação de exceção manual.
- Testes Jest de feriado, filtro de chamadas e consultas de relatórios.
- Typecheck e org-scope.
- Perf-hygiene estrito e diff check dos arquivos deste pacote.
- Home autenticada com o aviso visível no localhost.
