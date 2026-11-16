# Interface web do Go Atleta

Este diretório é a fonte canônica para decisões visuais e responsivas do web.
A Home do professor é a referência de densidade, navegação e hierarquia.

Registre mudanças visuais no mesmo Inventário Visual (`inventario.html`). Para
cada perfil afetado, inclua o caminho para testar a tela real no localhost de QA
e fotos de antes e depois em claro e escuro, usando dados fictícios. Capture o
antes antes de editar. Se faltar uma captura, identifique a lacuna ou rotule o
estado equivalente da versão atual. Preserve as áreas e recortes anteriores.
Gere o HTML com `scripts/build-ui-inventory-hub.py`.

| Tema | Documento |
| --- | --- |
| Identidade, tokens e hierarquia | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |
| Diretrizes de Marca e Estilo Visual | [brand-guidelines.md](brand-guidelines.md) |
| Estrutura de páginas desktop | [WEB_LAYOUT_GUIDELINES.md](WEB_LAYOUT_GUIDELINES.md) |
| Breakpoints e reflow | [RESPONSIVE_RULES.md](RESPONSIVE_RULES.md) |
| Primitives e componentes | [COMPONENT_LIBRARY.md](COMPONENT_LIBRARY.md) |
| Agenda — anotações e anexos | [Contrato e ativação](AGENDA_ANOTACOES_ANEXOS_2026-10-29.md) |
| Formulários e configurações (referência: perfil) | [FORM_SETTINGS_PATTERNS.md](FORM_SETTINGS_PATTERNS.md) |
| Decisões assistidas | [AI_DECISION_EXPLAINABILITY.md](AI_DECISION_EXPLAINABILITY.md) |
| Validação proporcional e ciclo rápido | [validation-ladder.md](../operations/validation-ladder.md) |
| Correções operacionais por aba — 13/11/2026 | [Revisão operacional](REVISAO_OPERACIONAL_2026-11-13.md) |
| Antes e depois por aba — lote 2 | [Revisão por abas](REVISAO_POR_ABAS_LOTE_2_2026-11-13.md) |
| Composição das nove telas apontadas — 13/11/2026 | [Revisão visual e evidências](REVISAO_VISUAL_COMPOSICAO_2026-11-13.md) |
| Continuidade: Planejamento, Turmas, Gestão e Regulamentos | [20 comparativos e validação local](REVISAO_INVENTARIO_CONTINUIDADE_2026-11-13.md) |
| Ajustes após revisão: cartões de mês, Assistente e Equipe | [Periodização e Gestão](AJUSTES_PERIODIZACAO_GESTAO_2026-11-13.md) |
| Restante do inventário — Financeiro, Atletas e demais papéis | [Cobertura e correções locais](REVISAO_INVENTARIO_RESTANTE_2026-11-13.md) |
| Correção das jornadas e área de escrita do Assistente | [Rotas atuais, legado e compositor](AJUSTES_JORNADAS_ASSISTENTE_2026-11-13.md) |
| Telas atuais — revisão local de 14/11 | [Cobertura e correções da rodada anterior](REVISAO_TELAS_ATUAIS_2026-11-14.md) |
| Pendências atuais — dados fictícios e comparativos | [Acessos, convites, WhatsApp, Planejamento e Scouting](PENDENCIAS_ATUAIS_2026-11-14.md) |
| Inventário organizado — acervo e novos estados atuais | [Hub por área, Avisos, Regulamentos e Planejamento](INVENTARIO_ORGANIZADO_2026-11-14.md) |
| Revisão de minimalismo da quadra — 04/10/2026 | [QUADRA_MINIMALISMO_REVIEW_2026-10-04.md](QUADRA_MINIMALISMO_REVIEW_2026-10-04.md) |
| Relatório da aula — visual aprovado e aplicação local | [RELATORIO_AULA_2026-10-06.md](RELATORIO_AULA_2026-10-06.md) |
| Histórico de relatórios — visual aprovado e aplicação local | [HISTORICO_RELATORIOS_2026-10-06.md](HISTORICO_RELATORIOS_2026-10-06.md) |
| Scouting — proposta visual e pesquisa de domínio | [SCOUTING_MOCKUP_2026-10-06.md](SCOUTING_MOCKUP_2026-10-06.md) |
| Scouting — coleta por jogada, app local e banco ativado | [SCOUTING_IMPLEMENTACAO_2026-10-07.md](SCOUTING_IMPLEMENTACAO_2026-10-07.md) |

[Scouting em vídeo — mockup dedicado e proposta técnica](SCOUTING_VIDEO_MOCKUP_2026-10-12.md).
[Implementação web local do estúdio](SCOUTING_VIDEO_IMPLEMENTACAO_2026-10-12.md): player, anotações, timeline, processamento local e compartilhamento por link; conferência autenticada local registrada, ativação remota pendente. [Continuidade e fonte YouTube](../operations/scouting-video-handoff-2026-10-13.md).

## Regra central

Web não é mobile esticado. Em desktop, usar a largura para criar hierarquia e
regiões de trabalho; em mobile, preservar as mesmas ações e informações em uma
ordem única, sem esconder a tarefa principal.
