---
name: goatleta-feature-workflow
description: Coordenar implementação de features e correções do Go Atleta que cruzam áreas ou exigem seleção de skills e validação; manter microajustes no ciclo rápido existente.
---

# Fluxo de desenvolvimento do Go Atleta

Resolver caminhos a partir da raiz. Esta skill organiza o trabalho; regras de domínio e comandos permanecem nas fontes especializadas.

1. Entender o resultado solicitado, áreas afetadas e escopo autorizado. Inspecionar a árvore de trabalho e preservar alterações anteriores. Se faltar uma decisão essencial, perguntar e continuar a investigação independente; não inventar campos, requisitos ou defeitos.
2. Selecionar até seis skills principais por etapa, sem mínimo obrigatório, pelas camadas e regras em `docs/operations/skill-governance.md`. Preferir o núcleo local e consultar a matriz em `docs/operations/agent-skills.md`. O comando `python scripts/explain-skill-selection.py "<tarefa>"` explica uma sugestão inicial; confirmar o impacto no código antes de adotá-la. Explicar a seleção na atualização inicial. Carregar somente as selecionadas e referências necessárias; não percorrer recursivamente o catálogo.
3. Ler os arquivos e testes do fluxo existente antes de editar. Usar arquitetura e regras do domínio quando a mudança as afetar; não impor essa leitura completa a um ajuste de texto/cor.
4. Classificar o risco pela fonte única `docs/operations/validation-ladder.md` e indicar o nível e a evidência prevista. Usar `goatleta-testing` para escolher testes quando houver lógica, persistência ou fluxo integrado. Reclassificar apenas se aparecer novo risco.
5. Implementar a menor mudança consistente com os contratos existentes. Não transformar a tarefa em refatoração geral nem criar tecnologia paralela por sugestão de skill externa.
6. Executar os checks aplicáveis e testar o comportamento afetado primeiro em `http://localhost:8081` quando houver interface. Registrar bloqueios e distinguir mock, SQL isolado, browser e dispositivo. Instruções/documentação sem runtime exigem formato, referências e diff; não iniciar o app sem motivo.
7. Quando houver dados, autenticação ou permissões, revisar o limite de autorização desde o início e conferir no fechamento os casos negativos relevantes. Usar `goatleta-security`; revisão focada não implica auditoria exaustiva nem permissão para gravar em produção.
8. Resumir arquivos alterados, comportamento, validação executada e pendências reais. Registrar as skills efetivamente lidas/utilizadas com `--record-used`, distinguindo-as das sugeridas; o log local não guarda o texto da tarefa. Commit/push, aplicação remota e deploy seguem a autorização da tarefa; a conclusão dos checks não os autoriza. Antes de executar helpers externos novos ou alterados, aplicar a revisão de execução de `AGENTS.md`.

Em microajustes, aplicar diretamente o ciclo rápido de `AGENTS.md` e a skill específica necessária. Não criar um plano longo, executar gates amplos ou acionar toda uma linha da matriz por palavra-chave.

Em release, usar o executor de `docs/operations/release-validation.md`: `npm run build:verified` (checks e export) ou `npm run validate:app` (checks). Não repetir manualmente checks já aprovados pelo executor para os mesmos inputs. O cache é local, tem invalidação por conteúdo e não substitui smoke autenticado ou autorização. Falhas exigem ler o log do check e corrigir a causa; nunca fabricar recibos.
