# Guia de PR Pequeno

## Objetivo

Manter a evolucao do catalogo revisavel, testavel e facil de reverter.

## Regra operacional

Cada PR deve mudar uma camada principal:

- documentacao;
- catalogo;
- mapeamento;
- score;
- auto-plan;
- UI futura.

Evite juntar expansao massiva de catalogo com mudanca de engine.

## Ordem recomendada

1. Documentacao operacional do catalogo.
2. Pequena expansao de familias e variantes.
3. Ajustes de score com testes focados.
4. Exposicao de explicabilidade para UI futura.
5. Tela de biblioteca usando o mesmo catalogo.
6. Persistencia, somente depois de validar uso real.

## Checklist de revisao

- O PR nao cria tabela Supabase sem decisao explicita.
- O PR nao altera `decisionTrace` persistido sem justificativa de contrato.
- O catalogo permanece original do GoAtleta.
- Os testes cobrem periodizacao, idade, scouting e anti-repeticao.
- A documentacao foi atualizada quando o contrato mudou.
- O plano aplicado continua convergindo para `TrainingPlan.pedagogy.blocks`.

## Modelo de descricao de PR

```md
## Resumo

Documenta ou altera uma fatia pequena do Catalogo Pedagogico.

## O que mudou

- ...

## O que nao mudou

- Sem migration.
- Sem tabela Supabase.
- Sem mudanca de schema persistido do decisionTrace.

## Validacao

- [ ] npm test -- src/core/__tests__/activity-catalog.test.ts --runInBand
- [ ] npm test -- src/core/__tests__/humanized-volleyball-lesson.test.ts --runInBand
- [ ] npm test -- src/core/__tests__/build-auto-plan-for-cycle-day.test.ts --runInBand
- [ ] npm run typecheck:core

## Riscos

- ...
```

## Titulo sugerido

Para documentacao:

```txt
docs: documenta catalogo pedagogico
```

Para catalogo ou motor:

```txt
core: expande catalogo pedagogico
```

## Changelog curto

```md
### Added
- Documentacao operacional do Catalogo Pedagogico.

### Validation
- Verificacoes documentais e typecheck do core.
```
