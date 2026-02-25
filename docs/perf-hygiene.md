# Perf Hygiene Rules

Objetivo: evitar regressões de performance (CPU, memória, bateria e jank) sem redesign.

## 1) Render e Props
- Evite objetos/arrays inline em props de componentes memoizados.
- Use `React.memo` em rows/cards de listas.
- Use `useCallback` para handlers que cruzam boundaries de componentes.

## 2) Derivações
- `filter/map/sort/groupBy` em coleções não triviais devem estar em `useMemo`.
- Prefira normalização por id (`Map`/lookup) para reduzir recálculo.

## 3) Efeitos e Rede
- Todo `useEffect` de load precisa de cancelamento/guard (`alive`/abort).
- Evite refetch desnecessário por dependências instáveis.
- Nomeie medições:
  - load: `screen.<feature>.load.<target>`
  - render: `screen.<feature>.render.<target>`

## 4) Listas
- Use `FlatList` para volume real.
- `keyExtractor` sempre estável.
- Ajuste windowing quando necessário:
  - `initialNumToRender`
  - `maxToRenderPerBatch`
  - `windowSize`
  - `removeClippedSubviews` no Android

## 5) Instrumentação mínima por tela
- `markRender("screen.<feature>.render.root")`
- `measureAsync("screen.<feature>.load.initial", ...)`

## 6) Guardrails automáticos
- Script padrão: `npm run check:perf-hygiene`
- Script strict: `npm run check:perf-hygiene:strict`
- Workflow: `.github/workflows/perf-hygiene.yml`
- Regra base: telas alteradas em `app/**` e `src/screens/**` com `export default function` precisam conter `markRender` e `measureAsync`.
- Regra strict: bloqueia novo `style={{...}}` adicionado em contexto de row/lista (`renderItem` ou `.map(`).

Exceções devem ser explícitas no arquivo:
- `perf-check: ignore-render`
- `perf-check: ignore-measure`
- `perf-check: ignore-inline-row-style`
