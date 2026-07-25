# Pedagogia Esportiva e Dimensões Científicas

Este documento reúne a fundamentação científica, o mapeamento de dimensões, a verificação de código e as diretrizes de expansão estratégica para o catálogo pedagógico de voleibol do GoAtleta.

---

## 🏛️ As 5 Dimensões Pedagógicas (Aprendizagem Motora 2020+)

A inteligência de planos baseia-se em 5 dimensões derivadas das teorias de aprendizagem motora (Schmidt & Lee, Abordagem de Dinâmica Ecológica, Constraint-Led Approach).

### 1. Variability (Variabilidade)
**Repetição em condições idênticas vs. variação de contexto.**
- **Baixa (Blocked)**: Repetições idênticas. Foco na fase de planejamento motor e controle cognitivo inicial.
- **Média (Variable)**: Mesma habilidade com alteração de contexto ou distâncias.
- **Alta (Random)**: Múltiplas habilidades e condições em sequência randômica (próximo ao jogo real).
- *Referência*: Schmidt & Lee (2020) - Contextual Interference Effect.

### 2. Representativeness (Representatividade)
**Proximidade da tarefa com a situação real de jogo.**
- **Baixa (Isolated)**: Exercícios descontextualizados sem opositores (ex: passe na parede ou em fila).
- **Média (Semi-Realistic)**: Exercícios de jogo com regras e dimensões simplificadas (ex: 2x2 sem rede).
- **Alta (Game-Realistic)**: Presença de oponentes, rede, regras de saque e pontuação.
- *Referência*: Ecological Dynamics Approach (Davids et al., 2008).

### 3. Decision-Making / Autonomy (Tomada de Decisão / Autonomia)
**Quantidade de escolhas táticas sob responsabilidade do atleta.**
- **Baixa (Coach-Directed)**: O professor dita todas as ações (onde passar, como bater).
- **Média (Guided)**: Professor estipula restrições; aluna escolhe a melhor ação dentro das opções.
- **Alta (Autonomy)**: Total liberdade de leitura e ação baseada no ambiente.
- *Referência*: Constraint-Led Approach (Renshaw et al., 2016).

### 4. Task Complexity (Complexidade da Tarefa)
**Exigência coordenada e cognitiva de cada exercício.**
- **Baixa (Simple)**: Elemento isolado (ex: apenas tocar a bola acima da cabeça).
- **Média (Moderate)**: Combinação de 2 a 3 habilidades (ex: deslocamento lateral + recepção + direcionamento).
- **Alta (Complex)**: Sequência de ações em alta velocidade com leitura de trajetória contínua.
- *Referência*: Fitts & Posner (1967) / Newell's Constraints Model (1986).

### 5. Feedback Frequency (Frequência de Feedback)
**Índice de correções e instruções verbais do professor.**
- **Baixa (Low)**: Correções resumidas apenas no final do bloco ou da sessão.
- **Média (Moderate)**: Feedbacks parciais ao término de sequências.
- **Alta (High)**: Feedback contínuo e corretivo repetição por repetição.
- *Referência*: Schmidt & Lee (2020) - Guidance Hypothesis.

---

## ⚙️ Arquitetura de Carga e Derivação do Perfil

O cálculo do perfil pedagógico ideal ocorre em duas etapas:
1. **Derivação Base**: Composto de `Idade da Aluna` $\rightarrow$ ajuste pelo `Nível da Turma` $\rightarrow$ ajuste pelo `Momento da Periodização (Fase)`.
2. **Refinamento de Performance**: Caso existam avaliações qualitativas recentes de scouting na turma, o motor ajusta as dimensões.
   - **Safety Gate**: Se a confiança amostral for classificada como `"baixo"`, o motor bloqueia alterações automáticas.
   - Todas as modificações e seus motivos são armazenados no array `RefinementReason` para auditoria do professor.

---

## 📈 Diretrizes de Expansão do Catálogo (Meses e Categorias)

O catálogo canônico de voleibol deve evoluir para manter a progressão ideal por faixa etária:

### Distribuição Pedagógica Mensal (Foco em Voleibol Iniciante Sub-10 / Mini 2x2)
- **Janeiro**: Familiarização, trajetória, controle inicial da bola e toque inicial.
- **Fevereiro**: Saque por baixo adaptado com alvo, continuidade com 2 ações.
- **Março**: Recepção (manchete), levantamento à frente e devolução em 3 ações.
- **Abril**: Direcionamento simples de quadra, mini 2x2 com movimentação.
- **Maio - Dezembro**: Progressões para mini 3x3, defesas, coberturas, ataques e transição controlada para o jogo formal.

---

## 🏁 Checklist de Verificação e Qualidade de Código

Sempre que a lógica pedagógica for alterada, garanta que os seguintes pontos passam nos testes estáticos:
- [ ] Rodar testes unitários: `npm test` ou `npm run jest src/core/__tests__/pedagogical-dimensions.test.ts`.
- [ ] Validação do linter: `npm run lint`.
- [ ] Garantir carregamento seguro: O parser em `src/bootstrap/pedagogical-config-loader.ts` deve decair graciosamente para o config padrão hardcoded em caso de JSON corrompido, sem quebrar o app.
- [ ] Confiança de RLS: Conferir se o isolamento por workspace (`organizationId`) está garantido ao resolver as avaliações no backend.
