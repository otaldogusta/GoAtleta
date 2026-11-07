# Go Atleta — teste nativo da câmera

Harness Android local para verificar o S25 antes da integração da captura nativa
ao estúdio. Usa CameraX 1.6.0, a mesma versão do `expo-camera` instalado no projeto.
O package de teste é `com.goatleta.cameraprobe`.

## Prova de captura

O teste solicita FHD e faixa de 60–60 fps na câmera traseira lógica, com zoom 1×.
Uma gravação curta é finalizada antes da análise. O resultado compara os
timestamps do sensor com os timestamps de apresentação do vídeo gravado;
configuração e metadados de FPS ficam separados da cadência medida. O enquadramento
da lente precisa ser confirmado no checkbox antes de gravar. A confirmação é
registrada por captura, junto da prova numérica.

O resultado positivo exige arquivo e sensor entre 59 e 61 fps por pelo menos
oito segundos, p95 dos intervalos de até 22 ms e lacuna máxima de 50 ms. PTS
repetidos não aumentam a contagem, e a ordem de apresentação é reconstruída
antes do cálculo. Amostras inválidas ou truncadas impedem a confirmação.

O manifest-fonte pede somente câmera. As gravações ficam em
`Movies/GoAtletaTeste`, acessíveis ao próprio app por MediaStore. O compartilhamento
do vídeo usa o seletor Android. O teste inicial é sem áudio.

## Compilar localmente

Pré-requisitos: JDK 17, Gradle 8.13, Android SDK 36 e build-tools 35.0.0.
Repositórios de dependências: Google Maven, Maven Central e Gradle Plugin Portal.
O build deste harness usa Java/AndroidX e não requer o build React Native ou NDK.

No PowerShell, com `JAVA_HOME` e `ANDROID_HOME` apontando para esses runtimes e
o terminal nesta pasta:

```powershell
gradle assembleDebug lintDebug --no-daemon --max-workers=2 --console=plain
```

O APK fica em `app/build/outputs/apk/debug/app-debug.apk`. Antes de distribuí-lo,
conferir o manifest mesclado, as permissões do APK, a assinatura e o SHA-256.
O APK e os diretórios de build são artefatos locais ignorados pelo Git.

## Validação no S25

Abrir a versão de teste com a câmera livre, conferir o enquadramento 1× e gravar
com o aparelho deitado em local iluminado. Registrar a resolução, a duração e os
FPS medidos do arquivo e do sensor.

O range de FPS pertence exclusivamente ao `SessionConfig`. CameraX 1.6.0 rejeita
combinar esse range com `setTargetFrameRate` nos UseCases; a primeira abertura
no S25 identificou esse conflito, corrigido antes da gravação física.

O APK de prova isolada passou no build e no lint. O usuário autorizou a
instalação por ADB no S25 SM-S931B (API 37) e confirmou o enquadramento 1×.
O MP4 de 9,953 s contém 589 quadros distintos em 1920 × 1080, H.264 High
nível 4.2, com média medida de 59,17 fps. O sensor registrou 59,18 fps.
A decodificação completa passou e a cópia via USB manteve o SHA-256 do original.

O ensaio valida a captura isolada. A validação da prévia e da cópia está
registrada separadamente abaixo.

## Piloto com o Estúdio

O APK debug aceita `-PstudioHost=<IPv4 privado>` e
`-PstudioCa=<certificado público da CA local>` juntos no build. A configuração
gerada confia nessa CA apenas para o IPv4 informado. O APK isolado fica
separado. O piloto usa o link de uma sala de teste do Estúdio em
`files/studio-pair.url`, no armazenamento privado do app. Use o ADB autorizado
para entregar o link por stdin a `run-as com.goatleta.cameraprobe`, sem incluí-lo
nos argumentos, no Git ou nos logs. Abra o app depois de configurar o link.

O CameraX grava o original e entrega uma prévia reduzida à WebView. A WebView
reutiliza a conexão RTC e o envio em lotes da câmera web. O app libera para
cópia apenas MP4s finalizados que ele próprio gravou nesta instância. O teste
com prévia grava 20 s, tem limite de 30 s e serve para ensaios sem marcações
oficiais. Build, lint e testes de protocolo passaram.

O S25 passou por dois ensaios curtos com prévia RTC ativa. O primeiro gravou
19,990 s a 59,23 fps em 1080p. A cópia retomou depois de corrigir um erro de
temporizador do WebView e o download manteve o SHA-256. No segundo ensaio,
19,973 s a 59,13 fps geraram 50,3 MB. A cópia automática por Wi-Fi ficou
disponível cerca de 54 s após o encerramento. O original foi baixado com hash
idêntico e reaberto no Estúdio. A validação cobre o APK debug e sessões curtas.
Gravação de jogo inteiro e marcações oficiais ficam fora do piloto.

## Referências

- [CameraX VideoCapture.Builder](https://developer.android.com/reference/androidx/camera/video/VideoCapture.Builder): o alvo de FPS participa da escolha de configuração e exige validação do resultado.
- [MediaExtractor](https://developer.android.com/reference/android/media/MediaExtractor): leitura dos timestamps de apresentação do arquivo final.
- [MediaStore](https://developer.android.com/training/data-storage/shared/media): acesso aos arquivos de mídia criados pelo próprio app.
