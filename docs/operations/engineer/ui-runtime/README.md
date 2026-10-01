# UI runtime local — construção e evidência

Imagem separada `goatleta-engineer-ui-runtime:v1`, derivada do core imutável existente. A imagem visual usa Node 24 para respeitar package.json; core Node 22/Python intacto. Node 24.21.0, Playwright 1.56.1, Chromium 141.0.7390.37. Construída localmente em 01/10/2026; digest `sha256:afa457fd3867207c1ca276bdc3b9189df4c6ba9b3a237f749868c072c1b8e172`. A receita de apt não garante reprodução bit a bit; repetir a execução com esse digest evita confundir a imagem validada com builds futuros.

Montar harness read-only e checkout/artefatos em sandbox dedicado. Dependências Expo devem ser restauradas do lockfile existente numa etapa autorizada; não instalar Expo global. O harness conecta a um servidor local já iniciado. Para iniciar automaticamente usa subprocesso fixo npm run dev:web (sem comando arbitrário), aguarda resposta da rota, fecha browser e sua árvore de processos no finally. Nunca encerrar um servidor preexistente.

O roteiro UI-001 aponta para /login e não preenche credenciais. Nenhuma chamada a Supabase é permitida. Rede do browser restrita ao origin localhost:8081; backend/server devem também ser isolados pelo operador. Não iniciar app com configurações de produção.

CLI: `node scripts/engineer_ui_evidence.mjs RUN SCENARIO --workspace CHECKOUT_ISOLADO [--start-app]`. Auto-start disponível apenas no container Linux; no Windows use o launcher `scripts/engineer-ui-capture-local.ps1`. O checkout completo e suas dependências são montados separadamente do bundle mínimo de revisão. O harness confere hashes dos arquivos selecionados antes/depois da captura; isso não prova sozinho que um servidor preexistente serviu esse checkout. O launcher usa servidor novo dentro do mesmo container sem rede, evitando essa ambiguidade. O diretório evidence deve ser novo: nunca sobrescrever uma captura anterior.

## Reprodução local

1. Preparar uma cópia de fontes sem `.env`, credenciais, `.git` ou artefatos pessoais. Incluir app/src/assets/components/constants/data/hooks/public, configs do Expo, patches e o módulo puro `supabase/functions/_shared/class-pedagogical-profile.ts`, importado pelo frontend. Manifesto completo da cópia local: `.tmp/engineer-ui-local/source-snapshot.json`.
2. Restaurar o package-lock em volume separado com Node 24 e `npm ci --ignore-scripts --no-audit --no-fund`. Nenhum arquivo de ambiente ou npmrc pessoal é montado. Aplicar patch-package e os três verificadores de patches já existentes em container sem rede. Não atualizar o lockfile.
3. Executar o launcher com `-Run`, `-Snapshot`, `-Image sha256:...` e o volume de dependências. Ele monta fontes/dependências/harness read-only, usa workspace temporário, rede `none`, usuário 1000, limites de recursos e configuração fictícia de backend em 127.0.0.1:9. Não inicia Supabase.
4. O launcher encerra/remove somente seu próprio container e registra `ui-runtime-validation.json`. O preflight UI confere manifesto, imagem, harness, fontes e hashes dos 18 artefatos. READY valida infraestrutura, não aparência, motion ou autorização remota.

O harness aguarda `/status` do Metro, a navegação real, os campos, fontes e estabilidade de posição/opacidade antes do PNG. Os vídeos incluem a transição; a primeira compilação pode ocupar parte longa do primeiro vídeo. Erros de console são contados e registrados com URLs/tokens mascarados. A captura com reduced-motion não prova, sozinha, que o app respeita a preferência; isso exige revisão do vídeo/comportamento.
