# Go Atleta Engineer vNext — Multi-Agent + UI/UX/Motion

Atualização posterior: [runtime visual validado localmente](ui-runtime-validation.md), com captura real e teardown. Os parágrafos abaixo registram a entrega inicial preparada. O estado atual é UI_RUNTIME_READY/CAPTURED, com revisão humana ainda pendente; nenhuma execução remota foi liberada.

Implementação local de 01/10/2026. Nenhuma chamada paga, sessão remota, mudança de agente persistente, instalação, build de imagem, acesso ao Supabase ou publicação neste pacote. O registro remoto continua com quatro agentes; UI/UX Motion é o quinto **perfil local**, ainda não registrado remotamente.

## Papéis e contexto

Coordinator vNext usa `coordinator-vnext.md`, sem substituir o perfil histórico. Implementation continua como escritor único em fase separada. Test Review, Security Review e UI/UX Motion Review são revisores somente leitura. A fase vNext atual aceita 0–3 revisores; não admite Implementation em um pacote read-only.

`context-budget.json` limita arquivos/bytes por papel antes de criar o bundle. Coordinator recebe regras, requisitos e plano; Test Review recebe os fontes/testes e executa a suíte final sozinho. `context-report.json` distingue disponibilidade de leitura observada. Conteúdo completo em saída de comando prova leitura do Coordinator; atribuição de papel a filhos não observável fica null. Bytes de contexto não são tokens nem teto financeiro. A partição é instrucional; o filesystem read-only é compartilhado, não isolado por papel.

Coordinator deve guardar os IDs retornados pelo spawn e esperar esses IDs explicitamente. O avaliador rejeita lista vazia, IDs desconhecidos, IDs persistentes, alvo divergente e cobertura parcial. Cada filho precisa de comando bem-sucedido e resposta. Incorporação depende de revisão vinculada ao hash do histórico; com vários filhos, listar todos em `specialist_item_ids`. O avaliador detecta falhas após os eventos; não altera a implementação nativa da ferramenta de espera.

## Seleção

```powershell
python -B scripts/engineer_vnext.py "Melhorar layout do login" --file app/login.tsx
python -B scripts/engineer_vnext.py "Revisar animação com jank" --motion
python -B scripts/engineer_vnext.py "Alterar permissões e interface" --security --ui
```

Roteamento consultivo; confirmar superfície nos arquivos antes de `prepare --specialist`. TSX sozinho não aciona UI. Aparência do login não aciona Security; alterações funcionais de autenticação/permissões usam `--security` quando misturadas com UI. O limite continua em seis skills principais. Nomes instalados: `goatleta-courtside-ux`, `vercel-react-native-skills`, `expo-native-ui`. Os aliases solicitados não representam identidade upstream. Skills externas fornecem somente SKILL.md, sem helpers; instruções incompatíveis com o projeto não ganham autoridade.

## UI, motion e runtime

Princípios: `.agents/skills/goatleta-design-system/references/motion.md`. Contrato: `policies/visual-evidence.md`. Schemas JSON em `schemas/`: especialista, revisão visual e incorporação. A validação operacional dos gates usa Python sem instalar bibliotecas; schemas também permitem validação por ferramentas externas.

O Dockerfile de `ui-runtime/` prepara uma imagem separada derivada do digest core informado no build. A receita ainda não foi construída nem testada com Chromium. O core permanece intacto. Expo vem das dependências do projeto; não há Expo global ou emuladores. Dependências de sistema/browser precisam ser instaladas em uma etapa futura autorizada e o digest final registrado.

Harness `scripts/engineer_ui_evidence.mjs`: `--workspace WORKSPACE` obrigatório e servidor existente ou `--start-app` apenas em container Linux, comando fixo `npm run dev:web`; verificação de prontidão, captura PNG/ARIA/vídeo nos três viewports e em reduced motion, contagem de erros sem conteúdo sensível, fechamento do browser e encerramento apenas do servidor iniciado pelo harness. Confere fontes selecionados antes/depois. Origin permitido localhost:8081; websockets e hosts externos bloqueados. Isso não isola o servidor Expo nem prova a origem de um servidor preexistente: execute sem credenciais, em ambiente de rede preparado, e confira sua associação ao checkout. Nenhum browser foi iniciado neste pacote.

`CAPTURED` não significa PASS. Uma revisão independente deve identificar artefatos vistos. Hash divergente, viewport ausente, revisão ausente ou sem vídeo de reduced motion resulta em UNVERIFIED. BLOCKER/HIGH resulta em FAIL. UI_UX_GATE e MOTION_GATE aparecem no relatório. Em escritas futuras, o gateway recusa evidência read-only: ainda será necessário um contrato de captura vinculado ao candidato gravável. Não há aprovação automática nem integração liberada por esse perfil.

## Pilotos preparados

Ver `vnext-runs.json` para diretórios locais e critérios. Run 005b usa Coordinator + Test Review e imagem core; UI-001 usa Coordinator + UI/UX Motion para `/login`, sem credenciais ou submissão. `create --live` recusa qualquer pacote vNext **antes** de orçamento/chaves/API. Não execute essas runs nesta entrega.

Run 005b: alvo de menos de 300.000 tokens diretos do Coordinator, menos de 500.000 agregados, coordenação revisada, zero writes e attestation PASS. Os limites observados legados permanecem conservadores quando usage do turno inclui descendentes. Só traces/usage com semântica confirmada poderão comprovar a meta direta; métricas faltantes não passam. UI-001 exige três screenshots revisados; a auditoria estática não comprova fluidez nem desempenho nativo.

Run 005 histórica permanece FAIL_MULTI_AGENT, 715.514 tokens corrigidos sem dupla contagem. Não reclassificada nem reexecutada. Contexto menor e regras melhores são hipóteses para o próximo piloto, ainda não resultados de modelo.

## Validação desta entrega

Escopo de tooling/gates, validação focada conforme escada; nenhuma alteração funcional no app. **116 testes locais PASS**: 40 controlador, 23 controles, 22 launch/coordenação, 26 vNext e 5 harness Node. Mais 26 testes do roteador executados no preflight 005b dentro do core sem rede/chaves. O preflight UI retorna intencionalmente BLOCKED_RUNTIME/UI_RUNTIME_NOT_VALIDATED antes de Docker; core READY não serve como prova de Chromium/Expo.

Sintaxe Node e geração do checklist verificadas. Testes do harness cobrem contrato e falha por runtime ausente, não uma captura real nem teardown real de Chromium/Expo. Os esquemas e os testes sintéticos não são evidências visuais do produto. Nenhum token de API foi consumido por esta entrega; custo das runs futuras segue desconhecido.
