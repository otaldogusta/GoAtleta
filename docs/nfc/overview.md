# NFC

Este é o documento canônico para o estado atual do NFC no GoAtleta. O relatório
completo de arquitetura e correções foi preservado como histórico.

## Estado atual

- O NFC é tratado como fluxo operacional de presença, não como fonte única de
  verdade fora do contexto da turma e da chamada.
- O vínculo de uma tag é iniciado no modal do aluno dentro da chamada da turma;
  não há uma seção NFC separada na navegação da turma.
- A ação de vínculo aparece apenas para administradores da organização. Uma tag
  já vinculada a outro aluno não é reassociada silenciosamente.
- No web, o GoAtleta detecta `NDEFReader` e tenta a leitura Web NFC. Navegador,
  permissão, hardware ausente e tag sem NDEF recebem mensagens operacionais
  diferentes; a presença da API sozinha não confirma o hardware.
- A rota operacional NFC independente permanece disponível para compatibilidade
  e diagnóstico, sem ser exposta no menu da turma.
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
