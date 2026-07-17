# Contexto documental unificado

O GoAtleta usa uma única inteligência para o Assistente e para a geração de
planos. O Google Drive é uma fonte pré-processada da camada documental; não
existe uma “IA do Drive” paralela e nenhum pedido relê todas as pastas.

## Fluxo

1. `academic-drive-sync` recebe uma pasta previamente autorizada, enumera os
   itens e persiste fonte, revisão, `content_hash`, classificação, vínculo e
   trechos.
2. `resolveAIContext` valida usuário, workspace, turma, tela e data da ação.
3. `resolveAIMemory` carrega somente memórias compatíveis com esses escopos.
4. `resolveAIDocumentContext` seleciona estado confirmado do GoAtleta,
   histórico realizado anterior à aula e documentos relevantes.
5. O Assistente recebe um único bloco `DOCUMENT_CONTEXT`.
6. `document-context-resolve` expõe o mesmo resolvedor, em modo somente
   leitura, para `buildAutoPlanForCycleDay`.
7. Referências usadas ficam registradas no novo plano e aparecem de forma
   resumida no modal “Ver plano”.

Planos já confirmados não são reinterpretados, regenerados ou alterados por
sincronização documental.

## Perfis de fonte

| Perfil | Escopo persistido | Vínculo com turma |
| --- | --- | --- |
| `academic` | `user_academic` ou `workspace_academic` | proibido |
| `institutional_actions` | `workspace_institutional` | opcional |
| `monthly_plan` | `class_planning` | confirmado e obrigatório para uso |
| `lesson_plan` | `class_planning` | confirmado e obrigatório para uso |
| `report` | `class_history` | confirmado e obrigatório para uso |
| `unknown` | `workspace_institutional` | permanece em revisão |

Fontes operacionais não são aceitas por um perfil escolhido livremente pelo
cliente. O ambiente deve declarar previamente cada pasta:

```json
[
  {
    "folderId": "ID_DA_PASTA_OPERACIONAL",
    "sourceProfile": "monthly_plan"
  }
]
```

O JSON é informado em `DOCUMENT_DRIVE_SOURCE_PROFILES`. A pasta acadêmica
canônica e os IDs de `ACADEMIC_DRIVE_ALLOWED_FOLDER_IDS` continuam acadêmicos
e não podem ser reclassificados como operacionais.

Cada entrada também pode fixar a estratégia de credencial e a chave de recurso:

```json
[
  {
    "folderId": "ID_DA_PASTA_PRIVADA",
    "sourceProfile": "monthly_plan",
    "authStrategy": "oauth_user",
    "resourceKey": "CHAVE_DE_RECURSO_SE_EXISTIR"
  }
]
```

Com `authStrategy: "auto"`, o runtime tenta OAuth do usuário, conta de serviço
e API key, nessa ordem. OAuth usa PKCE e refresh token cifrado; uma conta de
serviço só enxerga pastas compartilhadas explicitamente com ela. `resourceKey`
é enviado apenas ao Google e não aparece em logs ou referências persistidas.

Para uma fonte de turma, a sincronização exige `classId` e
`classBindingConfirmed: true`; o backend também valida que a turma pertence ao
workspace. Sem confirmação, a revisão pode ser armazenada para análise, mas não
fica disponível no contexto de geração.

Planejamentos mensais precisam de um mês resolvido. Relatórios e planos de aula
precisam de uma data completa verificável, aceita em ISO ou no formato
brasileiro. Itens ambíguos permanecem em revisão e não publicam trechos no
contexto ativo.

## Precedência e tempo

A seleção segue:

1. segurança e norma;
2. regra do workspace e permissões;
3. decisão confirmada do professor;
4. plano confirmado;
5. evidência realizada antes da data da ação;
6. orientação institucional;
7. periodização;
8. apoio acadêmico ou científico relevante;
9. contexto geral.

Relatórios da própria data ainda não confirmados, posteriores à aula ou sem
data verificável não entram como histórico realizado. Documentos de outra
organização ou turma são descartados.

Na geração, somente o planejamento do mês da sessão e o plano de aula da data
atual são elegíveis; documentos de outros meses ou datas não entram como fonte
daquele plano.

## Contrato de ação

A camada documental pode responder, explicar, comparar e montar propostas.
Ela não pode aplicar, persistir, alterar plano, regenerar PDF ou criar memória
global. Mudanças continuam dependentes de proposta estruturada, confirmação
explícita do professor, aplicação transacional, versão e desfazer.

## Interface

O modal “Ver plano” mostra somente:

- fonte principal do planejamento, quando houver;
- referências aplicadas;
- origem, data, tipo, confiança, localização e influência sob expansão.

Não há tela documental paralela nem texto promocional atribuindo decisões à IA.

## Configuração pendente

Os IDs operacionais reais não são hardcoded. Cada pasta confirmada pelo
professor precisa ser cadastrada em `DOCUMENT_DRIVE_SOURCE_PROFILES` e
sincronizada antes de aparecer no contexto. Pastas ainda não inventariadas
permanecem pendentes, sem inferência de vínculo.

O callback configurado em `GOOGLE_DRIVE_REDIRECT_URI` deve ser exatamente
`https://goatleta.com/oauth/google-drive/callback` e também constar nos
redirects autorizados do cliente OAuth no Google Cloud. A rewrite específica do
Vercel encaminha essa rota para a Edge Function `document-drive-oauth` antes do
fallback da SPA.

## Preflight da migration

Antes de aplicar `20260716120000_add_personal_academic_document_foundation.sql`,
execute a consulta somente-leitura:

```bash
npx supabase db query --linked --file supabase/scripts/check-document-interpretation-duplicates.sql
```

A migration preserva interpretações, bindings e propostas históricas. Quando
existem duplicatas legadas, ela marca deterministicamente o registro mais antigo
como canônico e mantém os demais registros inalterados. Novas sincronizações
fazem upsert por `canonical_revision_id`, impedindo novas duplicatas sem apagar
o histórico.
