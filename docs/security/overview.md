# Segurança

Este é o documento canônico para postura de segurança, auditorias históricas e
comandos de verificação do Go Atleta. As auditorias completas foram preservadas
em `docs/archive/security/`.

## Verificações bloqueadoras

- `npm run check:encoding`
- `npm run typecheck:core`
- `npm run typecheck:app`
- `npm test -- --runInBand`
- `npm run lint`
- `npm run check:org-scope`
- `npm run build`

## Focos atuais

- Preservar `check:org-scope` como bloqueador para qualquer mudança de
  organização, Supabase ou escopo multiunidade.
- Evitar logs com tokens, convites, reset links ou dados sensíveis.
- Manter importações de planilhas com limite de tamanho, linhas e abas.
- Tratar `npm audit` como diagnóstico, priorizando correções compatíveis.
- Evitar `npm audit fix --force` sem revisão de impacto.

## Diagnóstico atual documentado

[Auditoria jurídica, LGPD, privacidade e acessibilidade de 21/10/2026](../audits/2026-10-21-juridico-lgpd-diagnostico.md):
fase 1 sobre `a17c2401`, com falhas de anonimização/exportação e riscos de IA,
menores, licenças e acessibilidade. Evidência estática e reprodução sintética;
sem correções do produto, execução destrutiva ou validação de produção.

[Correções prioritárias locais](../audits/2026-10-21-lgpd-correcoes-prioritarias.md):
JUR-01/02/03 com saneamento estruturado, exportação sem sucesso parcial e contexto
proativo mínimo. 71 testes Jest e três harnesses SQL isolados passaram; nova
migration e Edges não aplicadas/publicadas, demais riscos e validação remota pendentes.

## Histórico arquivado

| Documento antigo | Cópia completa |
| --- | --- |
| `SECURITY_AUDIT_AND_PERFORMANCE.md` | [archive/security/SECURITY_AUDIT_AND_PERFORMANCE.md](../archive/security/SECURITY_AUDIT_AND_PERFORMANCE.md) |
| `SECURITY_AUDIT_EXECUTIVE_SUMMARY.md` | [archive/security/SECURITY_AUDIT_EXECUTIVE_SUMMARY.md](../archive/security/SECURITY_AUDIT_EXECUTIVE_SUMMARY.md) |
| `SECURITY_AUDIT_ATTACK_TREE.md` | [archive/security/SECURITY_AUDIT_ATTACK_TREE.md](../archive/security/SECURITY_AUDIT_ATTACK_TREE.md) |
| `SECURITY_AUDIT_QUICK_REFERENCE.md` | [archive/security/SECURITY_AUDIT_QUICK_REFERENCE.md](../archive/security/SECURITY_AUDIT_QUICK_REFERENCE.md) |
| `SECURITY_FIXES_EXECUTION_PLAN.md` | [archive/security/SECURITY_FIXES_EXECUTION_PLAN.md](../archive/security/SECURITY_FIXES_EXECUTION_PLAN.md) |

## Regra para novos documentos

Atualize este arquivo quando houver mudança de postura, risco ou processo de
segurança. Use os arquivos arquivados apenas como evidência histórica.
