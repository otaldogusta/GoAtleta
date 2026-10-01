---
name: goatleta-architecture
description: Orientar mudanças nas fronteiras entre rotas, aplicação, domínio, persistência e assistente do Go Atleta; usar ao criar funcionalidades ou refatorar dependências entre camadas.
---

# Arquitetura do Go Atleta

Os caminhos abaixo são relativos à raiz do repositório. Ler `AGENTS.md` e `docs/architecture-hygiene.md`; o contrato do repositório prevalece sobre exemplos genéricos de frameworks.

## Localizar a mudança

- `app/`: rotas Expo Router e composição da interação.
- `src/screens/`: apresentação e hooks de feature; casos de uso nas pastas `application` existentes.
- `src/core/`: modelos e regras puras, sem React, Expo, navegador ou cliente Supabase.
- `src/api/` e `src/db/`: integrações, persistência, cache e tradução de dados; não importar telas.
- `src/copilot/`: contexto e recomendações pelos mesmos casos de uso do produto.
- `supabase/functions/`: backend; compartilhamento por `_shared`, sem importar frontend.

Inspecionar um fluxo vizinho completo antes de criar uma abstração. Extrair apenas o necessário; não reorganizar o projeto inteiro nem criar serviços vazios para preencher uma arquitetura teórica.

## Preservar contratos

Rastrear organização, usuário e recurso desde `src/providers/OrganizationProvider.tsx` até a operação persistente. Conferir invalidação de cache e respostas assíncronas após troca de organização em `src/db/client.ts` e `src/core/organization-async-identity.ts`. Filtro do cliente não substitui autorização no servidor.

A IA propõe e orquestra pelo fluxo existente; não criar um segundo mecanismo de autorização ou gravação pedagógica. Distinguir plano proposto, plano confirmado e execução realizada.

Classificar a validação em `docs/operations/validation-ladder.md`. Para alteração de dependências, usar `npm run check:architecture:strict`; para dados/navegação escopados, incluir `npm run check:org-scope`. Relatar fronteiras alteradas e evidências, sem apresentar check estático como teste de RLS.
