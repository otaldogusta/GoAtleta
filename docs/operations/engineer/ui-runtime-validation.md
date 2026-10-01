# Validação local do runtime visual — 01/10/2026

**UI_RUNTIME_READY**, sem IA ou sessão remota. Pacote UI-001 `b1b2f6a0a19f404889c5a87835c5765e` recebeu uma captura local; o agente UI-001 não foi iniciado. Run 005b continua apenas preparada. Nenhuma mudança em código do app, package-lock, ambiente de produção, Supabase ou registro de agentes.

## Evidência real

- Imagem: `sha256:afa457fd3867207c1ca276bdc3b9189df4c6ba9b3a237f749868c072c1b8e172`.
- Core preservado: `sha256:4290f6c7b74916aa606dd5419848543896c1f4afbc30fb4398806e0be0daf121`.
- Node 24.21.0, Playwright 1.56.1 e Chromium 141.0.7390.37. Node atualizado apenas na imagem visual, conforme engines do app.
- Dependências restauradas pelo lockfile em volume próprio, scripts de instalação inicialmente desativados. Patches e três verificadores do projeto executados posteriormente sem rede.
- Expo Web real e `/login` em localhost:8081 **dentro do container**. Snapshot sem `.env` ou chaves; backend fictício 127.0.0.1:9. Fontes, dependências e harness montados read-only; workspace de execução temporário.
- Container sem rede (`none`), usuário 1000, filesystem base read-only e limites de recursos. Container da captura final saiu com código 0 e foi removido pelo launcher; não há servidor de captura deixado ativo.
- Seis cenários: 390×844, 768×1024 e 1440×900, cada um normal e reduced-motion. Gerados **6 PNGs + 6 snapshots ARIA + 6 WebM**. Arquivos selecionados conferidos antes/depois e hashes de artefatos validados.
- Os seis vídeos foram abertos no Chromium: dimensões corretas, metadata e último frame decodificados. Isso não é avaliação de fluidez. O primeiro dura 187,36s e inclui compilação inicial; demais duram 5,4–6,24s. O FFmpeg compacto da imagem não oferece muxer `null`; a verificação de leitura dos vídeos usou Chromium.

Evidências privadas ignoradas: `.tmp/engineer-runs/b1b2f6a0a19f404889c5a87835c5765e/evidence/`. Recibo de teardown/hash: `ui-runtime-validation.json`. Galeria: `.tmp/engineer-ui-local/review.html`. Snapshot completo: `.tmp/engineer-ui-local/source-snapshot.json`. Nenhum screenshot foi publicado.

## Limites e revisão humana

O registro contém **1 erro de recurso por cenário** (`Failed to load resource: net::ERR_FAILED`), **0 exceções JavaScript**. Não foi identificado o recurso de origem; não atribuir automaticamente o erro ao isolamento de rede. Warnings de resolução ExpoFontLoader/react-dom e fallback de DevTools também apareceram. Não corrigimos bibliotecas ou o produto para esconder esses sinais.

PNG é capturado após fontes e estabilidade de posição/opacidade, evitando aprovar um frame intermediário da animação de entrada. Reduced-motion foi aplicado ao browser; a eficácia do comportamento ainda precisa ser revisada no vídeo. Não foram testados login funcional, credenciais, acessibilidade integral, haptics ou performance nativa.

Estado atual: **CAPTURED ≠ PASS**. Gustavo revisou as seis imagens e declarou: “Revisei as seis imagens e aprovo apenas a aparência”. Aprovação registrada em `human-appearance-review.json`, canal de resposta humana no chat, vinculada aos seis hashes, manifesto e captura. Ela não aprova UX, acessibilidade, motion, performance, autenticação, integração ou execução paga.

`ui-review.json` registra imagens vistas e resultado **UNVERIFIED** para a revisão completa; arrays sem findings não provam aprovação das áreas não avaliadas. `UI_UX_GATE=UNVERIFIED` continua. `MOTION_GATE=NOT_APPLICABLE` no manifesto estático UI-001: nenhuma mudança de motion foi solicitada; a qualidade de motion não está aprovada. `ui-review.draft.json` anterior não é uma decisão. Não converter a aprovação limitada em aprovação completa nem autorizar integração pelo recibo de infraestrutura.

## Calibração separada

Fixtures em `.tmp/engineer-ui-local/calibration`, copiadas das capturas e explicitamente sintéticas, nunca aplicadas à run real:

| Caso | UI_UX_GATE | MOTION_GATE |
| --- | --- | --- |
| Captura real sem revisão humana | UNVERIFIED | NOT_APPLICABLE |
| Finding HIGH sintético | FAIL | NOT_APPLICABLE |
| Motion no escopo, vídeos omitidos | PASS no fixture visual | UNVERIFIED |

Teste unitário adicional comprova UI PASS com Motion FAIL quando apenas motion tem finding HIGH. O resultado agregado do review continua FAIL; a integração é bloqueada por qualquer gate falho/não verificado.

## Correções do harness e regressões

A primeira tentativa falhou por ausência do módulo puro compartilhado `supabase/functions/_shared/class-pedagogical-profile.ts` no snapshot. Incluído somente o código importado pelo frontend; nenhum serviço Supabase iniciado. Evidência/log da tentativa foram preservados. A segunda captura funcionou, mas registrava alguns PNGs durante a entrada animada; está arquivada como `evidence-attempt-002-entrance`. A terceira é a captura final estabilizada.

**126 testes locais PASS**: 40 controlador, 23 controles, 22 launch, 28 vNext, 7 recibo de runtime e 6 harness. Preflight UI conferiu o recibo e os artefatos reais e retornou READY/UI_RUNTIME_READY. Preflight core não pode substituir essa prova. O novo launcher foi exercitado na captura final, incluindo remoção do container.

`create --live` e provisionamento remoto vNext permanecem bloqueados. Não houve gasto de crédito de API, commit, push, deploy ou alteração de banco. Imagem, volume de dependências e snapshots locais permanecem disponíveis para reprodução; não são serviços ativos.
