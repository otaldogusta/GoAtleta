# Publicação do assistente e calendário

Pacote: compositor compartilhado com voz, histórico, modelos e respostas progressivas; navegação contextual; contexto do plano aberto; feriados e revisão de períodos sem chamada.

Validação em cópia limpa do pacote, preservando alterações e artefatos fora do escopo. Tipos, organização, JWT, encoding, assets, arquitetura e performance passaram. Lint global identificou três erros e um aviso; todos foram corrigidos e os arquivos afetados passaram com zero avisos. A suíte completa passou: 441 arquivos, 2.487 testes. Cinco conjuntos SQL passaram; revisão de período também foi verificada separadamente em PGlite.

Smoke autenticado em localhost confirmou cabeçalho Planejamento, microfone habilitado e resposta sobre Ohayō, data e etapas de 10/45/5 minutos. Não foi gravado áudio real nesta validação final.

Supabase: assistant-transcribe v3 ativo; assistant v60 ativo. Migração 20260908032524_activity_review_details aplicada; RPC existente, acesso anônimo bloqueado e execução autenticada sujeita à autorização administrativa interna. Nenhuma revisão real foi criada durante os testes.

A exportação web concluiu com sucesso em dist na cópia limpa. A aceitação do envio pela Vercel não equivale à confirmação funcional em produção. O workflow EAS existente também é acionado por main; esta rodada não gera um novo binário nativo.
