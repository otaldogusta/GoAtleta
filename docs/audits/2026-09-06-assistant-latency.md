# Latência do Assistente

## Evidência antes da alteração

Consulta somente leitura aos oito eventos AI mais recentes de system_events: 5.391–9.705 ms. Nas quatro chamadas Luna/Terra da v56: 5.478–9.705 ms, 3.275–3.899 tokens de entrada, 56–460 de saída. O duration_ms atual mede desde o início do handler até a resposta do provedor; não separa banco/contexto do tempo do modelo nem inclui toda a persistência/telemetria final.

O servidor envia a resposta completa após gerar e validar JSON. A tela Assistant ainda simulava digitação por até cerca de 1,3 s depois de receber a resposta. O chat da turma já exibia o texto inteiro ao receber.

## Alteração local

- Consultas independentes de fatos, periodização, memórias, planos anteriores e governança iniciadas em paralelo, somente após autorização e validação de turma. Documentos continuam dependendo de fatos/periodização. Mesmos dados, escopo, regras e prompt.
- Removida digitação artificial na tela Assistant. A resposta já recebida aparece imediatamente.
- Evento assistant_response_stages registra context_ms, provider_ms e postprocess_ms sem texto de usuário. Não cobre o flush final de métricas do framework.
- Memórias continuam gravadas em sequência para preservar ordem temporal. Nenhuma tarefa de persistência foi abandonada em background.
- Mesmo roteador, modelos, limite de tokens e número de chamadas à IA. Nenhum teste pago nesta alteração. Não há medição de ganho em produção antes da publicação.

Validação: 45 testes focados passaram; Deno check e check:org-scope passaram. Implementação local; função em produção permanece v56. Streaming real é um próximo trabalho separado: precisa preservar validação estruturada, tratamento de erro e fluxo de confirmação dos rascunhos.


## Streaming publicado — 06/09/2026

assistant v57 ACTIVE, verify_jwt=true, projeto hgmdpetpwclucvquoklv. Bundle SHA-256 c629abcaa5b03603d68cf512f8052baf562f404f4c46961ace737f802c6ecb40. Fonte local sobre 27d32c58; sem commit/push nem publicação do frontend no Vercel.

- Provedor usa uma única chamada Responses com stream=true. Adapter preserva o contrato final JSON e metadados de uso/modelo. Apenas a string reply é extraída dos deltas, com suporte a escapes e limites de tamanho.
- Transporte ao cliente NDJSON: texto provisório, resultado final validado ou erro seguro. JSON normal continua funcionando para saudações, clientes antigos e rotas determinísticas. Fetch nativo sem reader usa o corpo bufferizado, sem repetir requisição.
- Rascunhos só são expostos após o evento final e validação existente. Falha remove texto provisório e mantém possibilidade de tentativa manual. Fechar a conversa cancela o pedido; cancelamento do stream cancela a chamada do provedor.
- Métricas são drenadas ao enviar para evitar duplicação entre o middleware e o término do streaming. O evento de etapas mede até a validação/persistência; o log de ciclo do framework representa abertura do stream, não seu término.
- Contexto em paralelo e remoção de digitação artificial incluídos nesta versão. Não houve troca de modelo, chamada classificadora, retry automático ou aumento de limite de saída.

Validação: 38 testes em cinco suítes passaram (stream de provedor/aplicação, cliente, seleção e conversa), Deno check, typecheck:app, ESLint, escopo, perf-hygiene, diff check e build web passaram.

Smoke no chat autenticado da turma em localhost: texto observado enquanto controles ainda estavam bloqueados; ao concluir, uma única resposta, controles liberados e nenhum plano aplicado. Uma pergunta curta, Luna, 4.013 tokens de entrada e 78 de saída. Métricas do servidor: contexto 970 ms; provedor 1.780 ms; primeiro texto 3.148 ms desde o início do handler; pós-processamento 435 ms; conclusão 4.324 ms. Não inclui toda a latência de rede/renderização do cliente. Amostra única, não benchmark comparativo nem promessa de tempo constante.

Frontend com streaming permanece local; a função publicada mantém compatibilidade com o site atual.

## Formato das respostas publicado — 07/09/2026

assistant v58 ACTIVE no projeto hgmdpetpwclucvquoklv, verify_jwt=true.
Bundle SHA-256: d9ca30e3d21feb8a3c8cd35815031e0b80cf9a519bdb9f2ebfcc2539e732e268.

A instrução de reply agora pede Markdown leve, resumo curto, até três prioridades baseadas em evidências e próximo passo quando justificado. Saudações e perguntas simples continuam curtas. Não listar contexto ou dados ausentes sem relevância à pergunta.

Validação: 12 testes em três suítes, Deno check via npx deno, org-scope e diff check passaram. Deploy da função assistant confirmado pelo CLI e versão ACTIVE conferida na API. Nenhuma variável de ambiente alterada; nenhuma publicação de frontend/Vercel. Respostas existentes não são reescritas. Não foi feita nova chamada de IA após este deploy.
