---
name: goatleta-security
description: Revisar limites de autorização do Go Atleta ao alterar convites, acesso de atletas e familiares, organizações, exportações, Storage ou operações privilegiadas; orientar testes negativos focados.
---

# Segurança específica do Go Atleta

Resolver caminhos a partir da raiz. Ler `AGENTS.md`, as migrations/policies e os chamadores do fluxo afetado. Esta skill não transforma triagem em autorização para corrigir banco remoto ou executar uma auditoria exaustiva.

## Traçar a autorização real

1. Identificar ator, vínculo organizacional, papel, estado do vínculo e recurso solicitado. Cadastro público, convite e administração são fluxos distintos.
2. Rastrear tela, API/RPC, Edge Function, SQL/RLS e Storage conforme o fluxo. Validar também chamada direta por UUID, sem passar pela tela.
3. Conferir filtros, chaves de cache e descarte de respostas após troca de usuário/organização em `src/db/client.ts` e `src/providers/OrganizationProvider.tsx`.
4. Não usar `user_metadata` editável como prova de autorização/verificação. Conferir os contratos reais em `src/auth/` e no backend; não inferir proteção pela existência de uma tela de confirmação.
5. Para `SECURITY DEFINER`, examinar finalidade, checagem do chamador, `search_path` e grants/revokes. Um aviso genérico não prova vulnerabilidade; documentar o caminho reproduzível.

## Matriz proporcional ao fluxo

Cobrir usuário sem sessão, ator autorizado e ator de outra organização. Acrescentar conforme a mudança: professor sem vínculo com a turma, coordenador, familiar/atleta de outro cadastro, vínculo inativo, convite expirado ou reutilizado. Testar leitura e escrita afetadas, inclusive reassociação para UUID externo e URLs de arquivos/exportação.

A negação deve impedir leitura ou mutação; lista vazia ou resposta de erro podem ser contratos válidos. Verificar ausência de efeito no banco, não apenas status HTTP. Usar identidades fictícias e backend de teste isolado; localhost pode apontar para produção.

Reaproveitar `supabase/tests/`, `supabase/functions/_shared/__tests__/` e testes do módulo. Rodar org-scope e gates da escada canônica quando aplicáveis. Separar evidência estática, mock e exercício real de RLS. Não imprimir tokens, dados pessoais ou credenciais em logs/artefatos versionados.
