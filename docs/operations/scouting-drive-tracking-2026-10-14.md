# Vídeo do Drive e trajetória no estúdio — 14/10/2026

## Escopo e fluxo local

O mesmo estúdio do documento YouTube pode usar um MP4 público do Google Drive
como original, sem selecionar ou salvar um arquivo de vídeo no computador.
O link de pasta informado foi consultado somente para localizar o arquivo
autorizado; o produto recebe um link de **arquivo**, não percorre pastas.
Não são alteradas permissões do Drive.

`DriveTrackingSetup.web.tsx` confere metadata, exige confirmação da mesma edição
e offset explícito e oferece duas ações distintas:

- **Rastrear nesta aba:** streaming do Drive e VballNet GridV2b no aparelho,
  reutilizando o motor/Worker existente. O navegador transfere e decodifica
  mídia; não se trata de processamento na nuvem nem de tráfego zero.
- **Nuvem · Roboflow:** integração experimental ao endpoint `videoinfer`,
  que recebe a URL pública diretamente. Requer chave do usuário, mantida somente
  em RAM no companion e vinculada a usuário/organização. Não há fallback silencioso.

Ambos produzem um candidato antes de **Aplicar tracking**. A aplicação muda
somente `analysis` do documento atual: identidade YouTube, rallies, contatos,
pontos e correções permanecem. A reprodução passa ao original do Drive e desenha
a trajetória sobre a imagem. Pode-se também usar o tracking já existente sem
gerar outro resultado ou modificar o documento.

## Transporte e persistência

O teste direto no navegador encontrou bloqueio CORS do Drive, apesar do HEAD
servidor retornar `video/mp4` e Range. O companion de desenvolvimento
`scripts/scouting-drive-service.mjs`, em `127.0.0.1:8095`, fornece streaming
por Range com buffer limitado. Não cria MP4, File, Blob ou cache de mídia em disco.
O navegador pode manter o cache transitório normal da reprodução.

Metadados/controle exigem Host, Origin e header próprios. O player recebe uma
capacidade aleatória temporária em memória, com expiração, sem token Google ou
Supabase. O gateway valida destinos Google, MIME, tamanho, intervalos, redirects,
concorrência e cancelamento do upstream. Não expor esse companion como API pública.

O smoke longo detectou `ERR_CONTENT_LENGTH_MISMATCH`: o prazo absoluto de um
stream podia vencer enquanto o navegador pausava seu consumo. Corrigido para
timeout apenas durante fetch/leitura upstream; esperar backpressure não trunca
uma resposta válida. A prévia libera a conexão durante inferência. Falhas
transitórias de leitura podem retomar automaticamente até três tentativas totais,
sempre do último lote completo; CORS, formato, mídia alterada, modelo e cancelamento
não são repetidos. Nenhum resultado parcial vira análise aplicada.

Início local: `node scripts/scouting-drive-service.mjs`.

O MP4 testado intercala áudio e vídeo em regiões físicas distantes; seeks por
frame repetiam leituras pequenas no Drive. O gateway agora prepara somente a
janela alinhada solicitada de 2 MiB, com até dois fills simultâneos e deduplicação.
Cache LRU global de 32 MiB em RAM, com validade por intervalo de bytes, impede
expor lacunas. Não busca a janela seguinte automaticamente nem cria mídia em
disco. Uma janela iniciada pode terminar após o navegador abandonar a resposta;
revogação, expiração e timeout interrompem o trabalho. Leases em backpressure
também expiram no TTL da capability e liberam os blocos.

Em fixture comparativa, vinte seeks novos de 4 KiB passaram de vinte GETs para
um GET de 2 MiB, com bytes/206 conferidos. No vídeo real, a retomada avançou de
05:31 para 06:13 em cerca de um minuto e seguiu até o fim, enquanto o processo
de streaming usava aproximadamente 102 MiB de working set naquela medição.
Esse valor não inclui a GPU/modelo no navegador e não é um teto total de memória.

O documento/export recebe apenas posições, modelo real e proveniência opaca
(fingerprint de metadata, nome, duração, dimensões e offset). Não recebe link/ID
Drive, capacidade do player, chave ou caminho local. Fingerprint de metadata não
é hash do conteúdo; duração/dimensões também não comprovam igualdade dos bytes.
Ao reabrir a página, informar novamente o link do original para reproduzi-lo;
as posições e marcações salvas continuam no rascunho YouTube.

O cálculo na aba conserva checkpoints somente em RAM: até duas análises,
validade de duas horas e apenas lotes completos. A chave opaca inclui usuário,
organização, classe, sessão, vídeo, geração de autenticação e modelo. Fechar a
janela interrompe o trabalho; outro clique em rastrear pode retomar na mesma
aba **sem recarregá-la**. Recarregar/fechar a página perde esses checkpoints.
Não há aplicação parcial nem persistência de frames; trocar mídia/modelo invalida
a retomada incompatível.

## Roboflow e limites

O modelo público é `volleyball_v2/3`; se um resultado válido for aplicado, o
documento registra `roboflow-volleyball-v2-3`, sem atribuí-lo ao VballNet.
O conversor exige timestamps em segundos ou FPS nativo declarado para converter
`frame_offset`; FPS de inferência não substitui FPS nativo. Descarta resultados
fracos/ambíguos, conserva lacunas e recusa resultado vazio ou incompatível.

Um único POST inicia o job; não há repetição automática após timeout. Cancelar
interrompe a consulta local, sem prometer cancelamento do processamento remoto.
Saídas são JSON limitado, sem imagens, e URLs de resultado têm destinos restritos.
Testes offline não certificam endpoint ativo, consumo nem precisão no jogo.
O teste anterior na UI do provedor encontrou falhas de continuidade e falsos
positivos; não promove esse modelo automaticamente.

Referências primárias:
[SDK de vídeo Roboflow](https://github.com/roboflow/roboflow-python/blob/main/roboflow/models/inference.py#L136-L313),
[downloads e Range do Drive](https://developers.google.com/workspace/drive/api/guides/manage-downloads).

## Evidências e ativação

Antes do smoke, exportação pela própria UI preservada em
`.tmp/scouting-drive/before.json`: **78 rallies, 201 contatos, zero correções e
20.222 posições**. Arquivo de mídia e URLs/capacidades reais ficam fora do Git.

Reprodução real do Drive com o tracking preservado conferida em 00:21, com
marcador sobre a bola na imagem. Exportação posterior idêntica byte a byte à
anterior: SHA256 `24fb8f0cbc31f6540c1e84e6bba28177084264f32a2ea29ca81af767d688dac2`.
Evidência ignorada: `.tmp/scouting-drive/drive-existing-overlay.png` e
`playback-only.json`. Essa conferência usa posições anteriores, não certifica uma
nova inferência pelo Drive.

Processamento completo de 0–910,7 s pelo Drive concluído no navegador, sem
selecionar ou salvar o MP4. Gerou **17.508 posições** com
`vballnet-v2b-browser-1`; aceite e salvamento confirmados na UI. Exportação
`.tmp/scouting-drive/after.json` mantém `version`, `media`, `rallies`, `contacts`
e `corrections` exatamente iguais à anterior: **78 rallies, 201 contatos e zero
correções**. Apenas `analysis` mudou. A exportação não contém URL/ID Drive,
capability ou credencial. O rascunho anterior do arquivo local não foi modificado.

Comparação com a referência visual independente de 20–39 s: onze dos quatorze
instantes observáveis têm detecção no quadro exato, com erro de 1,1–3,3 px; três
têm lacunas. Seis instantes desconhecidos não são tratados como ausência. Isso
é conferência pontual, não certificação de precisão no vídeo inteiro. As posições
continuam estimativas e lacunas não foram preenchidas artificialmente.

Após reiniciar o companion final, o mesmo original foi reassociado às posições
salvas sem recalcular nem modificar o documento. Play/pausa/busca e sobreposição
em 00:21 conferidos, com o marcador sobre a bola e rascunho salvo. Evidências
ignoradas: `acceptance-comparison.json` e `drive-generated-overlay.png` nessa
mesma pasta temporária.

Validação local: 50 testes do serviço, 49 de domínio Drive, 46 do processamento,
11 da API e sete da UI; regressões relevantes, typecheck, lint focado, escopo,
encoding, higiene/performance strict e diff checks aprovados. Não executado gate
de publicação: entrega local, sem commit/push, merge, deploy ou migração remota.
Drive privado/OAuth, executor cloud dedicado e compartilhamento do original
continuam pendentes. A opção Roboflow não foi executada/ativada remotamente nesta
entrega.
