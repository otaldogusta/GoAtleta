---
name: goatleta-data-model
description: Rastrear entidades, vínculos e histórico do Go Atleta antes de alterar alunos, matrículas, turmas, equipe, presença ou planos; evitar equivalências incorretas entre modelos.
---

# Modelo de dados do Go Atleta

Resolver caminhos na raiz. Começar em `src/core/models.ts`, `src/db/row-types.ts`, módulo de persistência correspondente e migrations que definem/evoluem a entidade. Tipos de frontend não provam schema remoto aplicado; confirmar o ambiente quando a tarefa exigir estado remoto.

## Distinções essenciais

- Identidade de aluno não é vínculo com turma: rastrear `students` e `student_class_enrollments` em `src/db/students.ts`. Não presumir que mover turma deve apagar/recriar a pessoa.
- Inativação operacional, matrícula, acesso ao app e estado financeiro são dimensões diferentes. Não usar uma como substituta de outra.
- Plano de treino, aula/sessão e presença são registros distintos. Não inferir execução a partir de um plano gerado.
- Organização, unidade, turma e vínculo de equipe têm semânticas próprias. Confirmar FKs, cardinalidade e período de vigência; não substituir o modelo por uma árvore conceitual do texto de referência.

Para cada alteração, registrar campo/entidade afetado, identificador, escopo organizacional, mapeamento de row, consumidores e efeito no histórico. Conferir caches/filas e compatibilidade entre nomes de coluna e propriedades TypeScript.

Reusar os testes `src/db/__tests__/student-enrollment-lifecycle.test.ts`, `student-operational-status.test.ts` e `class-delete-preserves-students.test.ts` quando esses contratos forem alterados. Preservar histórico por padrão, sem impedir fluxos legítimos de exclusão já definidos pelo produto/LGPD.

Quando a tarefa exigir schema/RLS, complementar com `.agents/skills/goatleta-database/SKILL.md`; não gerar migration apenas para fazer o código coincidir com um diagrama hipotético.
