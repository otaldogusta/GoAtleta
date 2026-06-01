# NFC

Este é o documento canônico para o estado atual do NFC no GoAtleta. O relatório
completo de arquitetura e correções foi preservado como histórico.

## Estado atual

- O NFC é tratado como fluxo operacional de presença, não como fonte única de
  verdade fora do contexto da turma e da chamada.
- Correções críticas de sincronização, escopo de organização e proteção de dados
  ficam documentadas no histórico arquivado.
- Novas mudanças em NFC devem preservar os checks de escopo e passar pelo smoke
  de chamada/presença antes de deploy.

## Referências

| Documento | Uso |
| --- | --- |
| [Arquitetura e correções históricas](../archive/nfc/NFC_ARCHITECTURE_AND_FIXES.md) | Relatório completo anterior |
| [Proposta de refatoração](../NFC_ARCHITECTURE_REFACTOR.md) | Direção técnica de arquitetura por eventos |
| [Produção e operação](../operations/production.md) | Deploy, rollback e monitoramento |
| [Segurança](../security/overview.md) | Riscos e verificações bloqueadoras |

## Regra para novos documentos

Atualize este arquivo quando o comportamento NFC mudar. Não crie outro `.md` de
NFC na raiz.
