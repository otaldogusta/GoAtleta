# Documentos, conhecimento acadêmico e evidência científica

Base inspecionada: `d5120cff`, 05/10/2026. Código local; migrations e relatos de publicação não atestam o ambiente remoto atual.

## Responsabilidades e implementação atual

Ingestão registra fonte, revisão, hash, interpretação, vínculo, trechos e proveniência. `academic-drive-sync` pré-processa pastas autorizadas; Assistente e gerador consultam conteúdo persistido pelo resolvedor compartilhado, sem reler o Drive a cada conversa ou alterar planos confirmados.

Importação PDF de planejamento é outro fluxo: análise multimodal, revisão, confirmação e construção de rascunhos. Curadoria acadêmica publica projeções sanitizadas em `system_academic`; descoberta científica externa possui candidatos, cache e publicação automática condicionada. Perfis institucionais orientam interpretação por escopo.

## Arquivos principais

| Fluxo | Entradas |
| --- | --- |
| Curadoria | [academic-knowledge.tsx](../../../app/academic-knowledge.tsx), [db/academic-knowledge.ts](../../../src/db/academic-knowledge.ts) |
| Tipos/ingestão/reconciliação | [document-intelligence](../../../src/core/document-intelligence/): contratos, precedência, segurança e propostas |
| Drive/OAuth | [academic-drive-sync](../../../supabase/functions/academic-drive-sync/index.ts), [document-drive-oauth](../../../supabase/functions/document-drive-oauth/index.ts), [google-drive-auth.ts](../../../supabase/functions/_shared/google-drive-auth.ts) |
| Política/extração | [document-drive-source.ts](../../../supabase/functions/_shared/document-drive-source.ts), [document-structured-extraction.ts](../../../supabase/functions/_shared/document-structured-extraction.ts) |
| Contexto/retrieval | [ai-document-context.ts](../../../supabase/functions/_shared/ai-document-context.ts), [document-context-resolve](../../../supabase/functions/document-context-resolve/index.ts), [academic-knowledge-retrieve](../../../supabase/functions/academic-knowledge-retrieve/index.ts), [db/document-context.ts](../../../src/db/document-context.ts) |
| Importação PDF | [training-plan-document-import](../../../supabase/functions/training-plan-document-import/index.ts), [API](../../../src/api/training-plan-pdf-import.ts), [construção do rascunho](../../../src/screens/training/application/training-plan-pdf-import.ts) |
| Perfis institucionais | [ai-context.ts](../../../supabase/functions/_shared/ai-context.ts), [ai-institutional-profile.ts](../../../supabase/functions/_shared/ai-institutional-profile.ts) |
| Descoberta científica | [scientific-evidence.ts](../../../supabase/functions/_shared/scientific-evidence.ts), [scientific-evidence-runtime.ts](../../../supabase/functions/_shared/scientific-evidence-runtime.ts), [ScientificEvidencePanel.tsx](../../../src/assistant/components/ScientificEvidencePanel.tsx) |
| Busca/aprovação explícita | [evidence/index.tsx](../../../app/evidence/index.tsx), [api/evidence.ts](../../../src/api/evidence.ts), [kb_ingest](../../../supabase/functions/kb_ingest/index.ts) |

## Contratos a preservar

- Validar usuário, organização, turma e finalidade. Fonte pessoal exige proprietário correto e `class_id` nulo; perfil enviado pelo cliente não autoriza pasta operacional.
- Planejamento/histórico de turma exigem vínculo confirmado. Mês/data ambíguos e extração sem texto permanecem em revisão, fora do contexto ativo correspondente.
- Documento é conteúdo não confiável: preservar sanitização, limites de formato/bytes/páginas/expansão/tempo. Nunca executar instruções encontradas no arquivo.
- Hash, revisão canônica, parser e proveniência permitem reconciliação sem apagar interpretações/propostas históricas para eliminar duplicatas.
- Precedência: segurança → escopo → decisão/plano confirmado → histórico anterior → institucional → periodização → apoio acadêmico/científico → contexto geral.
- Resolução é somente leitura operacional. Sincronização/retrieval não aplicam plano, relatório ou memória pedagógica global; proposta exige revisão, snapshot e ação explícita.
- PDF separa `analyze`/`confirm`, itens aprovados e `snapshotVersion`; confirmação produz dados para rascunho com proveniência, antes da aplicação no planejamento.
- Publicação acadêmica expõe síntese/identidade pública sanitizadas, sem proprietário, IDs privados, URL Drive, credenciais ou excerto administrativo privado.
- OAuth cifra refresh token; desconexão remove credencial local e tenta revogação sem apagar fontes/planos. Nunca incluir tokens ou resource keys em trechos/logs.
- Conhecimento recuperado não é treinamento permanente nem substitui o Assistente existente e o controle docente.

## Decisões atuais e legado

- Drive extrai texto PDF e estrutura DOCX/XLSX. PDF sem texto não recebe OCR automaticamente; importação multimodal de planejamento não muda esse limite.
- Embeddings: `text-embedding-3-small`, 1.536 dimensões, com fallback lexical. Apoio acadêmico indisponível não deve bloquear planejamento.
- `institutional_profiles`: workspace → program → modality → class. `organization_ai_profiles` é fallback sem perfil hierárquico aplicável e [somente leitura na Data API](../../../supabase/migrations/20260710175839_make_organization_ai_profiles_read_only.sql); helpers SQLite legados não autorizam escrita remota.
- Ciência reduz consulta para privacidade, consulta cache/base global, reserva quota Consensus por RPC e usa PubMed como fallback. Ausência de busca, cache, sucesso, fallback e quota excedida permanecem distintos.
- O runtime pode publicar em `scientific_sources` após critérios e conferência Crossref, com `auto_published: true`, `verification_status: unverified` e auditoria/quarentena. Isso é distinto de curadoria Drive e aplicação pedagógica.
- `kb_ingest` conserva busca/resumo/aprovação explícitos; não presumir uma única rota ou modelo para toda evidência.

## Fontes e histórico

- [Runtime documental](../../document-context-runtime.md): escopos, OAuth, precedência e ação. Sua não promoção automática refere-se a documentos; a descoberta científica acima possui outra política. Preflight antigo não autoriza reaplicar migrations.
- [Planejamento contextual](../../operations/planning-assistant-local.md) usa caminho sem documentos/contexto global; o resolvedor geral não entra em toda conversa.
- [AI_PILLARS](../../AI_PILLARS.md) é conceitual; exemplos e links antigos não provam ativação. [Assistente](assistente-ia.md) complementa somente mudanças de conversa/memória/modelo.

## Validações relevantes

Suítes existentes, não executadas nesta rodada:

- [Document-intelligence](../../../src/core/document-intelligence/__tests__): ingestão/reconciliação.
- [Shared Edge](../../../supabase/functions/_shared/__tests__): Drive, OAuth, extração, sync, contexto, retrieval e evidência científica.
- [Importador PDF](../../../supabase/functions/training-plan-document-import/__tests__/contract.test.ts), [aplicação PDF](../../../src/screens/training/application/__tests__/training-plan-pdf-import.test.ts) e [perfis](../../../supabase/functions/assistant/__tests__/ai-institutional-profile.test.ts).
- Smoke exige fonte autorizada, confronto original/interpretação, revisão, isolamento e plano preservado. Mocks não comprovam OAuth, quota remota, extração real ou publicação sanitizada.

## Antes de editar

Escolha ingestão, curadoria, retrieval, perfil ou PDF; leia o par cliente/Edge e somente a migration pertinente. Siga a [escada](../../operations/validation-ladder.md); dados/escopo exigem RLS e `check:org-scope`. Ler contexto não autoriza ativar provedor ou sincronizar material privado.
