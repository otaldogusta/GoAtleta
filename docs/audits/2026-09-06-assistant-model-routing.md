# Seleção automática de modelo do Assistente

Função assistant publicada em produção em 06/09/2026, versão 56 ACTIVE, após autorização do usuário. Seletor visual validado no localhost; frontend não publicado no Vercel neste passo.

## Comportamento

- Saudação inicial exata: resposta determinística, sem geração, após autenticação e validação de organização/turma. Não responde fatos do app nem ignora pedidos anexos à saudação.
- Rotina, reescrita e aula simples: gpt-5.6-luna.
- Análise/criação longitudinal (histórico, periodização, temporada) e planejamento com pelo menos três categorias de restrição: gpt-5.6-terra.
- Continuação curta considera até três mensagens do usuário; nova pergunta substantiva redefine a rota. Mensagens do assistente e documentos não determinam o modelo.
- Proativo: Luna. Configuração explícita OPENAI_ASSISTANT_MODEL permanece como seleção fixa para reversão operacional; nenhum segredo foi modificado.
- Uma chamada por pedido, sem classificação paga nem repetição automática. Não promete detectar toda resposta fraca; não há avaliação de qualidade automática nesta versão.

`model-router.ts` concentra regras puras. O handler continua responsável por autenticação, contexto, governança e validação. `model-policy.ts` preserva Responses API e seleção permitida. Telemetria registra motivo/versão da política e limite de saída, sem texto da pergunta. Chamadas concluídas registram modelo retornado, tokens e custo estimado pelo modelo solicitado.

## Custo e limites

A economia é relativa a usar Terra em todos os pedidos, não uma promessa de redução frente ao gpt-4o-mini atualmente publicado. Preços de referência conferidos nas páginas oficiais [Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) e [Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra). A estimativa existente usa tarifa sem cache; não substitui faturamento. Não há teto financeiro mensal implementado. Tokens máximos preservam espaço para o schema de aula; histórico e regras de autorização não são truncados pelo roteador.

Validação: 22 testes focados cobrindo seleção, continuidade, mudança de assunto, configuração fixa, saudação, protocolo e histórico. Deno check e organização passaram. Não houve chamada paga, alteração de segredo, gravação em turma real nem publicação. Testes avaliam a política, não a qualidade das respostas dos modelos; avaliação comparativa real e smoke autenticado da nova função são pendências antes da liberação.


## Seletor manual no chat

- Cabeçalho compartilhado entre chat da turma e Assistente: Automático, GPT-5.6 Luna, GPT-5.6 Terra e GPT-4o mini. A escolha vale para a próxima mensagem e preserva o histórico; fica bloqueada durante a resposta.
- Preferência explícita validada pela allowlist do servidor. Orçamento continua fixo no servidor. Uma configuração operacional incompatível rejeita a escolha, em vez de substituí-la silenciosamente.
- Cliente exige confirmação de preferência/modelo selecionado. Servidores anteriores que ignoram a escolha retornam aviso para usar Automático. Respostas determinísticas informam actual=null; respostas geradas informam o modelo do provedor.
- Implementação local. Ativação completa requer publicação da função assistant; a autorização anterior de assistant-transcribe não cobre essa publicação.

Validação do seletor: 47 testes passaram (API, roteador e conversa), typecheck:app, check:org-scope, perf-hygiene strict e Deno check da função assistant passaram. Smoke autenticado pendente: localhost redirecionou ao login; nenhum envio pago nem publicação realizados nesta alteração.


## Publicação e smoke autenticado — 06/09/2026

- Destino: projeto hgmdpetpwclucvquoklv, somente assistant, versão 56 ACTIVE, verify_jwt=true. Segredos e demais funções preservados.
- Bundle SHA-256: 2ba937ca9fc9c308b08b1a51f959bff01e3c129196dfb2b91edddb3cfe384309.
- Fonte: alterações locais sobre 27d32c58; sem novo commit, push ou deploy Vercel.
- Chat da turma no localhost: seletor aberto, Luna escolhido e resposta gerada; troca para Terra com continuação da mesma conversa também respondeu. Confirmação de escolha do backend aceita pelo cliente. Dois pedidos curtos à API; nenhum plano aplicado.
- Viewports medidos: 390x844, 834x1194, 1440x1024, sem overflow horizontal. Tamanho restaurado e modo Automático selecionado ao terminar.
- Registros anteriores de pendência de publicação/smoke acima são históricos e foram resolvidos por esta seção. Avaliação comparativa ampla de qualidade permanece fora deste smoke.
