# Compatibilidade para release web — 25/10/2026

Preflight do pacote de [performance de listas e memória](performance-lists-memory-local-2026-10-25.md).
Este registro descreve a compatibilidade encontrada antes da publicação. Não é
confirmação de aplicação das migrations no banco remoto. As publicações posteriores
ao preflight estão registradas abaixo, separadas dos testes de experiência.

## Destino conferido

- Vercel: projeto `go-atleta`, base de produção `187043ec`, domínio `goatleta.com`.
- Supabase: projeto configurado no repositório e confirmado ativo. As oito
  migrations locais de performance de 24–25/10 não constavam no histórico remoto.
- A policy SELECT remota de presenças contém um ramo legado adicional com
  `deleted_at`, `tenant_id`, `user_id` e `app_role`. O guard da migration local
  `20261024183530` não corresponde a esse catálogo e abortaria a aplicação.
  Preservar esse ramo; não aplicar o lote nem remover acesso legado por suposição.

## Compatibilidade do cliente

- Activity review e financeiro já distinguem RPC ausente de negação/erro e têm
  transporte legado autorizado. Os três índices locais são otimizações opcionais.
- O resumo mensal ainda dependia exclusivamente de
  `get_monthly_attendance_summary_v1`, ausente no destino. A correção usa o leitor
  canônico completo/paginado de presenças somente quando a assinatura fixa retorna
  exatamente `404 PGRST202`; agrega turma/dia com a mesma regra do SQL, mantendo
  linhas órfãs autorizadas e todo o mês civil. Não criar joins para restringir ou
  ampliar o conjunto autorizado. Erro, negação, timeout, resposta inválida e troca
  de contexto continuam distintos de ausência; não geram totais parciais.
- O frontend pode manter compatibilidade sem executar DDL remoto. Ganhos das
  RPCs/índices/policy testados apenas no banco isolado não ficam automaticamente
  ativos em produção. A otimização RLS exige uma revisão própria do catálogo real.

## Publicação e limites

O push em `main`/`master` também aciona EAS Update de produção. O caminho web usa
uma branch `codex/`, source Git do commit revisado e Vercel, preservando o escopo
sem Android. Não enviar o diretório local de benchmark à Vercel: `.tmp/` contém
artefatos privados ignorados pelo Git, e os ignores da CLI não equivalem ao Git.

Antes de publicar: revisão dos arquivos explícitos, `build:verified` do conteúdo
final, diff check e smoke autenticado. As evidências locais permanecem separadas
de CI, preview protegido e confirmação do deployment. Não criar links que removam
a proteção da prévia apenas para contornar autenticação.

As [séries de performance](performance-lists-memory-local-2026-10-25.md) continuam
variáveis; o contador de listeners é pendência registrada, sem origem de retenção
comprovada. Não prometer ganho uniforme, ausência de vazamento, capacidade de
usuários simultâneos ou validação em aparelho.

## Publicações confirmadas em 25/10/2026

- Código entregue: `82eb2299b91be48d0946637a87f531f6dd5f5fdb`, branch
  `codex/performance-web-release-20261025`, [PR #107](https://github.com/otaldogusta/GoAtleta/pull/107)
  aberta em draft, sem merge em `main`.
- Web: deployment `dpl_88R9hGuDqeU5ukmD7YB3rk5e1ntD` confirmado `READY` em
  `goatleta.com`; domínio principal HTTP 200 e `www` redirecionando 308. Smoke
  autenticado da candidata cobriu listas, cancelamento da ficha, plano e retorno
  da agenda; painel, atletas e relatório repetidos após promoção. A RPC mensal
  ausente respondeu 404 e o leitor legado autorizado respondeu 200. Sem gravação
  de cadastros ou alteração do catálogo remoto. Alias protegido usado no teste
  restaurado antes da promoção, sem bypass de autenticação.
- Android, autorizado após a entrega web: EAS Update publicado exclusivamente
  para Android no canal e ambiente `production`, runtime `1.0.3`, grupo
  `52372840-32a8-46e4-b156-d66e94a0f97c`, update
  `01a1747c-7421-7d42-b6e5-a9d818cb21a9`. Consulta posterior ao canal confirmou
  plataforma, runtime, ambiente e commit. Não atualiza binários de runtime 1.0.2.
- Gate completo repetido: 689 suítes e 4.655 testes Jest, 18 suítes SQL, lint,
  tipos, escopo, arquitetura, performance e export web aprovados em 608 segundos.
  Export Android de produção também aprovado, com ambiente conferido sem expor
  valores. O pacote não alterou dependências, plugins ou configuração nativa.
- O último build Android de produção concluído no EAS antes desta publicação
  era `1.0.2`. APK oficial `1.0.3`, código 4, solicitado no perfil
  `production-apk`: [build `37c9fa4a`](https://expo.dev/accounts/otaldogusta/projects/goatleta/builds/37c9fa4a-666f-44f8-99f7-a0beca1c84b1)
  confirmado `FINISHED`. SHA-256 do APK:
  `618d98c58ea8315cbe8e705165f896ab54a9c72a4c3fa6e14312d281bd6d22e1`.
  Assinatura, pacote `com.otaldogusta.goatleta`, runtime/canal e Updates habilitado
  conferidos no manifesto compilado; binário sem debug. Instalação por ADB no
  aparelho conectado concluída, preservando o pacote de teste e seus dados.
  Abertura na tela inicial aprovada; login e smoke autenticado ainda pendentes.
  Os 645 ms da Activity na primeira abertura não medem conteúdo interativo ou
  navegação autenticada e não são comparação de performance.
- O aparelho conectado tinha somente `com.otaldogusta.goatleta.perf`, versão
  `1.0.3-perf`. O manifesto compilado indica runtime 1.0.3, canal `perf` e
  Updates desabilitado, portanto esse APK não recebe o OTA de produção. A tela
  voltou a bloquear antes da baseline; uma abertura não fria e PSS isolado não
  constituem comparação válida. Não houve limpeza dos dados do app de teste.
- As oito migrations de performance continuam sem aplicação remota. A revisão
  da policy legada, o crescimento de listeners e a variabilidade de startup/listas
  permanecem pendentes. Esta publicação não inclui iOS, Play Store ou comprovação
  de capacidade/melhoria percentual no Android.
