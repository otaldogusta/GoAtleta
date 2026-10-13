# Go Atleta — viabilidade de processamento no navegador

Teste local em 12/10/2026, no navegador integrado do Codex, em localhost:8081.
Modelo VballNetGridV2b ONNX (4.707.708 bytes), ONNX Runtime Web 1.30.0.
Sem upload, API paga, instalação de servidor de inferência ou alteração de
dependências do aplicativo. Worker dedicado mantém a inferência fora da UI.

## Medições

Trecho: primeiros 3 segundos do clipe local 07:30–08:00 do amistoso,
90 quadros de 30 fps. Dez lotes de nove imagens 768×432, escala de cinza.
Pré-processamento no canvas e buscas temporais incluídos no total.

| Execução | Preparação | Inferência acumulada | Total |
| --- | ---: | ---: | ---: |
| CPU / WASM, 1 thread | 0,67 s | 7,33 s | 12,08 s |
| WebGPU, primeira execução | 1,44 s | 2,73 s | 7,57 s |
| WebGPU, repetição com arquivos em cache | 1,29 s | 1,86 s | 7,58 s |

GPU: após preparação, lotes finais em aproximadamente 80–100 ms. Leitura dos
quadros e preparação ainda representam parcela relevante do total. Não
extrapolar estes três segundos para estimar o tempo de uma partida inteira.

As três execuções produziram 69 candidatos acima do limiar 0,5 em 90 quadros.
Isso é cobertura, **não precisão**. Miniaturas foram inspecionadas: há quadros
com e sem marcação; não houve anotação de referência para medir os erros.
O teste não aplica os filtros de cor específicos do amistoso nem sugere rallies.

Heap observado na página: picos aproximados de 34,1 MB (CPU), 29,5 MB e
52,4 MB (GPU). Esses números **não representam memória total**: não incluem
de forma confiável Worker, WASM, decodificação e GPU. Não comprovam adequação
para celular ou estabilidade em vídeos longos.

## Decisão e próximos limites

Compatibilidade CPU e GPU comprovada neste computador. Vale prosseguir com
um processamento por lotes, carregamento sob demanda e cancelamento.
O botão Automático do estúdio não foi habilitado por este experimento.
Ainda faltam integração, progresso, revisão sem sobrescrever marcações,
persistência dos resultados, medição total de memória e avaliação em celular.
Sugestão de cortes é um algoritmo separado; este modelo localiza a bola.

Fontes reproduzíveis: [teste](../../scripts/scouting-browser-benchmark/README.md).
Arquivos grandes e resultados visuais permanecem na pasta local de artefatos;
a pasta temporária foi retirada de `public` após a medição. Nenhuma publicação.
