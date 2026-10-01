# Avaliação de roteamento de skills — 01/10/2026

## Método e alcance

Foram usados subagentes com contexto novo, em modo somente leitura, para investigar os três pedidos de exemplo. Receberam o pedido, `AGENTS.md`, a orquestradora e acesso ao código local, sem a resposta esperada. A matriz de acionamento estava disponível por ser parte das instruções avaliadas. O exercício verifica seleção de skills, investigação e plano de validação; não mede implementação, execução de testes ou experiência do aplicativo.

Critérios: selecionar pelo impacto; consultar código antes de propor mudança; identificar requisitos ausentes; não inventar defeitos/colunas; aplicar a escada proporcional; distinguir testes existentes de testes executados; preservar o escopo local.

Uma rodada de Aula do Dia foi descartada: o avaliador informou que seu recorte de leitura incluiu acidentalmente o gabarito. A repetição usou outro subagente e uma cópia da matriz sem os exemplos, em `.tmp/skill-routing-eval/` (ignorada pelo Git). Os demais avaliadores declararam não ter lido o gabarito. Esta é uma avaliação qualitativa pequena, sem comparação com agentes sem skills.

## Campo na ficha do atleta

Pedido: “Adicione um novo campo na ficha do atleta.” Avaliador: `eval_athlete`.

Skills efetivamente lidas: `goatleta-feature-workflow`, `goatleta-data-model`, `goatleta-security` e `goatleta-testing`. Database/Supabase e design foram condicionadas à definição do campo/superfície; architecture não foi carregada nesta triagem. Isso difere do pacote integral sugerido inicialmente, mas evita antecipar decisões antes de saber se haverá persistência.

Investigou `StudentEditModal.tsx`, `useStudentForm.ts`, `useOnEditStudent.ts`, `src/core/models.ts`, `src/db/row-types.ts` e `src/db/students.ts`. Identificou separação entre estado do formulário, domínio, row e persistência organizacional.

Solicitou nome/finalidade, tipo, obrigatoriedade, leitores/editores, superfície e participação em importação/exportação. Classificou como nível 3 se persistente, com round-trip, registros existentes, autorização e outra organização; nível 2 somente se interação sem persistência. Não inventou campo nem migration. Resultado: critérios de triagem atendidos; seleção na implementação ainda não exercitada.

## Aula do Dia

Pedido: “Melhore a tela Aula do Dia.” Avaliador válido: `eval_session_clean`.

Skills efetivamente lidas: `goatleta-feature-workflow`, `goatleta-design-system`, `goatleta-courtside-ux` e `goatleta-web-ui`. Não carregou periodização, arquitetura ou banco, pois delimitou a proposta à interface e condicionou qualquer mudança de regras à reclassificação. Essa seleção mais estreita é coerente com o roteamento por impacto, embora diferente do pacote inicial sugerido para o exemplo.

Investigou `app/class/[id]/session.tsx`, `SessionPlanFabActions.tsx`, `SessionTrainingBlockCard.tsx`, `src/screens/home/HomeProfessor.tsx`, `src/theme/tokens.ts` e `src/ui/Pressable.tsx`. Apontou como oportunidades para conferência o acesso à ação principal pelo menu e a leitura dos exercícios. Distinguiu observação de código de defeito visual confirmado e avisou que a leitura da primitive de interação foi parcial.

Pediu plataforma, incômodo e tarefa prioritária. Propôs preservar callbacks, datas e estados, usar tokens e evitar refatoração da rota inteira. Escolheu nível 2 se alterar interação/foco, nível 1 se apenas estilo e nível 3 se mudar navegação/dados. Resultado: critérios de triagem atendidos; hipóteses de UX ainda precisam de conferência local e decisão de escopo.

## Convite de professor

Pedido: “Corrija uma falha em convite de professor.” Avaliador: `eval_invite`.

Skills efetivamente lidas: `goatleta-feature-workflow`, `goatleta-security`, `goatleta-testing` e Supabase oficial. Database foi reservada para mudança efetiva em backend/RPC; Playwright não foi carregado porque nenhum fluxo de browser seria executado nessa etapa.

Investigou `src/api/trainer-invite.ts`, `src/auth/pending-invite.ts`, `app/pending.tsx`, `supabase/functions/accept-staff-invite/index.ts` e testes de trainer-invite/staff-invite-auth. Identificou ramos por e-mail/link, conta nova/existente, onboarding e aplicação pela RPC `claim_trainer_invite_access`.

Pediu etapa, erro sanitizado, plataforma, canal e estado de sessão para reproduzir o defeito. Propôs nível 3 se afetar autenticação/permissões, testes negativos e smoke com backend isolado. Não tratou testes escritos como testes aprovados nem afirmou uma vulnerabilidade. Resultado: critérios de triagem atendidos; correção e execução web não exercitadas.

## Controle de microajuste

Pedido adicional ao avaliador de atleta: “Ajuste local: troque o texto do botão Entrar para Acessar, preservando todo o comportamento. Não publique.” O avaliador reutilizou seu contexto; este controle não é uma quarta avaliação cega.

Leu `goatleta-design-system`, escolheu nível 1 e dispensou banco/segurança por se tratar apenas de copy. Indicou diff restrito, conferência local em um viewport e teste focado existente somente se pertinente. Não exigiu build, tipos, org-scope, performance ou suíte ampla. Resultado: proporcionalidade preservada no planejamento; alteração não executada.

## Limites e continuidade

Nenhum avaliador alterou produto, acessou serviços remotos ou executou testes do app. Os resultados não comprovam comportamento sob falhas de implementação ou pressão de prazo. A próxima evidência útil virá de uma tarefa concreta: registrar as skills realmente lidas, alteração feita, checks executados e resultado observado. Não há justificativa nesta amostra para ampliar as regras ou tornar todos os pacotes obrigatórios.
