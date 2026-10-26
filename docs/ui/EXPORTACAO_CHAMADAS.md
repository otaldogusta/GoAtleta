# Exportação de chamadas por turma

Pacote de 26/10/2026, com publicação na main autorizada pelo usuário. Sem mudanças de banco.

## Composição

O PDF A4 paisagem começa com indicadores e resumo das turmas. Depois, cada turma
ocupa páginas próprias, com todos os seus meses em ordem antes da próxima turma.
Cabeçalho: nome, unidade, grupo, local, horário e dias, faixa etária, nível e
professores. Horários e nível seguem a apresentação da lista de turmas; estes
metadados representam a configuração atual, não uma reconstrução histórica.

A grade mensal mostra atletas em ordem alfabética, vínculo atual, datas,
presenças e faltas. `P` significa presente, `F` faltou e `-` ausência de registro
no recorte. Não inferir falta a partir de matrícula, calendário ou célula vazia.
Identidades de turma e aluno usam IDs para preservar homônimos.

Meses extensos são divididos em até 12 datas por página. A paginação vertical
reserva linhas adicionais para nomes longos, repetindo a identificação completa,
o mês, as datas e a legenda; nenhuma linha é truncada. Os totais P/F por atleta
representam o mês inteiro do recorte e se repetem nas partes, como informa a
legenda. O XLSX conserva registros individuais e adiciona os mesmos metadados nas
abas por turma; Contexto e Resumo permanecem disponíveis.

## Filtros e limites

Preservados período, unidade, turma, professor, atleta, presença e vínculo.
Os indicadores gerais mantêm o cálculo anterior ao filtro de presença; a nota
do resumo explica isso. Grades e seus totais incluem apenas os registros
exportados. Não adicionar notas, dados de saúde, financeiro ou fotos ao documento.

## Evidência local

Testes focados cobrem metadados, meses/anos, homônimos, célula sem registro,
paginação com 35 atletas e 31 datas, preservação de cada marcação e XLSX reaberto.
Amostra fictícia gerada pelo renderer real (`node scripts/validate-attendance-artifacts.mjs --review`),
com 33 atletas em uma turma, 18 datas por mês, duas turmas e dois meses. Páginas
renderizadas e inspecionadas localmente; artefatos em `.tmp/attendance-review/`,
fora do Git. Isso não confirma o download pelo fluxo autenticado do navegador.

Fontes: `src/screens/classes/application/attendance-export.ts`,
`attendance-export-groups.ts`, `src/pdf/attendance-summary-document.web.tsx` e
`src/pdf/templates/attendance-summary.ts`.

## Sincronização do localhost

Em 26/10, a implementação foi copiada do checkout 031b para o 577e que atende
localhost:8081, após confirmar ausência de alterações concorrentes nesses arquivos.
A página precisou ser recarregada para abandonar o módulo PDF já carregado.
Download autenticado confirmado: chamadas-organizacao-2026-10-01-2026-10-26 (2).pdf,
15 páginas. Página de Hipopótamos renderizada e inspecionada: horário, dias,
idade/nível e grade mensal com P/F. 23 testes focados e tipos passaram.
A publicação ocorre pela integração Git da main; confirmação do deploy e CI permanece separada das evidências locais.

Conferência adicional: fluxo global com Todos os professores, Todas as unidades,
Todas as turmas e intervalo 01/09/2026–30/09/2026 gerou o PDF novo de 12 páginas,
712 registros e seis turmas com chamadas no período. Resumo e página mensal
de Hipopótamos foram renderizados e inspecionados. Não foi necessário alterar
o exportador individual da turma; a investigação desse caminho foi descartada
após o usuário confirmar o fluxo global.

## Preparação da release

O pacote inclui exportação consolidada, DateInput e retenção da navegação web.
A validação de release usa build:verified. O checkout de validação exigiu npm ci
para restaurar os patches já versionados do decoder e Expo Router. Não foi
necessária mudança na configuração Jest nem troca de dependências.
Nenhuma migration, Edge Function ou variável de ambiente integra esta alteração.
O push da main aciona Vercel e os workflows existentes, inclusive EAS após CI.
Artefatos de downloads e capturas ficam ignorados e fora do commit.
