# Sincronização do estúdio — 17/10/2026

Autorizados: migration, commit, push na main e deploy da correção. Base da
branch `codex/scouting-video-sync-20261016`: `325a6365`. O pacote preserva a
separação entre marcações do vídeo, estatísticas oficiais e leitor compartilhado.

## Backend e análise existente

Migration `scouting_video_documents` aplicada via MCP no projeto Supabase usado
pelo app (`hgmdpetpwclucvquoklv`), versão remota `20261017030716`. O arquivo local
`20261017004249_scouting_video_documents.sql` conserva o nome gerado pela CLI;
reconciliar histórico por nome/conteúdo, sem reaplicar só pela diferença de hora.
SHA256 aplicado: `e090bab177c01d9a829f2820b98c211e54f91898158ed3892e9c40ddd252a683`.

RLS e grants conferidos após aplicação: tabelas/recibos sem SELECT direto para
anon/authenticated, RPCs apenas para authenticated. Staff/admin são verificados
por organização, turma e sessão; sessão concluída não aceita novas gravações.
Sem backfill, exclusão, upload de mídia, novos links ou alteração de secrets.

Smoke autenticado em `localhost:8081` sincronizou o rascunho da ElCartel Feminino
pelo cliente normal. UI confirmou **Sincronizado**; banco confirmou revisão 1,
78 rallies, 201 contatos e 17.508 posições (1.370.735 bytes do JSONB). Exportação
integral antes/depois da implementação permaneceu idêntica; backup privado
preservado fora do Git. O arquivo físico continua escolhido em cada aparelho.

## Validação e publicação

130 testes focados em nove suítes e SQL isolado aprovados na implementação;
cobrem caches independentes, conflitos/backups, offline, respostas perdidas,
trocas de identidade/fonte e reanexo do original. Tipos, escopo, arquitetura,
lint e performance focada aprovados. `npm run build:verified` aprovou os 12
gates e o export web: 630 suítes, 3.947 testes Jest e 12 suítes SQL, em 702 s,
sem reaproveitamento. Recibos/logs são locais em `.tmp/validation/`, sem
substituir o CI. Fechamento posterior limitou-se à documentação e à remoção
de uma linha vazia no fim de um teste, com regressão focada e diff conferidos.

O push da main usa a integração Git existente da Vercel. Registrar a aceitação
do deploy do mesmo commit; QUEUED/BUILDING não comprova produção pronta. Não
disparar outro deploy manual enquanto a integração já tiver aceitado esse commit.
Protótipo privado removido temporariamente da árvore de exportação e preservado
fora do checkout; alterações concorrentes do runtime não pertencem a este pacote.

## Limites e advisories

O advisor apontou RLS sem policies nas duas tabelas e SECURITY DEFINER nos dois
RPCs autenticados. São intencionais: acesso direto revogado, autorização dentro
do RPC e `search_path` vazio, conforme o contrato testado. Não foi concedido
acesso anon. Referências: [tabelas RPC-only](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
e [RPC autenticado](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Dois aparelhos foram simulados com caches independentes; aparelho físico e
concorrência real entre clientes hospedados não foram exercitados. PGlite
serializa sua conexão. Drive/Gemini continuam dependendo dos companions locais.
Não apagar dados do navegador antigo antes de confirmar a primeira sincronização.
