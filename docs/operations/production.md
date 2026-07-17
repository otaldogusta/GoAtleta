# Produção e operação

Este é o documento canônico para deploy, checklist, prontidão, rollback,
monitoramento e sign-off do GoAtleta. Os documentos antigos continuam
arquivados para consulta histórica, mas não devem receber conteúdo novo.

## Fluxo operacional

1. Confirmar `git status --short` limpo antes de iniciar.
2. Rodar os checks aplicáveis: `check:encoding`, typechecks, testes, lint,
   `check:org-scope` e build.
3. Commitar e enviar para a `main` somente depois dos checks passarem.
4. Confirmar deployment `READY` na Vercel para o commit enviado.
5. Validar `https://goatleta.com` com HTTP `200` e
   `https://www.goatleta.com` redirecionando para o domínio principal.
6. Fazer smoke visual nas rotas críticas antes de abrir nova frente.

## Documentos ativos

| Documento | Uso |
| --- | --- |
| [Release checklist](../../RELEASE_CHECKLIST.md) | Checklist curto antes/depois do deploy |
| [Segurança](../security/overview.md) | Riscos, auditorias e comandos de verificação |
| [NFC](../nfc/overview.md) | Estado e histórico da arquitetura NFC |

## Histórico arquivado

| Documento antigo | Cópia completa |
| --- | --- |
| `PRODUCTION_READINESS.md` | [archive/operations/PRODUCTION_READINESS.md](../archive/operations/PRODUCTION_READINESS.md) |
| `PRODUCTION_DEPLOYMENT_SUMMARY.md` | [archive/operations/PRODUCTION_DEPLOYMENT_SUMMARY.md](../archive/operations/PRODUCTION_DEPLOYMENT_SUMMARY.md) |
| `POST_DEPLOY_MONITORING.md` | [archive/operations/POST_DEPLOY_MONITORING.md](../archive/operations/POST_DEPLOY_MONITORING.md) |
| `SIGN_OFF_PRODUCTION.md` | [archive/operations/SIGN_OFF_PRODUCTION.md](../archive/operations/SIGN_OFF_PRODUCTION.md) |
| `VALIDACAO_FINAL_PRODUCAO.md` | [archive/operations/VALIDACAO_FINAL_PRODUCAO.md](../archive/operations/VALIDACAO_FINAL_PRODUCAO.md) |
| `RELEASE_NOTES_v2.1.0.md` | [archive/operations/RELEASE_NOTES_v2.1.0.md](../archive/operations/RELEASE_NOTES_v2.1.0.md) |

## Observações

- `POST_DEPLOY_CHECKLIST.md` não é mais um documento separado. Use este arquivo
  junto com [Release checklist](../../RELEASE_CHECKLIST.md).
- O sign-off de produção é uma decisão operacional, não um documento duplicado.
  Registre a evidência no checklist ou no changelog quando necessário.
- Todo novo runbook de deploy deve atualizar este arquivo ou o checklist curto,
  sem criar outro `.md` na raiz.
