# Go Atleta — avaliação local de WASB e GridV3

Comparação concluída em 14/10/2026. **Não substituir o GridV2b padrão:** WASB
Volleyball e GridV3 não aumentaram o número de acertos na referência independente
e produziram erros grandes. V4c continua como opção explícita de comparação.
Nenhuma posição candidata foi aplicada ao estúdio.

## Resultado no vídeo do usuário

Trecho 20–40 s do vídeo `mdfgd1K3HTc`, usando o original local já autorizado.
Os quatro modelos processaram os mesmos 600 quadros; a conferência pontual usou
20 instantes inteiros, com 14 posições observáveis e seis incertas.

| Modelo | Acertos até 15 px / observáveis | Omissões | Erros de localização | Maior erro localizado | Tempo CPU / 600 quadros | Quadros/s CPU |
|---|---:|---:|---:|---:|---:|---:|
| GridV2b — padrão atual | 10/14 | 3 | 1 | 15,98 px | 12,79 s | 46,92 |
| V4c — opção atual | 10/14 | 4 | 0 | 2,73 px | 14,52 s | 41,33 |
| WASB Volleyball — Step3 | 10/14 | 3 | 1 | 222,85 px | 129,01 s | 4,65 |
| GridV3 | 10/14 | 3 | 1 | 195,80 px | 9,59 s | 62,53 |

Maior erro considera somente posições emitidas em instantes observáveis;
omissões não entram nesse cálculo. Os seis instantes incertos não provam bola
ausente e não contam como acerto, erro ou falso positivo. **10/14 é um resultado
desta amostra, não precisão geral, F1 ou avaliação de todo o jogo.**

WASB recuperou 25 e 34 s, mas omitiu 21, 28 e 32 s. Em 30 s apontou para a região
dos jogadores, a 222,85 px da bola, apesar de score 0,797. GridV3 apontou para
outra região em 25 s, a 195,80 px, com score 0,687. GridV2b ficou 15,98 px da bola
em 25 s, pouco além da tolerância; V4c omitiu esse instante. A revisão dos mosaicos
confirmou esses casos. Maior velocidade do GridV3 não compensa esse erro para
promover o modelo com a evidência disponível.

## Método e limites

- Referência visual preparada antes de consultar essas saídas: frames completos
  e ampliações, sem usar a trajetória existente como verdade. SHA256
  `4ce567b90f7130559e38c6a1bd80e4a706ec70c0ce358baad36650aba027dd87`.
- Original 1202×676, 29,9999956 fps, seleção `round(time * fps)`. Tolerância de
  15 pixels nativos e limiar 0,5 fixados antes da comparação; sem interpolação
  nem ajuste de parâmetros pela referência.
- CPU, dois threads, Python 3.14.2, ONNX Runtime 1.31.0, PyTorch 2.9.1+cpu,
  NumPy 2.5.4 e OpenCV headless 5.0.0.93 em `.expo/wasb-venv/`, isolado do app.
  Tempo inclui preparação, inferência e decodificação das saídas; exclui leitura
  do vídeo, carga, aquecimento e renderização dos mosaicos.
- WASB usa três frames RGB/heatmaps e Step3; os VballNet usam nove frames cinza.
  Isso não reproduz o protocolo Step1 do artigo. A comparação mede esta execução
  local, com runtimes e arquiteturas diferentes.
- O decoder CPU de V4c usa maior contorno/momentos; o navegador usa componentes,
  área mínima de quatro pixels, centroide e filtro temporal conservador.
  Resultado e velocidade CPU não certificam a execução WebGPU nem a precisão
  do estúdio. GridV3 foi executado separadamente, reutilizando os controles
  congelados do primeiro teste; hashes antes/depois confirmaram que não mudaram.
- Uma câmera, um jogo e apenas 14 posições com verdade observável não bastam
  para escolher um modelo universal ou promover V4c por seu erro menor.

## Origem e auditoria dos modelos

WASB veio do [repositório oficial NTT](https://github.com/nttcom/WASB-SBDT/tree/923462cacdeb3353b84ddebdedb3f4b7a8553b0f)
e seu [model zoo](https://github.com/nttcom/WASB-SBDT/blob/923462cacdeb3353b84ddebdedb3f4b7a8553b0f/MODEL_ZOO.md).
Código MIT; licença separada dos pesos não ficou explícita nessa documentação.
O checkpoint fica restrito à avaliação local, sem redistribuição ou ativação.
GridV3 veio do repositório oficial usado no
[estudo de modelos](scouting-ball-model-comparison-2026-10-13.md), revisão
`3aad1b98b5b744afb0100418e95892a5b0c23865`, com licença MIT no repositório.

| Artefato | SHA256 |
|---|---|
| WASB checkpoint volleyball, 6.102.633 bytes | `26a4e383bfae3216efacf1c6d89107512d580a84fbe125364e72f1cce558a048` |
| Adaptador WASB auditado | `2398300ab0c804a2b446a6f303ccb787d41250ce6f2a926a6f0e32d86d1e705e` |
| GridV2b ONNX | `59529e8f40891eb689e103b97713c4c2c6eaa674fd625618e73c4354c7a8dc27` |
| V4c ONNX | `8eea11cc5c881fa008ec55b0f5732ab79f2e0e1833d7f586e680f3aaa98e4b8c` |
| GridV3 ONNX, 4.720.178 bytes | `5a3a03a490700c215257f8219c8975b636a8b0b199d08ce8f8749b736c618743` |
| GridV3 sidecar | `a442666a31f62d0567c45f5eecb90906b950212de92d1dd0a4517f52a59f7c41` |

O adaptador carrega somente a arquitetura HRNet conferida por hash. Checkpoint
carregado com `weights_only=True`, sem globals inseguros identificados, 428
tensores e 1.481.427 parâmetros. Helpers upstream, inicialização insegura,
downloads automáticos, Hydra e exigência de CUDA não foram executados. GridV3
usa entrada `[1,9,576,1024]` e saída `[1,36,36,64]`; sigmoid já está no grafo,
portanto não foi aplicada novamente.

## Ferramenta e evidências

`scripts/validation/scouting-wasb-benchmark.py` é uma CLI offline, sem acesso à
rede, importação para o produto ou escrita em rascunhos. Exige vídeo, referência,
os dois ONNX, adaptador WASB auditado e checkpoint locais explícitos. Recusa
sobrescrever uma pasta de resultados existente. Dependências pesadas são
carregadas somente ao executar a CLI; `--help` e testes do contrato usam a
biblioteca padrão. **Não executar novamente para consultar resultados já salvos.**

Evidências locais ignoradas pelo Git:

- `.tmp/scouting-youtube-ball-pilot/reference/manual-reference.json` — referência.
- `.tmp/scouting-wasb-evaluation/source-audit.json` e `vendor/wasb_adapter.py` — auditoria e adaptador.
- `.tmp/scouting-wasb-evaluation/comparison-step3/` — relatório, previsões e cinco mosaicos.
  SHA256 de `report.json`: `fb52e3a90797dfca9f435fcb8c48d63c7f29733bf7630f05565e2c15c229d11f`;
  de `predictions.json`: `45c2314844e68934cdafa1c38551d11ca5be410b62a34acde57961e74e0eca4d`.
- `.tmp/scouting-wasb-evaluation/comparison-gridv3/` — relatório, previsões e cinco mosaicos.
  SHA256 de `report.json`: `657b6cdd95c8fac412d26da77cc6336fc63aed6d355174aa6092d7799e66e4da`.
- `.tmp/scouting-wasb-evaluation/run_grid_v3.py` — runner adicional auditado;
  SHA256 `087f532617381bc20cc3b03f4b041f7d1136d860faa6f3cdb36028ac6986cbe6`.

Pesos, vídeo, adaptadores privados e ambiente não estão no Git; um clone limpo
precisa preparar esses insumos auditados para reproduzir a inferência.
Validação proporcional: 11 testes da CLI pública e três fixtures privadas do
decoder GridV3 passaram; CLI help/compilação Python e inferência real concluídas.
Tipos do app, geração do checklist e verificação de diff passaram. Sem mudança
de UI nesta avaliação; o smoke relevante foi a execução offline nos frames reais.

## Estúdio e novos links

GridV2b padrão, opção V4c e player **Original com tracking** permanecem como
estavam. A avaliação não acessou nem alterou os rascunhos: original com
80 rallies/20 contatos/7 pontos/20.222 posições; YouTube com
78 rallies/201 contatos/20.222 posições. Não houve upload, nova chamada Gemini,
treinamento, compra, publicação ou mudança remota.

Trocar ou treinar o detector continua exigindo frames acessíveis. Este teste
usou o original local e **não habilita tracking preciso apenas pela URL do
YouTube**. O [piloto somente pelo link](scouting-youtube-ball-pilot-2026-10-13.md)
foi reprovado e não está ativado. O próximo avanço de precisão exige avaliação
em mais jogos autorizados e referência independente; o caminho de treino e
separação por jogo/câmera está no estudo de modelos. Isso permanece pendente.
