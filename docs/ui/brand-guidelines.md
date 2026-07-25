# Diretrizes de Marca e Estilo Visual (UI & PDF)

Este documento estabelece as diretrizes visuais, de design e de exportação de relatórios para o GoAtleta. Ele unifica as regras de aplicação de marca no app e a direção visual para exportações em PDF.

---

## 🎨 1. Diretrizes de Cores e Tokens de Marca

As decisões visuais devem sempre obedecer aos tokens definidos em `src/theme/tokens.ts` e `src/ui/app-theme.tsx`. 

### Cores Semânticas de Estado
- **Verde Quadra**: Usado estritamente para CTAs principais (botões de ação primária), estados de sucesso, sinal de presença confirmada ou indicadores de performance positiva.
- **Âmbar**: Usado para atenção, alertas operacionais, revisões recomendadas ou sinalização de cargas físicas que exijam cautela.
- **Vermelho**: Utilizado para exclusões, erros fatais, ausências (falta na chamada) ou riscos críticos.
- **Navy, Grafite e Areia**: Cores neutras utilizadas para a estrutura do app, fundos, cabeçalhos, textos e metadados.

### Regras de ouro para Cores e Tokens
- **Evite Cores Hardcoded**: Não utilize cores hexadecimais soltas (ex: `#FFFFFF`, `#101827`, etc.) diretamente nas telas. Use tokens como `surface`, `borderSubtle`, `textPrimary` e `textSecondary`.
- **Modo Escuro (Dark Mode)**: Cores de superfície e texto devem derivar dos tokens estruturais (`surfaceElevated`, `backgroundSubtle`, `textMuted`, etc.) para garantir compatibilidade com dark mode.
- **Evite Excesso de Verde**: O verde é uma cor de destaque e sucesso. Se a tela estiver muito verde, a hierarquia de CTAs será enfraquecida.

---

## 📐 2. Estrutura Visual e Componentização

- **Hierarquia de Bordas vs Sombras**: Prefira utilizar a combinação de `surface` + `borderSubtle` a aplicar sombras intensas nos cards e painéis.
- **Tokens de Raio (Border Radius)**:
  - `radius.internal`: Para caixas de input e campos de formulário.
  - `radius.card`: Para cartões e painéis informativos.
  - `radius.full`: Para pílulas, badges e botões arredondados.
- **Prevenção de Aninhamento Visual**: Não aninhe cartões dentro de outros cartões. Para separar subseções de conteúdo, prefira aplicar espaçamentos ou bordas horizontais (`borderTop`).
- **Limpeza Textual na UI**: Termos estritamente técnicos (como debugs, ids, estatísticas internas de IA, ou confidence metrics) devem ser omitidos das telas acessíveis ao treinador ou aluna.

---

## 📄 3. Direção Visual para Relatórios e PDFs

A geração de relatórios e exportações de PDFs deve seguir uma estética limpa, focada em legibilidade para impressão física:
- **Cabeçalho Principal**: Navy profundo com a identificação clara de turma, unidade, data e o logotipo/identificação GoAtleta.
- **Fundo de Página**: Branco sólido ou areia muito sutil.
- **Tabelas e Quadros**: Grades estruturadas com bordas simples e discretas. Sem sombras projetadas ou fundos de vidro (glassmorphism).
- **Tipografia**: Fontes de corpo simples, limpas e de fácil leitura rápida.
- **Design de Contraste**: Assegure que as cores escolhidas continuem distinguíveis se o documento for impresso em escala de cinza (preto e branco).

---

## 🏁 4. Checklist Visual de QA (Antes de Commits)

- [ ] Todos os novos elementos e layouts utilizam os tokens em vez de estilos CSS inline de cor/radius?
- [ ] O verde foi utilizado apenas para ações principais e sucessos operacionais?
- [ ] A tela se adapta responsivamente para o ambiente mobile (empilhamento de CTAs)?
- [ ] No ambiente desktop, a largura do navegador é bem aproveitada sem apenas esticar a interface mobile?
- [ ] Os textos e termos exibidos estão traduzidos de forma limpa para a linguagem cotidiana da quadra (português)?
