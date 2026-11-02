# Modo ao vivo local do Go Atleta

O celular grava no próprio navegador e envia a prévia ao notebook por WebRTC.
O companion troca somente sinais de conexão; vídeo e pontos não passam por ele.
Cria gravações novas e não modifica o scouting ou os 99 vínculos revisados.

## Preparar e iniciar

No notebook, identifique seu IPv4 privado na mesma rede Wi-Fi do celular:

```powershell
npm run dev:scouting-live:setup -- --host 192.168.1.20
npm run dev:scouting-live
```

Substitua o IP pelo endereço real do notebook na mesma rede Wi-Fi. A preparação
cria certificados em `%USERPROFILE%/.config/goatleta/scouting-live`, fora do Git;
não instala confiança nem altera o firewall. O início lê `local-config.json`
dessa pasta sem imprimir chaves. Arquivos incompatíveis ou expirados são
preservados: use outra pasta com `--directory` e inicie com `--config ARQUIVO`.

Um companion reconhecido na porta 8096 é reutilizado sem reiniciar conexões ou
Metro. Porta ocupada por outro serviço ou sem resposta bloqueia o início.
Configuração nova só é aplicada em uma nova inicialização, fora da gravação.

Notebook: HTTP no loopback `127.0.0.1:8096`. Celular: HTTPS no IP do notebook,
porta 8097. Se necessário, liberar a porta na rede privada é uma ação manual.
Não exponha o companion na internet nem publique arquivos `.key`.

Para testar duas abas no próprio notebook sem configurar o celular:

```powershell
npm run dev:scouting-live -- --loopback-only
```

Esse teste usa `localhost`; não habilita QR de Wi-Fi nem valida o celular.

## Conectar o Android

No Go Atleta em `http://localhost:8081`, abra **Estúdio → Câmera** e crie a conexão. O
celular precisa alcançar o IP do notebook; redes de convidados podem isolar os
aparelhos.

O Android precisa reconhecer a CA local. **Baixar certificado local** entrega
somente a CA pública no notebook. Transfira-a ao celular e confira a impressão
digital da preparação. Instalar como certificado CA nas configurações do Android
é um passo manual de confiança; os menus variam. O helper não instala confiança
nem aceita avisos do navegador.

Abra o QR no navegador e permita a câmera. **Preparar câmera** abre a prévia e
conecta ao notebook, sem gravar. **Gravar** inicia a captura; o estado Gravando
só aparece no `onstart` real do gravador. Mantenha a página aberta: bloqueio ou
segundo plano podem suspender a captura. Qualidade e codecs dependem do aparelho,
sem garantia de 1080p/60 nesta versão.

O QR autoriza uma câmera, sem acesso aos dados da turma ou administração.
Encerrar ou expirar a conexão revoga essa autorização. Não compartilhe o link.

## Operar a câmera

Horizontal é o padrão; Vertical pode ser escolhido antes da captura. Prévia
ocupa o viewport, com HUD e ações compactas. Tela cheia e bloqueio de orientação
são tentativas dependentes do navegador, sem rotação artificial por CSS/canvas.
No notebook há uma entrada central de conexão e QR na lateral. No celular,
uma barra inferior reúne gravar/parar, tempo, espaço salvo, formato, tela cheia
e gravações. Preparar/Reconectar aparece no centro da imagem conforme o estado.

Se a conexão cair durante a captura, mantenha a tela aberta e use **Reconectar**:
o gravador e seu recordingId continuam. Não gere outro QR automaticamente durante
a gravação. Depois de encerrar a captura, uma nova gravação exige novo QR; o uso
da sala é guardado localmente em IndexedDB/sessionStorage.

**Encerrar gravação** mostra Finalizando e aguarda o evento final do gravador,
todos os trechos e o commit dos metadados. Depois libera áudio/vídeo e mostra o
estado encerrado. Exportar e excluir ficam bloqueados durante captura,
finalização ou outra operação em curso.

Se um append falhar, o Blob e seu índice permanecem na fila para **Tentar
finalizar**, antes dos trechos seguintes. Até o commit, o trecho pendente fica
em RAM: mantenha essa tela aberta até o retry concluir. O retry não reinicia a
captura nem descarta o trecho final; falha definitiva continua indicada.

## Gravação, pontos e recuperação

- No celular, chunks de vídeo e eventos ficam em IndexedDB
  `goatleta-scouting-live-camera-v1`. A listagem de gravações permite **Salvar
  vídeo** e **Salvar marcações**, inclusive para trechos preservados após uma
  interrupção. O manifesto registra trechos, tempos e eventos; um trecho ausente
  impede uma exportação apresentada falsamente como completa.
- No notebook, pontos e interrupções ficam em
  `goatleta-scouting-live-host-v1`, separados por usuário, organização e turma.
  **Baixar registros** exporta o JSON dessa gravação nova. Marcadores usam a
  referência do vídeo, com indicação aproximada quando o relógio não é preciso.
- A base anterior `goatleta-scouting-video-drafts-v1` e seus vínculos não são o
  destino de escrita do modo ao vivo. O backup dos 99 vínculos não deve ser
  tratado como backup da gravação no celular.

Ao terminar, pare a gravação no celular e exporte vídeo e marcações para outro
local. Limpar dados, trocar origem/perfil ou pouco espaço pode afetar a
recuperação. Reabra a câmera no mesmo aparelho, navegador e origem para encontrar
gravações locais. Reiniciar o companion não apaga esses registros. Os manifestos
ao vivo ainda não são importados automaticamente pelo estúdio de vídeo oficial.

Em **Salvos neste notebook → Rever vídeo**, escolha o MP4/WebM exportado pelo
celular, mantendo o nome com o recordingId. O arquivo fica somente em memória,
sem upload. Após conferir duração e formato, cada ponto abre no instante salvo.
Trocar o arquivo ou fechar libera sua URL local; abrir a revisão não encerra a
conexão da câmera. Esta revisão não converte os registros em estatísticas oficiais.

## Excluir e restaurar

No celular, **Excluir do celular** exige confirmação e apaga definitivamente
metadados, vídeo em trechos e eventos daquele recordingId, numa única transação.
Outra gravação permanece intacta. A ação bloqueia registros ativos, exportação e
finalização; exportar um arquivo não o exclui automaticamente.

No notebook, a confirmação move somente os registros para uma lixeira durável e
restaurável, por usuário/organização/turma, sessionId e recordingId. Não apaga o
vídeo no celular. Identificação inclui horário HH:mm; registros ativos ou com
cópias pendentes não podem ser excluídos. Reconectar um recordingId na lixeira
exige restauração explícita, sem criar uma cópia vazia. Os dados anteriores de
scouting e seus 99 vínculos continuam fora desses caminhos.

## Goatleta.com

Ainda não ativado. O cliente permite o companion apenas no desenvolvimento
local. `goatleta.com` precisa de sinalização autenticada por turma/organização,
HTTPS confiável e conectividade/retransmissão entre redes. Supabase permanece a
fonte de autorização; publicar apenas o cliente não ativa esse contrato.

Smoke local em duas abas passou com câmera sintética: gravação, 3 pontos e um
desfazer (2 ativos), troca de set, confirmação de gravação no IndexedDB da câmera,
exportação MP4/JSON e recuperação após reload com seek decodificado. Não certifica
câmera física, Wi-Fi, confiança do Android, desempenho móvel ou produção.

Interrupção simulada de peer manteve a gravação e o mesmo recordingId; uma
correção feita offline foi confirmada no celular após reconectar, com fila
durável vazia no notebook. A revisão no modal também abriu o ponto em 13,948 s
do MP4 recuperado. Tipos, org-scope, arquitetura, perf-hygiene e export web
aprovados localmente; nenhum deploy realizado.

Na rodada atual, 21 casos do runner da câmera e suítes focadas de host,
armazenamento e UI passaram. A revisão de falhas cobre retenção/retry do trecho
final, commit terminal e exclusão atômica; tipos, org-scope e perf passaram na
rodada técnica. O usuário relatou Android/Wi-Fi funcionando com pequeno atraso
percebido, sem medição de latência. Isso não valida fisicamente os novos controles.

Tipos finais aprovados. QA da interface no navegador em 1055×487 e 390×844:
barra única, preparo central, formato, tela cheia e painel de gravações sem
overflow horizontal. No estúdio, QR lateral e cancelamento da confirmação de
exclusão conferidos; nenhuma exclusão foi confirmada pelo agente. A prévia do
celular apareceu no notebook durante a conferência, sem medição de latência.
Hashes do documento de 118 recortes e do sidecar dos 99 vínculos revisados
permaneceram idênticos ao baseline.
Validação física dos novos controles no Android: **pendente**.

A tela da câmera usa arquivos estáticos; uma aba já aberta no telefone não
recebe essas mudanças automaticamente. Atualize-a manualmente somente após
finalizar e exportar o que desejar preservar. Estes ajustes não exigem reiniciar
o companion. Sem deploy, alteração remota de banco ou exclusão de arquivos do
usuário nesta etapa.

## Fechamento da etapa

Publicação do frontend autorizada em 02/11. Câmera/QR e sidecars continuam
locais; a publicação não ativa infraestrutura pública nem transfere vínculos
entre origens. [Preflight e fluxo do release](scouting-release-2026-11-02.md).
