# Aulas, presença, NFC e exportações

Base inspecionada: `d5120cff`, em 05/10/2026. Mapa do código local do Go Atleta;
leituras não comprovam sincronização remota, hardware ou uso em aula.

## Responsabilidade e fluxo

A aula datada relaciona plano, execução, chamada e relatório. A frequência manual
e o check-in NFC têm persistências distintas; exportações apresentam recortes
operacionais. O scanner QR existente é uma ferramenta mobile de leitura de conteúdo.

## Onde começar

| Arquivo | Responsabilidade |
| --- | --- |
| [session.tsx](../../../app/class/[id]/session.tsx) | Composição da aula e relatório por turma/data. |
| [useSessionData](../../../src/screens/session/hooks/useSessionData.ts) | Carregamento do contexto da aula. |
| [useSessionReport](../../../src/screens/session/hooks/useSessionReport.ts) | Estado, rascunho e gravação do relato. |
| [session.ts](../../../src/db/session.ts) | Persistência de relatórios e sincronização com sessão. |
| [training-sessions.ts](../../../src/db/training-sessions.ts) | Sessões estruturadas e plano aplicável à data. |
| [ClassAttendanceWorkspacePanel](../../../src/screens/classes/components/ClassAttendanceWorkspacePanel.tsx) | Chamada integrada ao workspace da turma. |
| [use-embedded-class-attendance.ts](../../../src/screens/attendance/use-embedded-class-attendance.ts) | Carregamento, edição e salvamento da presença. |
| [attendance-roster.ts](../../../src/screens/attendance/attendance-roster.ts) | Alunos visíveis e preservação de registros não exibidos. |
| [attendance-checkins.ts](../../../src/data/attendance-checkins.ts) | Check-in NFC, idempotência e entrega pendente. |
| [nfc.ts](../../../src/nfc/nfc.ts) | Leitura NFC e diferenças de plataforma. |
| [qr-scan.tsx](../../../app/qr-scan.tsx) | Câmera mobile, resultado, copiar e abrir URL HTTP(S). |
| [attendance-export.ts](../../../src/screens/classes/application/attendance-export.ts) | Filtros, detalhes e totais da exportação. |
| [pdf/templates](../../../src/pdf/templates/) | Documentos de presença, lista da turma, plano e relatório. |

## Contratos a preservar

- Aula e relatório usam turma/data explícitas. O rascunho do relatório é versionado
  e separado por usuário/organização/turma/data; rascunho local não é envio concluído.
- O relatório sincroniza a sessão estruturada pelo caminho existente; plano gerado,
  plano aplicado e execução concluída permanecem estados diferentes.
- Presença não marcada continua `undefined`; não converter alunos ainda não
  marcados em falta por efeito de renderização ou leitura incompleta.
- Ao salvar a chamada visível, preservar registros carregados de alunos ocultos;
  alunos com registro naquela data permanecem acessíveis no recorte histórico.
- A data inicial procura a aula agendada recente ainda incompleta, considerando
  criação dos alunos. Alterações posteriores passam pela guarda de data da chamada.
- Check-in NFC conserva organização/turma/aluno e chave idempotente por data UTC
  no helper atual. Entrega `pending` e `synced` precisa ser distinguida na interface.
- Somente erros transitórios previstos entram na fila NFC; erro de autorização
  não é sucesso offline. Presença de `NDEFReader` não prova hardware compatível.
- Vincular tag é ação administrativa; não reassociar tag ocupada silenciosamente.
- O scanner QR atual não grava presença: exibe conteúdo e permite copiar/abrir URL.
  Não descrever QR como alternativa completa ao check-in NFC sem implementação.
- Exportação mantém filtros de período, turma, professor, aluno e vínculo; não
  perder registros históricos de alunos inativos ou não localizados.

## Decisões atuais e histórico

O [overview NFC](../../../docs/nfc/overview.md) é a referência operacional atual.
A [refatoração arquivada](../../../docs/archive/nfc/NFC_ARCHITECTURE_REFACTOR.md) é
proposta/histórico; não comprova adoção de toda arquitetura sugerida.
O vínculo NFC aparece na chamada; a rota independente permanece para compatibilidade.
O [assistente de planejamento](../../../docs/operations/planning-assistant-local.md)
consome execução oficial e indicadores agregados; narrativa de relatório não deve
ser encaminhada indiscriminadamente como contexto externo.

Em 06/10/2026, o [visual aprovado do relatório](../../ui/RELATORIO_AULA_2026-10-06.md)
foi aplicado em `SessionReportTab`, com galeria visível e ações fixas no modal.
O card do plano saiu da interface; o fallback de atividade ao salvar/exportar
continua no fluxo existente. Galeria vazia (`[]` ou string vazia) é equivalente
na comparação do rascunho. Exemplos sintéticos ficam apenas no mockup.
Participantes no modal vêm exclusivamente da chamada da aula: sem chamada, ficam
ausentes, inclusive na gravação e no PDF, sem campo manual ou estimativa. Contagens
manuais de relatórios/rascunhos antigos não são reutilizadas nesse fluxo; zero
presentes em uma chamada registrada continua diferente de ausência de chamada.
O PDF do relatório segue o nome legível da chamada (documento, turma, dias,
horário e período), usando a data da aula no último segmento. Ambos usam
`src/pdf/class-document-file-name.ts` para preservar o mesmo formato e sanitização.

O [histórico aprovado](../../ui/HISTORICO_RELATORIOS_2026-10-06.md) foi aplicado
localmente: acesso Histórico junto ao Relatório e link nos três recentes. O modal
filtra por ano/mês e texto, agrupa aulas e reutiliza o editor datado sem mudar a
data da turma. `src/db/session-report-history.ts` pagina resumos sem fotografias,
exige usuário/organização/turma e fixa a identidade; `useClassReportHistory`
descarta respostas após troca de escopo. A lista renderiza 30 aulas por vez;
busca/filtros abrangem todos os resumos. Voltar preserva lista e rascunho local.
A hidratação/gravação do rascunho aguarda o relatório remoto, mesmo se a chamada
carregar antes, para não restaurar um relato vazio gerado durante o carregamento.
`/class/[id]/log` continua sendo editor legado por data. Pacote autorizado para
integração na `main` pela esteira Vercel/EAS; prontidão remota é conferida por commit.

## Validação seletiva

Testes existentes, a selecionar em mudanças funcionais:

- [relatório](../../../src/screens/session/hooks/__tests__/useSessionReport.test.ts),
  [sessões](../../../src/db/__tests__/training-sessions.test.ts) e
  [data inicial](../../../src/screens/attendance/__tests__/resolve-initial-attendance-date.test.ts).
- [roster](../../../src/screens/attendance/__tests__/attendance-roster.test.ts),
  [check-ins](../../../src/data/__tests__/attendance-checkins.test.ts),
  [fila NFC](../../../src/db/__tests__/pending-writes-nfc.test.ts) e
  [Web NFC](../../../src/nfc/__tests__/nfc-web.test.ts).
- [exportação](../../../src/screens/classes/application/__tests__/attendance-export.test.ts) e
  [artefatos PDF](../../../src/pdf/templates/__tests__/attendance-summary-artifacts.test.ts).

Consultar a [escada](../../../docs/operations/validation-ladder.md); validar chamada
autenticada no localhost e NFC/QR em dispositivo quando afetados. O levantamento
original de 05/10 não executou testes; a aplicação visual de 06/10 registra suas
evidências e limites no documento do relatório acima.
