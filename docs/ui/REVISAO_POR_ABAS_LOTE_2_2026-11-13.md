# Revisão por abas do Go Atleta · lote 2

Registro histórico de comportamento. A composição visual das nove telas apontadas
pelo usuário foi refeita na [revisão seguinte](REVISAO_VISUAL_COMPOSICAO_2026-11-13.md).
As capturas deste lote permanecem na [galeria anterior](http://127.0.0.1:8096/antes-depois-lote2.html).

O inventário da auditoria reúne 17 áreas. A [galeria local](http://127.0.0.1:8096/antes-depois.html) associa as tarefas aos estados capturados, aos ajustes do [lote anterior](REVISAO_OPERACIONAL_2026-11-13.md) e às propostas abertas. Os comparativos usam contas fictícias e a mesma largura. Quando o estado ou o papel não tem captura equivalente, a galeria mostra a evidência disponível com seu contexto.

Designer UI conferiu Boas-vindas, Login e Cadastro em claro e escuro, Biblioteca, Perfil da Família, troca de atleta e recuperação após falha na Agenda e no Início do Aluno. Designer UX conferiu Chamada, Presença individual, NFC, Asaas, Histórico de Scouting e navegação rápida em 390 × 844. Os dois perfis usaram Chromium com sessão de QA. A Coordenação conferiu documentos públicos e reflow da Consultoria no navegador interno.

| Área | Comportamento |
| --- | --- |
| Entrada | Boas-vindas tem CTA com contraste e quatro seletores de 44 px. Enter abre Recuperar senha mantendo o e-mail. Cadastro e nova senha só expõem o controle de visibilidade quando o campo tem valor. |
| Interface compartilhada | O menu rápido fechado sai da ordem de Tab. Escape fecha e foca o gatilho. A lateral web anuncia apenas o destino atual mais específico. |
| Biblioteca | Busca tem nome, fundamentos anunciam seleção, vazio oferece limpar filtros e o Assistente fica no cabeçalho compacto. |
| Aula do Dia e Chamada | Aplicar um plano bloqueia concorrentes na ficha. Chamada anuncia atleta e ação. A presença individual recalcula o resumo sobre a busca. |
| NFC | Na web, a chamada manual usa uma turma válida do recorte ativo. A leitura de tags usa o app em aparelho compatível. |
| Família | A lista de vínculos identifica o ativo e abre o convite apenas no vínculo autorizado. Falha da Agenda e do Início tem nova tentativa. O último resultado do mesmo vínculo permanece apenas em falha transitória identificada. |
| Aluno | Treinos e Comunicados podem carregar independentemente. A falha da agenda oferece nova tentativa. |
| Professor | Falha das consultas sem eventos carregados oferece nova tentativa na Home. No carrossel, apenas a aula ativa recebe foco nas ações, com teste de múltiplas aulas pendente. |
| Financeiro | Erro na consulta de conexão do Asaas é distinto de conta desconectada e oferece nova tentativa. O campo de chave só aparece após uma consulta válida. |
| Scouting | A busca do histórico tem ação de limpar filtros. Falhas de análise e de elenco têm tentativas independentes. |
| Privacidade, Termos e Exclusão | Títulos têm semântica de seção. As rotas se ligam e as ações abrem um rascunho ou copiam o endereço. |
| Consultoria | As quatro abas refluem em tela estreita e a seleção é anunciada. |
| Assistente, Curadoria, Instituições e Evidências | Há correções locais no tratamento de falha e seleção. Esses estados ainda precisam de teste de navegador com os papéis e dados adequados. |

A galeria registra as propostas que ainda exigem implementação ou um teste próprio. Os cenários de navegação e erro validados aqui não incluem equipamento NFC físico, emissão financeira nem publicação de conteúdo.
