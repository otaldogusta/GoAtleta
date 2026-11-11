# Go Atleta — teste nativo da câmera

Harness Android local para validar a captura nativa e o envio ao Estúdio.
Usa CameraX 1.6.0, a mesma versão do `expo-camera` instalado no projeto.
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
separado. Com o APK atualizado instalado e o navegador confiando na CA do
notebook, abra o QR da câmera do Estúdio local. Toque em **Abrir app de
câmera** e confirme **Conectar** no Android. O APK aceita o link apenas para o
IPv4 configurado no build e pede confirmação antes de trocar de sala.

O link fica em `files/studio-pair.url`, no armazenamento privado do app. O ADB
continua disponível no ensaio. Use o ADB autorizado
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
Esses ensaios precedem o modo de gravação longa descrito abaixo.

## Gravação longa com cópia em andamento

Com o Estúdio local pareado, a sessão grava um MP4 em armazenamento privado do
app até Encerrar, com teto de duas horas ou 24 GiB. Confira o espaço indicado no
telefone, o enquadramento 1× e a prévia antes de começar. Mantenha o app aberto
em primeiro plano. Uma queda de Wi-Fi pausa a cópia e a câmera continua a gravar.
O celular tenta reconectar e o notebook retoma do último bloco gravado em disco.
O original finalizado também fica disponível pelo compartilhamento do Android.

O Estúdio recebe o arquivo por WebRTC e o grava no armazenamento privado do
navegador (OPFS). Ao encerrar, o notebook verifica SHA-256 por faixa do MP4
final, recebe as faixas que faltarem ou tiverem mudado e libera o vídeo para
revisão e download. Mantenha o Estúdio e o companion abertos para retomar na
mesma sala. O notebook autoriza a extensão da sala até seis horas da criação.
O APK, o notebook e o celular precisam usar o mesmo pareamento local.

O APK usa a configuração CameraX Full HD e 60 fps com prévia no aparelho,
independente do modelo. O piloto fixa a lente traseira principal quando as
características ópticas e a sessão permitem confirmá-la. Compare o
enquadramento com 1× da câmera do aparelho antes de marcar o checkbox. Se a
câmera rejeitar a combinação, o app mostra a falha de abertura. A configuração
solicitada e a taxa efetivamente medida são
registradas separadamente. O relatório acompanha cadência do sensor e do MP4
em janelas de um minuto e registra a condição térmica observada. Em estado
térmico severo, a prévia remota é reduzida e novos inícios ficam bloqueados.
Em estado crítico, o piloto finaliza a gravação para preservar o vídeo. O
ensaio longo da versão anterior chegou a 18 min 55 s a 57,64 fps e foi
encerrado por temperatura. Em 09/11, a lente física principal 5 foi verificada
no S25. O clipe horizontal de 27,43 s mediu 59,43 fps em 1920 × 1080 e teve
cópia Wi-Fi com SHA-256 idêntico. A cadência sustentada continua pendente.

A prévia tem quadro próprio em 16:9 na paisagem e 9:16 no retrato. Os
controles ficam ao lado ou abaixo do quadro, com os diagnósticos de captura
recolhidos em **Detalhes**.

No S25 SM-S931B com a lente física 5, o piloto calibra o quadro para o vídeo
Samsung em FHD 60 e 1×. O relatório informa o fator solicitado e o recorte que
o Camera2 devolveu. O MP4 curto comparado na mesma posição ficou a 0,37% da
escala da referência Samsung.

No ensaio seguinte de 1h30min04s, a captura continuou com a rede indisponível
e a cópia retomou exatamente no último byte confirmado. O relatório mediu
59,01 fps no arquivo e no sensor, com 38 de 90 janelas fora do critério de
cadência. A conferência integral do original ficou aguardando a reconexão.

## Referências

- [CameraX VideoCapture.Builder](https://developer.android.com/reference/androidx/camera/video/VideoCapture.Builder): o alvo de FPS participa da escolha de configuração e exige validação do resultado.
- [MediaExtractor](https://developer.android.com/reference/android/media/MediaExtractor): leitura dos timestamps de apresentação do arquivo final.
- [MediaStore](https://developer.android.com/training/data-storage/shared/media): acesso aos arquivos de mídia criados pelo próprio app.
