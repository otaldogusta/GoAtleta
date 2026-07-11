# Matriz obrigatória de cenários

| Cenário | Resultado esperado |
| --- | --- |
| Documento novo sem planejamento | Propor criação |
| Planejamento existente | Oferecer comparação antes de atualizar |
| Documento complementa o app | Sugerir somente complementos |
| Relatório contradiz progressão | Recomendar manter ou regredir |
| Documento antigo | Não sobrescrever evidência recente |
| Blocos duplicados no DOCX | Deduplicar e avisar |
| Turma não identificada | Exigir confirmação |
| Duas turmas possíveis | Mostrar opções sem escolher silenciosamente |
| Turma de outro workspace | Bloquear e auditar |
| Confiança baixa | Impedir aplicação direta |
| Aprovação parcial | Aplicar somente itens selecionados |
| Aplicação repetida | Permanecer idempotente |
| Documento alterado depois da proposta | Invalidar a proposta obsoleta |
| Duas propostas para o mesmo planejamento | Detectar conflito de versão |
| Aprovação concorrente | Aplicar uma vez e rejeitar estado obsoleto |
| Arquivo duplicado com nome diferente | Deduplicar por conteúdo |
| Google Doc e DOCX com o mesmo conteúdo | Deduplicar entre provedores |
| Documento correto vinculado à turma errada | Bloquear aplicação e exigir novo vínculo |
| Falha no meio da aplicação | Reverter toda a transação |
| Rollback parcial após falha | Não persistir estado parcial |
| Desfazer | Restaurar versão anterior e preservar histórico |
| Prompt injection no documento | Ignorar instrução e preservar regras internas |
| URL privada ou redirecionamento inseguro | Bloquear antes da busca |
| Extensão/MIME falsificado | Rejeitar arquivo |

Para cada cenário, registrar fixture, camada responsável, assertivas, resultado e evidência de execução.
