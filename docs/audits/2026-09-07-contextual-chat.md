# Chat contextual das telas — 2026-09-07

## Ajuste local

O CopilotModal agora usa conversa real também fora da aula. O painel antigo de regulamentação, categorias e resposta operacional fixa deixou de ser a abertura do chat. As telas que usam esse modal compartilham seletor de modelo, mensagens, resposta progressiva, estado de espera e rolagem para o final.

CopilotScreenChat recebe o snapshot operacional e usa useScreenConversation. O pedido inclui organização ativa e contexto da tela, sem inventar turma/data ou solicitar aplicação de plano. A conversa é remontada por usuário, organização e tela; desmontagem cancela a requisição. Falhas restauram a mensagem para uma tentativa manual, sem repetição automática.

O chat de aula mantém o fluxo de revisão/aplicação explícita. O serviço de voz existente exige turma; a conversa geral ainda é por texto. Não foi alterada a autorização da transcrição nem publicado backend/frontend nesta etapa.

## Validação

- 3 testes novos: escopo/modelo, rollback de stream e cancelamento/envio duplicado.
- Typecheck app passou.
- Org-scope e perf-hygiene estrito passaram.
- ESLint dos componentes e hook passou antes da inclusão dos testes; conferência final incluindo testes executada.
- Diff check do modal passou.
- Validação visual nos três viewports pendente: navegador integrado retorna timeout de CDP ao navegar, inclusive após reinicialização do runtime. Não houve confirmação visual nem smoke autenticado dessa alteração.
