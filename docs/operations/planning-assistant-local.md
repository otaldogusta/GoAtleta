# Assistente contextual de planejamento — entrega local

Implementação de 30/09/2026, inicialmente local. Publicação da função registrada abaixo; sem migrações ou deploy do frontend. Commit/push do pacote autorizados posteriormente em branch `codex/`.

Validação de release após restaurar o ícone: `npm run build:verified` passou, incluindo 529 suites Jest / 2.914 testes, sete suites PostgreSQL, tipos, lint, org-scope, arquitetura, performance e export web. O smoke autenticado com a função publicada está registrado abaixo.

Atualização de publicação em 30/09/2026: após autorização do usuário, a Edge Function `assistant` foi publicada no projeto `hgmdpetpwclucvquoklv`, versão 87, `ACTIVE`, com `verify_jwt: true`. Nenhuma migração ou configuração de segredo foi alterada. Smoke autenticado no localhost com o backend publicado e modelo real: **Analisar** respondeu com a captura de setembro/semana 40/aula de 30/09, seis aulas realizadas no recorte de 30 dias e detalhes das fontes, distinguindo fontes ausentes de disponíveis. Não foi aplicado plano/perfil nesse smoke. Capturas privadas `planning-assistant-live-v87.jpg` e `planning-chat-icon-restored.jpg`. O launcher do planejamento agora reutiliza o `CopilotFab` circular com ícone `chat`, sem botão de texto concorrente. A publicação do frontend permanece pendente. Commit/push do pacote em branch `codex/` autorizados no fechamento; merge em `main` e deploy de produção não incluídos.

## Chat flutuante unificado

O controlador de conversa agora vive em `src/assistant/UnifiedAssistantProvider.tsx`, dentro do Copilot global e acima da navegação, isolado por usuário/organização. O planejamento registra sua seleção/rascunho nesse controlador e hospeda o painel na tela ou no modal ativo. A conversa, o modelo escolhido, o texto e o pedido pendente sobrevivem ao fechamento e à navegação interna. Abertura/fechamento é lembrado na sessão por usuário/organização; a posição de leitura é compartilhada entre as superfícies. O botão do chat flutuante fica oculto quando o planejamento já hospeda o mesmo assistente.

Nas outras telas o chatbot reserva 320 px a partir de 1200 px; no tablet abre à direita e no celular como sheet. Reutiliza os contextos operacionais já registrados por cada tela, sem inventar novos dados. O composer é compacto, com o seletor de modelo no cabeçalho.

O chat de aula também usa a conversa compartilhada. Rascunhos datados exigem `lessonContext` autorizado e válido, validação estrita dos blocos, turma/data da captura e versão do plano original antes de aplicação explícita. A conversa de planejamento continua exclusivamente orientativa. O workspace dedicado `/assistant`, que contém propostas institucionais e fluxos próprios de confirmação, conserva sua implementação nesta entrega; esta unificação cobre o chatbot flutuante e seus contextos de tela/aula/planejamento.

Validação desta unificação: 16 testes focados passaram, incluindo continuidade com resposta pendente, isolamento/troca de usuário e organização, vínculo do rascunho à aula original e rejeição de rascunhos sem contexto autorizado. Tipos, lint direcionado, org-scope, perf-hygiene e diff-check passaram. Smoke autenticado: planejamento → Turmas preservou o texto no mesmo controlador; apenas um acesso no planejamento; painel desktop, overlay tablet e sheet mobile. Capturas privadas `unified-chat-*.jpg`. Não foram enviados pedidos reais de IA nem aplicados planos nesse smoke. Tema claro e aplicação real de rascunho continuam sem smoke nesta entrega.

O controlador em `src/screens/periodization/PlanningAssistant.tsx` vive acima da tela e dos modais. Reutiliza `useScreenConversation` com `lessonAction: "discuss"` e o armazenamento de histórico existente. O editor importa a conversa anterior do perfil quando necessário; os seletores continuam usando seus comandos próprios. A conversa ampliada não escreve perfil, ciclos ou planos.

`UnifiedPlanningWorkspace` fornece sua seleção real de mês, semana e aula. O editor fornece escolhas provisórias; o modal de aula fornece o rascunho editado. Abrir o assistente reserva 320 px a partir de 1200 px. Abaixo disso, usa overlay ou sheet. A conversa preserva texto, histórico, pedido em andamento e posição de leitura. Abertura/fechamento é lembrado por usuário, organização e turma na sessão.

O contrato de seleção/rascunho está em `application/planning-assistant-context.ts`. A função `planning-context-handler.ts` exige autorização da turma, consulta registros oficiais com filtros de organização e turma e usa o mesmo adaptador de modelo do assistente. Não encaminha documentos, contexto global, registros de outros alunos, contatos ou campos individuais de saúde. Relatórios entram por indicadores agregados de carga, presença e participantes; narrativas livres de relatórios não são encaminhadas. O perfil pedagógico usa projeção sem autoria/citações e redação de nomes/contatos. Falha na preparação de privacidade impede o envio ao modelo.

Histórico: últimos 30 dias no instante do pedido, até oito sessões com status oficial `completed`, relatórios associados à data e presença agregada somente da turma. Scouting é agregado por fundamento/resultado; contagens antigas da turma são usadas nas datas sem sessão moderna concluída, evitando duplicação. Ausência, indisponibilidade e amostra pequena permanecem distintas.

Cada resposta guarda a seleção original e fontes/datas em detalhes expansíveis. Uma resposta do backend antigo, sem `planningContextVersion: 1`, não é aceita como resposta contextual; o texto fica disponível para retry.

## Validação local

- Testes focados de contrato, janela/limite, execução confirmada, autorização, projeção privada, falha de fontes, retry, cancelamento por desmontagem e controlador compartilhado.
- Tipagem do app e `deno check --no-lock` da função `assistant`. A tipagem completa revelou um evento de log preexistente sem entrada no union; `assistant_source_rejected` foi acrescentado ao tipo, preservando o comportamento.
- Lint dos arquivos afetados, org-scope, perf-hygiene e diff-check.
- Smoke autenticado no localhost: painel aberto/recolhido, seleção de mês e aula/semana, conversa original importada, texto preservado entre tela/editor/etapas, rascunho preservado na troca de etapas e um único composer no editor mobile. Viewports 1440×1024, 834×1194 e 390×844, tema escuro. Capturas privadas em `.codex-artifacts/density-audit/planning-context-*.jpg`.
- O controlador de aula foi testado com fixture local. Não foi feita gravação de plano nem clique de salvar/aplicar nos testes de navegador.
- Docker ativado: `node scripts/validation/planning-assistant-local-api.cjs` passou com PostgreSQL/PostgREST reais em banco QA descartável, sem dados do app. Aplicou somente nesse banco a migração de perfil já existente, verificando autorização real e RLS do perfil, isolamento usuário/organização/turma, vínculo de sessões à turma, recorte de 30 dias, oito aulas realizadas, paginação de 1.005 ações de scouting e ausência de gravação na conversa. O handler/adaptador reais foram executados em Deno; somente a resposta do provedor foi simulada. Banco e container QA foram removidos ao terminar. Os demais esquemas são fixtures mínimas para conferir o contrato das consultas, não uma cópia completa do banco de produção.

## Pendente antes de publicar

A publicação e o smoke real da versão 87 estão registrados acima. Conferência visual de tema claro e modal de aula com resposta real permanece pendente, assim como a publicação do frontend. O smoke real do contexto de planejamento não certifica aplicação de rascunhos nem os fluxos institucionais da tela dedicada.
