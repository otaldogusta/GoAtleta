# GoAtleta Brand Application Notes v1.3

## 1. Telas Ajustadas

- Aula do Dia: contexto da sessão, bloco resistido, prévia pedagógica e modal de edição.
- Periodização: painéis semanais, controles de ciclo e agenda competitiva.
- Alunos: busca/lista, agrupamento por unidade/turma e parte inicial do cadastro.
- Chamada: card de data, lista de alunos e controles de presença/falta.
- Turmas: cards de turma e cabeçalhos por unidade.
- Home do Professor: hero da aula atual, seletor semanal e agenda do dia.
- Coordenação/Relatórios: resumo executivo e suporte de sincronização.
- Navegação: ação radial de assistente sem expor IA como marca principal.

## 2. Componentes Reutilizados

- `src/theme/tokens.ts`: `radius`, `shadow`, `brandPalette`.
- `src/ui/app-theme.tsx`: `surface`, `backgroundSubtle`, `textPrimary`, `textSecondary`, `textMuted`, `borderSubtle`, `success`, `warning`, `danger`.
- `getSectionCardStyle`: mantido como base para cards existentes.
- `Button`, `Pressable`, `ModalSheet`, `ClassGenderBadge`, `DateInput`.

## 3. Onde A Identidade Ficou Mais Forte

- Scouting continua sendo a vitrine operacional da marca.
- Home ganhou mais coerência com navy/areia/quadra sem depender de hardcodes antigos.
- Chamada usa verde/vermelho de forma mais semântica.
- Aula do Dia e Periodização passaram a usar superfícies sólidas e bordas sutis nos painéis principais.
- Coordenação ficou mais institucional ao trocar “IA Assistiva” por “Assistente”.

## 4. Dívida Visual Restante

- Ainda existem telas longas com estilos inline antigos, especialmente `app/class/[id]/session.tsx`, `app/class/[id]/students.tsx`, `app/periodization/index.tsx`, `app/profile.tsx` e telas de treino.
- Alguns trechos dev-only de QA/debug seguem presentes na Periodização por contrato de teste e devem continuar escondidos fora de QA.
- Parte dos modais antigos ainda usa muita composição local em vez de componentes centrais.
- Relatórios/PDF não foram redesenhados neste pacote.

## 5. Regras Para Próximos Desenvolvimentos

- Usar tokens antes de criar qualquer cor, radius ou sombra local.
- Preferir `surface` + `borderSubtle` a sombras fortes.
- Usar `radius.internal` para inputs, `radius.card` para cards e `radius.full` para pills.
- Não criar cards dentro de cards quando separadores e espaçamento resolvem.
- Manter textos técnicos fora da UI final.

## 6. Cores Que Não Devem Ser Usadas Fora Dos Tokens

- Evitar hex solto para navy, areia, verde, âmbar, vermelho e azul.
- Exceções aceitáveis: overlays translúcidos e integrações externas com cor de marca, como WhatsApp.
- Para estados, usar sempre `success`, `warning`, `danger` e `info`.

## 7. Dark Mode

- Não usar `#FFFFFF`, `#101827` ou `rgba(15,23,42,...)` em telas finais quando houver token equivalente.
- Superfícies devem vir de `surface`, `surfaceElevated`, `background` ou `backgroundSubtle`.
- Texto deve vir de `textPrimary`, `textSecondary` ou `textMuted`.

## 8. Como Evitar Excesso De Verde

- Verde quadra é CTA principal, sucesso e performance positiva.
- Atenção/revisão é âmbar.
- Falta, erro e perigo são vermelho.
- Informação neutra usa navy, grafite ou azul/info com moderação.

## 9. Como Evitar Card Dentro De Card

- Usar uma superfície principal com seções separadas por `borderTop`.
- Usar chips pequenos para metadados.
- Usar cards internos apenas para itens repetidos ou estados realmente destacados.

## 10. Checklist Visual Antes De Abrir PR

- A tela usa tokens centrais?
- CTAs têm hierarquia clara?
- Verde aparece só onde há ação principal ou sucesso?
- Alertas usam âmbar e erros usam vermelho?
- Dark mode não depende de branco/preto hardcoded?
- Texto técnico como debug, snapshot, provider, fallback, confidence ou IA não aparece na UI final?
- Mobile empilha sem esconder ação principal?
- Web mantém largura, borda e densidade coerentes?
