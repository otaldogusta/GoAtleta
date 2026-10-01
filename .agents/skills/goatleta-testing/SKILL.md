---
name: goatleta-testing
description: Escolher e executar validação proporcional para mudanças do Go Atleta, incluindo testes de domínio, persistência, autorização e fluxos web críticos.
---

# Validação do Go Atleta

Resolver caminhos na raiz. Ler primeiro `docs/operations/validation-ladder.md` e os scripts atuais de `package.json`. Não impor toda a esteira a cada feature ou microajuste.

| Mudança | Evidência indicada |
| --- | --- |
| Texto/estilo local | Diff e conferência direta; teste focado existente quando útil |
| Regra pura | Jest do módulo com caso normal, limite e regressão |
| Estado/formulário | Teste focado, tipos e interação local afetada |
| Persistência/RLS | Testes de integração/SQL e casos negativos de organização |
| Fronteira entre camadas | Guardrail arquitetural e teste do contrato alterado |
| Consulta ou renderização crítica | Medida comparável antes/depois e check de performance pertinente |
| Fluxo integrado | Smoke autenticado local e E2E do caminho/erro crítico |

Reaproveitar Jest, `npm run test:sql` (PGlite) e `scripts/validation/README.md`. Concorrência real tem `npm run test:sql:concurrency`, com PostgreSQL isolado em Docker. Não introduzir Testcontainers ou outra stack sem necessidade demonstrada.

## Browser e E2E

Usar a skill oficial `playwright-cli` instalada quando disponível, ou a ferramenta de navegador existente. Iniciar a validação de produto em `http://localhost:8081`; inspecionar os elementos reais antes de escolher seletores. Preferir papéis/rótulos e asserções observáveis, sem sleeps arbitrários.

Selecionar somente os fluxos afetados entre login/logout, workspace, convites, vínculo de atleta, chamada, Aula do Dia, periodização, scouting, upload e exportação. Para isolamento, usar duas organizações fictícias e confirmar tanto acesso permitido quanto negado.

**Antes de `npm run test:e2e`, ler `scripts/test-e2e.js`: ele executa `supabase db reset` por padrão.** Só usar reset com banco local comprovadamente descartável e dentro do escopo autorizado. `--skip-reset` evita reset, mas não torna fixtures/gravações inofensivas. Não tratar frontend localhost como prova de backend isolado.

Guardar sessões, traces, screenshots autenticados e dados pessoais em diretório privado ignorado, verificando `git check-ignore` antes. Nunca versionar estado autenticado. Falta de sessão/ambiente deve ser relatada como teste pendente, sem contornar auth ou trocar silenciosamente por mocks.

## Fechamento

Reportar comandos, resultado e limites (mock, SQL isolado, navegador, dispositivo). Instalar uma skill não cria nem executa uma suíte E2E. Publicação usa o nível de release; `build:verified` agrega validação e exportação conforme `package.json`. Não executar scripts `update:*` como se fossem apenas testes: podem publicar no EAS.
