---
name: goatleta-database
description: Planejar e validar migrations, RPCs e persistência Supabase do Go Atleta com escopo organizacional, compatibilidade e preservação de dados.
---

# Banco e persistência

Resolver caminhos na raiz. Ler `AGENTS.md`, `.agents/skills/goatleta-data-model/SKILL.md` quando houver mudança de entidades e a skill oficial Supabase disponível para o assunto específico. Não copiar o manual Supabase nem substituir a arquitetura do produto.

Rastrear migrations existentes, RLS/grants, funções SQL, adaptadores `src/db/` e chamadores `src/api/` ou Edge Functions. Para APIs do fornecedor, verificar documentação atual antes de implementar.

Criar nova migration para evolução; não reescrever migration já aplicada. Descrever compatibilidade de leitura/escrita, backfill, defaults, nullability, índices, FKs e efeitos em dados históricos. Priorizar mudança aditiva; alterações destrutivas exigem escopo explícito e avaliação de impacto.

Separar autorização do servidor de filtros do cliente. Verificar acesso por UUID, escopo de organização, concorrência/idempotência para mutações reaplicáveis e permissões de funções. Para análise de ameaças do fluxo, usar `.agents/skills/goatleta-security/SKILL.md`.

Reaproveitar `scripts/validation/run-sql-tests.mjs`, runners SQL específicos e `supabase/tests/`. Fixtures devem ser fictícias e isoladas. PGlite ajuda em regressões SQL, mas não comprova sozinho Auth, PostgREST, Storage ou toda a concorrência do serviço hospedado.

Antes de executar qualquer comando que modifique banco, conferir destino e autorização. Inspecionar opções da CLI via `--help`; uma migration preparada não autoriza aplicação remota. Reportar separadamente arquivo criado, teste local, dry-run e aplicação efetiva. Nunca mostrar connection strings ou valores de secrets.
