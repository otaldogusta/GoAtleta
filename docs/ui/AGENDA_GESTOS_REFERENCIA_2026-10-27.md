# Agenda — referência de gestos em 27/10/2026

Refinamento local da web, após comparação da Agenda Samsung no SM-S931B
conectado por ADB. A inspeção usa a interface e gravação de tela; não extrai
código, dados ou recursos do aplicativo. Nenhum evento real foi alterado.

## Observação e adaptação

A gravação inclui arrastos de 180, 1.200 e 2.200ms em ambos os sentidos.
Nos trechos lentos amostrados, a seleção do mês percorreu aproximadamente
0,46–0,48 do deslocamento comandado do dedo. Isso orienta ganho 0,5 somente
na dobra web; a lista conserva ganho 1. Não determina a curva proprietária
nem certifica equivalência de FPS. O adaptador nativo não mudou nesta revisão.

O movimento web agora conserva uma distância contínua entre mês e lista:

- Recolher consome a dobra; a sobra do mesmo delta rola a lista.
- Descer consome primeiro a distância até o topo da lista; a sobra abre o mês,
  inclusive invertendo sem soltar o ponteiro.
- Limites descartam excesso, permitindo resposta imediata à inversão.
- A lista usa medidas atuais do DOM, com cache apenas como fallback. O gesto
  mantém sua área de referência para não misturar frames da animação.
- Soltar com a lista ainda rolada mantém a semana. Abrir pela alça ou teclado
  normaliza a lista antes da expansão, evitando salto no próximo gesto.

Mês/paginador persistentes, dono único do encaixe de 180ms, idle de wheel de
350ms, movimento reduzido e alternativa de teclado permanecem existentes.

## Evidência local

Localhost:8081 conferido em 1063×704 e 390×844, com oito aulas no dia 26:

- Wheel de 400px consumiu 368px de input na dobra de 184px e transferiu os
  32px restantes à lista. A inversão de 250px zerou a lista e abriu 109px.
- Doze passos lentos de 24px moveram a dobra 12px cada, sem retorno contrário.
- Oito ciclos rápidos e quarenta inversões conservaram a data; as camadas
  visíveis mantiveram soma de opacidade 1 nas amostras registradas.
- Arrasto móvel de 420px chegou à lista e ao seu limite real. No mesmo gesto,
  inverter 80px consumiu 41px de lista e abriu 19,5px do mês.
- Soltar após descer 20px com offset 41 manteve a semana e offset 21.
- Pausar com ponteiro pressionado manteve altura intermediária de 177,5px.

Capturas, gravação da referência e amostras ficam privadas em
`.tmp/agenda-reference-20261027/`. São diagnósticos de posição e comportamento,
não benchmark de produção. A publicação e um novo APK não fazem parte do ajuste.

32 testes únicos em seis suítes aprovados: EventSheet (19), transferência web
(3), viewport (1), paginador (5), distância compartilhada (2) e gesto nativo (2).
O primeiro teste teve timeout de importação fria; carregar PanResponder no
setup resolveu a repetição focada, mantendo timeout de 5s. Tipos, lint,
higiene dos três arquivos de produção e diff aprovados. Abertura por teclado
com offset 41 voltou a zero no browser. Checklist regenerado.

Limite conhecido: redimensionar a janela durante um ponteiro capturado ainda
não rebasa a posição inicial para a nova altura de linha. Não foi objeto desta
matriz de movimentos em viewports fixos. A captura mobile-final.png foi excluída
da evidência visual: o driver alterou a escala durante a captura. As medidas de
gesto precedem essa captura; desktop-final.png confere a janela restaurada.
