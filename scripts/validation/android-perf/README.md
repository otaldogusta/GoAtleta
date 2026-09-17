# APK local de performance

Variante opt-in `perf`, baseada em release, não depurável e profileable por shell.
Pacote `com.otaldogusta.goatleta.perf`, nome `GoAtleta Perf`, assinatura debug
local: **não distribuir como produção**. Não substitui `.dev` nem produção.
OTA e backup ficam desativados. Não registra links HTTPS do app principal.
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

Medição: separar startup da Activity de conteúdo pronto; estabilizar a tela,
zerar gfxinfo, executar roteiro idêntico e recolher gfxinfo/meminfo. Repetir
várias vezes. Não comparar tela de login com Home autenticada, nem debug com
release para atribuir ganhos a um patch específico.
