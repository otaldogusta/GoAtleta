# APK local de performance

Variante opt-in `perf`, baseada em release, não depurável e profileable por shell.
Pacote `com.otaldogusta.goatleta.perf`, nome `GoAtleta Perf`, assinatura debug
local: **não distribuir como produção**. Não substitui `.dev` nem produção.
Backup continua desativado. OTA fica habilitado no canal `perf`, apontado para
o mesmo branch de updates do canal `production`. Assim, cada update publicado
pela `main` chega também ao Perf quando o runtime nativo for compatível. O app
consulta ao abrir, baixa em segundo plano e aplica na abertura seguinte.
Não registra links HTTPS do app principal.
Registra o esquema `goatleta` para o retorno OAuth existente, sem mudar a
allowlist remota. No seletor Android, escolher **GoAtleta Perf → Só uma vez**.
Não selecionar Sempre: o esquema é compartilhado com os outros builds locais.
Mantém as opções de otimização do release atual para evitar confundir otimização
de código com mudança de configuração. O backend continua sendo o configurado
localmente; pacote separado não é isolamento de dados do servidor.

No PowerShell, a partir de `android/`:

```powershell
$env:ANDROID_HOME = 'C:\Users\gusta\AppData\Local\Android\Sdk'
$env:SENTRY_DISABLE_AUTO_UPLOAD = 'true'
$env:NODE_ENV = 'production'
.\gradlew.bat :app:assemblePerf -I ../scripts/validation/android-perf.init.gradle -PreactNativeArchitectures=arm64-v8a --max-workers=1 --no-parallel
```

Essas variáveis são locais ao processo; não alterar variáveis de produção.
O comando pode carregar configuração privada local: não publicar o log bruto.
Saída esperada: `android/app/build/outputs/apk/perf/app-perf.apk`.
Antes de instalar, verificar package id e flags no manifesto compilado.
O primeiro acesso é separado: usar conta e massa fictícias, sem copiar tokens
dos outros aplicativos. Não automatizar criação ou edição de dados reais.

Alterações apenas em JavaScript/assets chegam por OTA. Mudanças nativas,
dependências nativas ou nova `runtimeVersion` ainda exigem outro APK.

Medição: separar startup da Activity de conteúdo pronto; estabilizar a tela,
zerar gfxinfo, executar roteiro idêntico e recolher gfxinfo/meminfo. Repetir
várias vezes. Não comparar tela de login com Home autenticada, nem debug com
release para atribuir ganhos a um patch específico.


## Validação local do calendário — 23/10/2026

APK local `1.0.3-perf` instalado com `adb install -r`, preservando dados.
Assinatura e pacote `com.otaldogusta.goatleta.perf`/arm64 conferidos; SHA256
começa em `b519195126511dab`. Este APK de teste usa o bundle local embarcado
com OTA desabilitado por manifesto e init script temporários, sem modificar
este fluxo padrão nem publicar updates. Artefatos/recibo ficam em
`.tmp/validation/android-device/` e `android/app/build/outputs/apk/perf/`.
Teste físico no Samsung confirmou semana 19–25 com dia 24 selecionado, expansão
e recolhimento do mês por arrasto no fluxo e acesso ao sétimo evento da lista.
A inicialização nativa também foi corrigida para não assumir APIs DOM em `window`;
o paginador alinha a semana após a medição do conteúdo. Os 28 testes focados e
a checagem de tipos passaram. Nenhuma distribuição remota foi realizada.

Comparação física posterior em 23/10: o gesto nativo usa coordenadas absolutas
e distância compartilhada na thread de UI para mês e lista. Capturas durante
o mesmo toque confirmaram 100 px adicionais de dedo e painel (barrinha em
y=870 e y=970); também foram exercitados reversão, passagem ao scroll e impulso
até o último dos sete eventos. Esse roteiro verifica comportamento, não FPS
nem identidade com as curvas internas proprietárias da Agenda Samsung.

Correção do flicker em 23/10: scroll exclusivo da lista preserva o paginador
semanal montado. A troca para o mês ocorre apenas ao mover o calendário.
Regressão do hook passou; capturas antes/durante/depois do scroll no Samsung
foram idênticas na região x=43..1038/y=520..742 (222108 pixels). Evidências
locais: `flicker-before.png`, `flicker-held.png`, `flicker-after.png`.

Inversão rápida em 23/10: montagem/alinhamento do paginador não altera a data;
só o swipe horizontal real concluído escolhe outra semana. Cada toque assume
a animação e invalida conclusões antigas. Três sequências rápidas mantiveram
24/10; o teste de Hoje manteve 23/10. Swipe horizontal real confirmou 24→31.
Evidências locais: `reversal-cycle-1/2/3.xml`, `reversal-today.xml`,
`reversal-horizontal.xml` e capturas correspondentes.

Novo encaixe em 23/10: viewport nativo persistente mantém mês e paginador
montados e troca somente visibilidade na thread de UI. Regressão confirma
uma única montagem através de expansão, encaixe e reversão. APK instalado
às 16:52 e testado após desbloqueio: três recolhimentos gravados; 264 frames
extraídos sem desaparecimento da seleção. Arrasto e inversão rápida preservaram
dia 24. Evidência: `persistent-collapse.mp4`, `persistent-collapse-frames.png`,
`persistent-frame-analysis.json` e `persistent-drag-before/after.xml`.
