# Animation Log

Registro oficial de animações do app para facilitar manutenção e reaproveitamento.

## Como usar este log

- Cada nova animação deve entrar aqui no mesmo PR.
- Descrever gatilho, duração, curva e objetivo de UX.
- Sempre apontar o arquivo onde está implementada.

## Catálogo atual

### 1) Assistant • Thinking dots (digitando)

- Local: `app/assistant/index.tsx`
- Objetivo: sinalizar processamento sem bloquear o usuário.
- Gatilho: `loading = true`.
- Implementação:
  - `Animated.loop(Animated.sequence([...]))`
  - 3 pontos com `opacity + translateY` defasados.
- Parâmetros:
  - `duration`: 700ms por fase
  - `useNativeDriver`: `true`

### 2) Assistant • Botão Enviar aparece ao digitar

- Local: `app/assistant/index.tsx`
- Objetivo: reduzir ruído visual quando o campo está vazio.
- Gatilho: `input.trim().length > 0`.
- Implementação:
  - `Animated.timing(sendButtonAnim)`
  - Entrada com `opacity + scale + translateY`.
- Parâmetros:
  - `duration`: 180ms
  - `scale`: `0.82 -> 1`
  - `translateY`: `6 -> 0`

### 3) Assistant • Expandir sugestões com botão +

- Local: `app/assistant/index.tsx`
- Objetivo: mostrar apenas 3 sugestões iniciais e expandir sob demanda.
- Gatilho: toque no botão `+`.
- Implementação:
  - `Animated.timing(suggestionsExpandAnim)`
  - Bloco extra com `maxHeight + opacity + translateY`.
- Parâmetros:
  - `duration`: 220ms
  - `maxHeight`: `0 -> 140`
  - `translateY`: `-6 -> 0`

### 4) Assistant • Rotação do botão +

- Local: `app/assistant/index.tsx`
- Objetivo: feedback claro de estado (fechado/aberto).
- Gatilho: `suggestionsExpanded`.
- Implementação:
  - `interpolate` de rotação no ícone.
- Parâmetros:
  - `rotate`: `0deg -> 45deg`

## Padrões de motion (reuso)

### A) Reveal curto (ação contextual)

- Uso recomendado: botões contextuais que surgem após input.
- Config padrão:
  - `duration`: 160–220ms
  - propriedades: `opacity + scale`
  - `useNativeDriver`: `true` quando possível

### B) Expand/collapse de grupos

- Uso recomendado: seções secundárias (chips extras, filtros avançados).
- Config padrão:
  - `duration`: 200–260ms
  - propriedades: `maxHeight + opacity + translateY`
  - `useNativeDriver`: `false` quando animar layout/altura

## Checklist para novas animações

1. Tem objetivo funcional de UX (não só enfeite)?
2. Duração curta e consistente com o resto da tela?
3. Respeita desempenho em device low-end?
4. Foi registrada neste arquivo?
