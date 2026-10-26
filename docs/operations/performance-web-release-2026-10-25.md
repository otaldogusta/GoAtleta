# Compatibilidade para release web — 25/10/2026

Preflight do pacote de [performance de listas e memória](performance-lists-memory-local-2026-10-25.md).
Este registro descreve a compatibilidade encontrada antes da publicação. Não é
confirmação de deploy ou de aplicação das migrations no banco remoto.

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
