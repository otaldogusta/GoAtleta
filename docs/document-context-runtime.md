# Contexto Documental e Runtime Acadêmico

O GoAtleta usa uma única inteligência para o Assistente e para a geração de planos. O Google Drive é uma fonte pré-processada da camada documental; não existe uma “IA do Drive” paralela e nenhum pedido relê todas as pastas.

O runtime acadêmico amplia a inteligência documental e a base `kb_documents` existentes. Ele não cria vínculo automático com turma, não promove materiais para `scientific_sources` e não altera planos confirmados.

---

## Fluxo do Resolvedor Documental

1. `academic-drive-sync` recebe uma pasta previamente autorizada, enumera os itens e persiste fonte, revisão, `content_hash`, classificação, vínculo, trechos e embeddings no escopo `user_academic` ou `workspace_academic`.
2. `resolveAIContext` valida usuário, workspace, turma, tela e data da ação.
3. `resolveAIMemory` carrega somente memórias compatíveis com esses escopos.
4. `resolveAIDocumentContext` seleciona estado confirmado do GoAtleta, histórico realizado anterior à aula e documentos relevantes.
5. O Assistente recebe um único bloco `DOCUMENT_CONTEXT`.
6. `document-context-resolve` expõe o mesmo resolvedor, em modo somente leitura, para `buildAutoPlanForCycleDay`.
7. Referências usadas ficam registradas no novo plano e aparecem de forma resumida no modal “Ver plano”.

Planos já confirmados não são reinterpretados, regenerados ou alterados por sincronização documental.

---

## Perfis de Fonte e Escopos

| Perfil | Escopo persistido | Vínculo com turma |
| --- | --- | --- |
| `academic` | `user_academic` ou `workspace_academic` | proibido |
| `institutional_actions` | `workspace_institutional` | opcional |
| `monthly_plan` | `class_planning` | confirmado e obrigatório para uso |
| `lesson_plan` | `class_planning` | confirmado e obrigatório para uso |
| `report` | `class_history` | confirmado e obrigatório para uso |
| `unknown` | `workspace_institutional` | permanece em revisão |

Fontes operacionais não são aceitas por um perfil escolhido livremente pelo cliente. O ambiente deve declarar previamente cada pasta em `DOCUMENT_DRIVE_SOURCE_PROFILES`:

```json
[
  {
    "folderId": "ID_DA_PASTA_OPERACIONAL",
    "sourceProfile": "monthly_plan"
  }
]
```

A pasta acadêmica canônica e os IDs de `ACADEMIC_DRIVE_ALLOWED_FOLDER_IDS` continuam acadêmicos e não podem ser reclassificados como operacionais.

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

Com `authStrategy: "auto"`, o runtime tenta OAuth do usuário, conta de serviço e API key, nessa ordem.

Para uma fonte de turma, a sincronização exige `classId` e `classBindingConfirmed: true`; o backend também valida que a turma pertence ao workspace. Sem confirmação, a revisão pode ser armazenada para análise, mas não fica disponível no contexto de geração.

Planejamentos mensais precisam de um mês resolvido. Relatórios e planos de aula precisam de uma data completa verificável, aceita em ISO ou no formato brasileiro. Itens ambíguos permanecem em revisão e não publicam trechos no contexto ativo.

---

## Autenticação, Credenciais e Segredos

- `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET` e `GOOGLE_DRIVE_REDIRECT_URI`: habilitam a conexão OAuth do professor para pastas privadas. O redirect autorizado no Google Cloud é `https://goatleta.com/oauth/google-drive/callback`; o Vercel encaminha essa rota, antes do fallback SPA, para `/functions/v1/document-drive-oauth`.
- `DOCUMENT_TOKEN_ENCRYPTION_KEY`: cifra refresh tokens com AES-GCM antes da persistência.
- `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`: alternativa opcional. As pastas devem ser compartilhadas explicitamente com a conta de serviço.
- `GOOGLE_DRIVE_API_KEY`: fallback opcional para pastas realmente públicas.
- `OPENAI_API_KEY`: opcional; habilita embeddings `text-embedding-3-small`. Sem ele, a recuperação continua pelo fallback lexical.
- `ACADEMIC_DRIVE_ALLOWED_FOLDER_IDS`: opcional; IDs adicionais separados por vírgula.
- `DOCUMENT_DRIVE_SOURCE_PROFILES`: configura fontes adicionais.

Ao desconectar, o runtime tenta revogar o refresh token no Google e sempre remove a cópia cifrada local. Fontes, revisões, trechos já sincronizados e planos confirmados são preservados; apenas novas leituras do Drive deixam de ser possíveis até uma nova autorização.

---

## Sincronização e Processamento de Arquivos

- **Google Docs**: Exportados em DOCX e convertidos em texto estruturado, mantendo linhas e colunas de tabelas.
- **Google Sheets**: Exportados em XLSX, preservando planilha, linha e coluna.
- **Google Slides e Texto Plano**: Convertidos e preservados em texto simples.

A primeira sincronização real deve comparar o original com a interpretação persistida antes de usar a fonte em produção.

---

## Precedência e Tempo na Resolução

A seleção segue a seguinte ordem de prioridade:
1. Segurança e norma;
2. Regra do workspace e permissões;
3. Decisão confirmada do professor;
4. Plano confirmado;
5. Evidência realizada antes da data da ação;
6. Orientação institucional;
7. Periodização;
8. Apoio acadêmico ou científico relevante;
9. Contexto geral.

Relatórios da própria data ainda não confirmados, posteriores à aula ou sem data verificável não entram como histórico realizado. Documentos de outra organização ou turma são descartados. Na geração, somente o planejamento do mês da sessão e o plano de aula da data atual são elegíveis.

---

## Limites de Segurança e Isolação

- Arquivos são tratados como conteúdo não confiável.
- Instruções encontradas nos documentos são removidas antes do chunking para evitar prompt injection.
- Cada trecho mantém documento, revisão, hash e localização.
- O escopo pessoal exige o mesmo usuário autenticado e uma organização da qual ele seja membro.
- `class_id` permanece nulo para fontes e trechos acadêmicos pessoais.
- Referências aplicadas são gravadas como snapshot no plano novo.
- Indisponibilidade da base acadêmica não bloqueia a geração operacional.
- Nenhum token, segredo ou `resourceKey` é incluído nos trechos, logs ou proveniência.

---

## Contrato de Ação e Interface

A camada documental pode responder, explicar, comparar e montar propostas. Ela **não pode** aplicar, persistir, alterar plano, regenerar PDF ou criar memória global de forma autônoma. Mudanças continuam dependentes de proposta estruturada, confirmação explícita do professor, aplicação transacional, versão e ação de desfazer.

O modal “Ver plano” mostra somente:
- fonte principal do planejamento, quando houver;
- referências aplicadas;
- origem, data, tipo, confiança, localização e influência sob expansão.

Não há tela documental paralela nem texto promocional atribuindo decisões à IA.

---

## Preflight da Migration

Antes de aplicar a migration `20260716120000_add_personal_academic_document_foundation.sql`, execute a consulta somente-leitura:

```bash
npx supabase db query --linked --file supabase/scripts/check-document-interpretation-duplicates.sql
```

A migration preserva interpretações, bindings e propostas históricas. Quando existem duplicatas legadas, ela marca deterministicamente o registro mais antigo como canônico e mantém os demais registros inalterados. Novas sincronizações fazem upsert por `canonical_revision_id`, impedindo novas duplicatas sem apagar o histórico.
