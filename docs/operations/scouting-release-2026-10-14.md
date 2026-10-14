# Publicação do estúdio — 14/10/2026

Pacote autorizado para push e publicação na main, partindo de `f9f56b61` sobre `5c42d3ef` (main já contida na branch). Inclui o estúdio, fontes YouTube/arquivo, ferramentas locais Drive/Gemini, trajetória e organização compacta. Alterações anteriores de calendário/DateInput e seu item de checklist permanecem locais e fora do commit.

## Validação reutilizada e executada

- Smoke autenticado e responsividade dos dois temas reaproveitados do [refinamento final](scouting-studio-ui-2026-10-14.md), sem nova edição de runtime. Exportação integral antes/depois idêntica: 78 rallies, 201 contatos e 17.508 posições.
- Executor de release executado uma vez: 598 suítes / 3.532 testes, 11 suítes SQL isoladas, tipos, encoding, marca, JWT, escopo, assets, arquitetura e performance passaram.
- O executor reportou falha somente pelos três avisos de lint na alteração local excluída de `src/ui/__tests__/DateInput.test.ts`. A versão HEAD desse arquivo, usada no pacote, passou pelo ESLint via stdin com zero avisos. Nenhum outro arquivo produziu erro/aviso. Não foi fabricado recibo de aprovação completa.
- Contratos da Edge Function conferidos isoladamente; build web aprovado separadamente, com 122 rotas exportadas. Avisos conhecidos de fallback de exports do Expo não impediram o build.

## Backend ativado

As migrations preparadas foram aplicadas via MCP com nomes `scouting_video_sharing` (versão remota `20261014155024`) e `scouting_video_youtube` (`20261014155032`). Os arquivos locais conservam suas versões originais; futuras reconciliações devem considerar nome/conteúdo, não reaplicar às cegas por timestamp.

A função `scouting-video-share` está ACTIVE, versão 1, com autenticação própria por prova do link e identidade verificada para acesso da equipe. Tabelas com RLS e sem SELECT direto para anon/authenticated; resolução exclusiva de service_role. Bucket privado. Verificação HTTP remota confirmou 405 para método inválido, 400 para prova inválida e 404 para link inexistente. Nenhuma mídia/rascunho foi enviada e nenhum link real de compartilhamento foi criado neste release.

## Publicação e limites

O push da main aciona a integração Git existente da Vercel e o workflow EAS após seus checks. Registrar aceitação do deploy sem confundir QUEUED/BUILDING com produção pronta. Não disparar um segundo deploy manual.

Drive e Gemini seguem restritos ao serviço local de desenvolvimento. Este release não instala executor cloud nem habilita esses companions em produção. Upload de mídia continua sujeito à cota existente; não houve alteração de plano ou secrets. Tracking, leitura compartilhada e origem de vídeo mantêm seus contratos próprios.
