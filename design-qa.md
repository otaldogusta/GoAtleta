# Design QA — menu de perfil do sidebar compacto

## Fonte de verdade

- Rota autenticada: `http://localhost:8081/prof/home`
- Referência visual: `C:\Users\gusta\Downloads\GoAtleta\artifacts\design-qa\profile-menu-reference-chatgpt.png`
- Screenshot da implementação: `C:\Users\gusta\Downloads\GoAtleta\artifacts\design-qa\profile-menu-compact-desktop.png`
- Comparação lado a lado: `C:\Users\gusta\Downloads\GoAtleta\artifacts\design-qa\profile-menu-reference-comparison.png`
- Estado comparado: sidebar compacto, tema escuro, menu de perfil aberto.

## Viewport, pixels e densidade

- Referência: bitmap de 1194 × 892 px; densidade não informada pela origem.
- Implementação principal: viewport CSS e bitmap de 1209 × 812 px, DPR 1,8.
- Comparação: canvas de 2418 × 856 px. A referência foi redimensionada proporcionalmente e centralizada em um painel de 1209 × 812 px; a implementação permaneceu em escala 1:1.
- Breakpoints adicionais verificados:
  - celular: 390 × 844 CSS px, DPR 0,9, sem overflow horizontal global; o sidebar web não é exibido nesse breakpoint;
  - tablet: 834 × 1194 CSS px, DPR 0,9; menu com 304 × 205 px totalmente contido no viewport;
  - desktop amplo: 1440 × 1024 CSS px, DPR 0,9; menu com 304 × 205 px totalmente contido no viewport.

## Comparação visual

- O padrão visual solicitado foi preservado: superfície flutuante escura, identidade da conta no topo, divisores e ações agrupadas.
- A largura de 304 px e a densidade operacional do GoAtleta foram mantidas em vez de copiar literalmente as dimensões do ChatGPT.
- Avatar, nome, função, chevron, ação de configurações e saída permanecem alinhados ao sistema visual existente.
- O menu conserva contraste e legibilidade tanto sobre o tema escuro quanto sobre o tema claro.
- Não foram criados ativos aproximados: os ícones existentes do GoAtleta foram reutilizados.

## Interação e acessibilidade

- O avatar compacto abre o menu por clique e por `Enter`.
- `Esc`, clique externo e o próprio avatar fecham o menu.
- `Perfil e configurações` navega para `/prof/profile`.
- O menu expõe os nomes acessíveis `Menu de perfil`, `Abrir menu de perfil` e `Fechar menu de perfil`.
- Console: nenhum erro. Permanecem dois warnings globais já conhecidos do React Native Web (`pointerEvents` e `shadow*` depreciados), fora do escopo desta regressão.

## Histórico de refinamento

1. P1 — o estado do menu era atualizado, mas a renderização estava condicionada a `expanded`, tornando o clique do avatar compacto invisível; a condição foi removida.
2. P1 — foi adicionado teste de regressão que renderiza o sidebar compacto, aciona o avatar e confirma identidade e ações do menu.
3. P2 — o ambiente de teste não disponibilizava `localStorage`; foi incluído um mock local ao teste, sem alterar o comportamento de produção.
4. P3 — o carregamento assíncrono dos ícones gerava ruído de `act(...)`; o registro de ícones foi substituído apenas no teste.

## Resultado final

final result: passed
