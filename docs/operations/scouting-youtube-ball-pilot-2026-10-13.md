# Go Atleta — piloto de localização da bola somente pelo link

**Resultado: reprovado para integrar ao estúdio.** O Gemini retornou coordenadas
pelo link público, mas elas ficaram longe da bola na amostra conferida. Isso não
foi convertido em tracking nem aplicado ao rascunho.

## Execução e limites

- Vídeo: [amistoso informado pelo usuário](https://www.youtube.com/watch?v=mdfgd1K3HTc).
- Trecho: 20–40 segundos; uma única chamada, sem repetição, modelo existente
  `gemini-3.1-flash-lite`.
- Enviado: URL pública e prompt de localização; nenhum arquivo, frame local ou
  posição do detector anterior foi enviado ao Gemini.
- Solicitados: 80 instantes absolutos em grade de 0,25 s e `videoMetadata.fps=4`.
  A resposta não permite auditar quais frames o provedor efetivamente amostrou.
- Formato: centro normalizado na imagem inteira, x para direita e y para baixo.
  Sem interpolação/extrapolação. Bola incerta/não localizada mantém coordenadas
  nulas; isso não prova que a bola estava ausente.
- Resposta: 48 posições, 32 desconhecidas, sem linhas duplicadas/fora da grade.
  `formatComplete` significa somente formato/grade completos, não precisão.
- Uso informado: 6.454 tokens de entrada, 3.497 de saída, 9.951 no total. Não foi
  consultado faturamento; os tokens não são um recibo de custo monetário.

Ferramenta isolada: `scripts/scouting-youtube-ball-pilot.mjs`. Importar o módulo
não lê credenciais nem chama a API. A CLI só lê a configuração local existente
quando invocada explicitamente; não imprime/salva a chave. O destino padrão da
evidência é `.tmp/scouting-youtube-ball-pilot/result.json`, ignorado pelo Git.
Timeout 75 s, saída limitada a 8.192 tokens, uma chamada inclusive em erro,
truncamento ou indisponibilidade. Não há endpoint novo nem botão no app.

Para uma futura execução autorizada, a CLI recebe ID e intervalo explicitamente:

```powershell
node scripts/scouting-youtube-ball-pilot.mjs --video-id mdfgd1K3HTc --start 20 --end 40
```

Esse comando faz uma nova chamada real e pode gerar consumo. Não executá-lo para
apenas consultar o resultado já salvo.

## Conferência visual independente

Antes de consultar as predições, foram inspecionados 20 frames do original local
nos segundos inteiros 20–39, incluindo ampliações. A referência contém 14 centros
observáveis e seis desconhecidos. O original foi usado apenas na avaliação local.

| Medida na referência observável | Resultado |
| --- | ---: |
| Frames com bola localizada manualmente | 14 |
| Frames em que o Gemini também deu coordenadas | 8 |
| Frames observáveis sem coordenadas Gemini | 6 |
| Posições dentro de 15 pixels da referência | 0 de 8 |
| Menor distância | 43,4 px |
| Distância mediana | 66,5 px |
| Maior distância | 407,1 px |

Distância euclidiana calculada na resolução original 1202×676. A tolerância de
15 px é declarada apenas para este piloto; os oito erros excederam 43 px.
Os seis frames desconhecidos da referência não foram usados para afirmar falsos
positivos nem ausência da bola. A avaliação cobre somente segundos inteiros,
não certifica todos os 80 instantes ou outros jogos. Cinco mosaicos pareados
foram inspecionados; verde indica referência visual e rosa a coordenada Gemini.

Evidências locais ignoradas:

- `reference/manual-reference.json`: anotações e notas de visibilidade;
- `result.json`: saída validada, sem credenciais;
- `visual-evaluation.json`: distâncias por amostra e limites;
- `comparison-01.png` a `comparison-05.png`: frames e posições pareadas;
- `evaluate.py`: cálculo e renderização locais, sem rede ou upload.

Todos estão sob `.tmp/scouting-youtube-ball-pilot/`. Dados/frame privados não
integram assets públicos. O rascunho YouTube de 78 rallies/201 contatos/20.222
posições e o rascunho original foram preservados.

## Decisão e validação

Não oferecer esse resultado como tracking automático do produto. A resposta
completa e os 60% de instantes com coordenadas não representam taxa de acerto.
Este teste reprova a configuração/modelo usados; não prova impossibilidade de
qualquer modelo, configuração de resolução ou abordagem futura por link.

Alteração funcional localizada em ferramenta de pesquisa: 12 testes mockados
do request, grade, incerteza, cancelamento, erros/truncamento sem retry e proteção
da credencial passaram, além do lint focado, tipos do app e diff. Smoke do caminho real é a chamada
única acima, seguida da revisão visual; a interface não mudou nesta rodada.
Nenhum deploy, upload do original, migração, treinamento, commit ou push.

Fontes primárias: [vídeo por URL no Gemini](https://ai.google.dev/gemini-api/docs/video-understanding),
[VideoMetadata/FPS no GenerateContent](https://ai.google.dev/api/generate-content#VideoMetadata),
[localização de objetos e coordenadas](https://ai.google.dev/gemini-api/docs/image-understanding#object-detection).
Essas capacidades documentadas não certificam a precisão para uma bola de vôlei.
