# Validação da governança — Go Atleta

Executada em 01/10/2026, no worktree local. Escopo: ferramenta Python de seleção, regras, métricas e instruções do agente. Validação funcional focada em tooling; sem mudança no runtime TypeScript, no banco ou nas telas do aplicativo.

## Defeitos reproduzidos e corrigidos

| Caso | Antes | Resultado verificado |
| --- | --- | --- |
| Adicionar campo texto à ficha do atleta | Selecionava apenas UI por encontrar “texto” | Preserva segurança, banco e modelo de dados; informa divisão quando há mais de seis candidatas |
| Corrigir texto do botão de login | Carregava autorização e Supabase por “corrigir” e “login” | Seleciona design system e acessibilidade para essa alteração cosmética |
| Aula do Dia com quebras de linha/espaços | Perdia correspondência da expressão | Normalização produz a mesma seleção da frase em uma linha |
| Mais de seis candidatas, inclusive seleção explícita | Excedentes listadas sem indicador de seleção incompleta | `requires_staging` e `needs_inspection` exigem revisão/divisão em etapas |
| Log de métricas malformado | Erro de parsing sem tratamento | Identifica a linha inválida, sem expor seu conteúdo ou modificar o arquivo |

## Evidência

- `python scripts/test-skill-selection.py`: **21 testes aprovados**; um deles percorre uma matriz de **16 cenários** com expectativas de domínio/tecnologia. Os demais incluem regressões, prioridade, limite, CLI real, UTF-8, privacidade, leitura sem gravação e métricas inválidas.
- Matriz: RLS, migrations, permissões, copy/layout, Aula do Dia, voleibol, Android/FPS, composição React, CI, comentários de PR, fluxo web, documento pedagógico, acessibilidade, autenticação e ficha do atleta.
- `python scripts/test-installed-skill-helpers.py`: **oito regressões offline aprovadas**, sem chamadas a GitHub ou alteração de PR.
- `python scripts/validate-installed-skills.py`: **849/849 entradas válidas**, sem falhas de formato. Esse check não executa os helpers recebidos.
- Validador oficial da skill `goatleta-feature-workflow`: aprovado.
- Verificação da marca pública e `git diff --check`: aprovados.
- A cobertura de hashes dos 12.536 arquivos já havia passado no fechamento da instalação. Esta rodada não repete nem apresenta aquela comparação como uma nova auditoria de segurança; nenhuma skill externa foi alterada.

## Métricas e limites

Fixtures de testes ficam em diretórios temporários e não entram nas métricas de desenvolvimento. O comando comum foi exercitado por subprocesso e deixou o log de uso inalterado. Somente o fechamento desta tarefa real é acrescentado com `--record-used`, além do registro real anterior.

Os testes confirmam o comportamento dos cenários descritos, não uma compreensão perfeita de linguagem natural. Negação, múltiplas intenções e terminologia nova ainda exigem inspeção do código e ajuste da seleção pelo agente. `--include` não autoriza executar a skill nem resolve automaticamente impacto de segurança adiado por falta de espaço na etapa.

Não foram fabricadas 20–30 tarefas de produto para inflar a amostra. Essa avaliação longitudinal depende de trabalho real posterior. A camada é consultiva e documental: não intercepta todas as invocações do Codex, não executa automaticamente as validações recomendadas e não constitui auditoria integral dos scripts do catálogo.

Nenhuma navegação autenticada, E2E de produto, migration, instalação adicional, commit, push ou deploy fez parte desta rodada.
