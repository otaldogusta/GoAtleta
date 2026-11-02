# Estúdio — proposta v2

[Mockup interativo](scouting-unified-2026-11-02-v2.html). Mantém a
[referência anterior](scouting-unified-2026-11-02.html) para comparação.
Artefato isolado de pesquisa, sem APIs, bibliotecas, recursos remotos, câmera,
persistência ou alteração do produto. O cabeçalho sinaliza **dados ilustrativos**.

## Organização preservada

- Áreas principais: **Registrar / Vídeo / Câmera**.
- No Vídeo, inspetor com **Recortes / Scouting / Informações**. Contatos do
  ponto permanecem em Scouting; processamento e configuração em Informações.
- Transporte mantém a ordem real: marcação anterior, quadro anterior, play,
  quadro seguinte, próxima marcação, relógio, trajetória, contato, ponto e
  velocidade. Compactação visual não elimina quadro a quadro nem suas ações.
- Timeline mantém a composição real: segmentos, marcadores de contatos,
  contexto/intervalo e faixa **Bola**. Recorte selecionado mostra seus contatos;
  **Vídeo completo** restaura a escala macro. Dados e interações são simulados.
- Configurações secundárias ficam recolhidas. Não há modais sobrepostos.

## Estados clicáveis

| Estado | URL |
| --- | --- |
| Recortes | `?mode=video&tab=cuts` |
| Scouting e contatos | `?mode=video&tab=scouting` |
| Informações e acompanhamento | `?mode=video&tab=info` |
| Registro compacto | `?mode=registrar` |
| Câmera | `?mode=camera` |

Abas suportam setas, Home/End, foco visível e ativação por teclado. Controles
têm rótulos acessíveis. O seek é um range nativo. Em telas estreitas o inspetor
fica abaixo da área principal; a escala tipográfica permanece compacta.
O breakpoint de 900 px acompanha o estúdio especializado já aprovado, mantendo
vídeo e inspetor lado a lado no viewport informado de 1063 × 704. Em celular,
o transporte quebra em linhas e conserva também o controle de trajetória.
Os ícones do transporte ocupam alvos de 40 × 44 px, com fundo visível menor;
a compactação não usa zoom da página.

## Registro e 5 × 1: hipóteses, sem novo contrato de domínio

Registrar explora **Ponto**, **Falta nossa**, **Falta adversária**, **Freeball**
e **Bloqueio com continuidade**. Selecionar uma ação só prepara a confirmação.
No exemplo, faltas/resultado terminal atualizam o placar em memória após
confirmar; freeball/continuidade adicionam uma observação e mantêm o placar.
Desfazer recupera a última ação ilustrativa. Isso não introduz enums, resultados
ou regras de atribuição no scouting oficial.

A nova marcação começa em **Sem atleta**, sem camisa previamente selecionada.
O resumo e os estados acessíveis acompanham essa escolha explícita; camisas
conhecidas nos exemplos de revisão do vídeo continuam preservadas.

Freeball é uma hipótese de acesso ao contexto da jogada, sem convertê-lo
prematuramente em fundamento. Bloqueio com continuidade é apresentado sem
atribuir ponto. Identificação do atleta e detalhamento final exigem reconciliação
com os critérios oficiais antes de qualquer implementação.

A quadra **5 × 1** é um esquema ilustrativo. P1/P6/P5/P4/P3/P2 apenas mudam a
referência visual do levantador. Camisas e distribuição não representam o elenco,
formação real, leitura automática de rodízio ou recomendação tática.

## Referências e limites

Referências lidas: `ScoutingWorkspace.web.tsx`, transporte de
`ScoutingVideoStudio.web.tsx`, `VideoTimeline.web.tsx`, `studio-styles.ts`,
skills locais de design system/uso na quadra/web e `DESIGN_SYSTEM.md`.
Navy/superfícies, verde, tipografia 12/11, raios 12/14 e controles visuais
compactos seguem os tokens existentes. SVG do ginásio reutilizado do mockup
anterior. Não há imagens ou fontes externas.

Sintaxe do JavaScript, integridade dos IDs referenciados e ausência de recursos
remotos conferidas localmente. Smoke DOM isolado verificou os três modos e
abas, seleção de sets, timeline/quadro a quadro, continuidade sem ponto,
falta/desfazer, referência P6 e simulação da câmera. Isso não mede layout.
Inspeção visual/interativa concluída no browser em 1063 × 704 e 390 × 844,
sem overflow horizontal. O transporte preserva os controles e alvos de toque,
com quebra de linha na largura móvel. Não há evidência de uso físico no celular.
