# Scouting em vídeo — mockup dedicado

Data: 12/10/2026. Este documento registra o protótipo independente e sua evolução.
A implementação web local posterior está em [implementação e limites](SCOUTING_VIDEO_IMPLEMENTACAO_2026-10-12.md); serviços propostos abaixo continuam pendentes.

## Composição e demonstração

Referência conferida no app local: Quadra Visual da turma ElCartel. O estúdio mantém área de trabalho ampla, ferramentas junto ao conteúdo, cabeçalho compacto e controles temporais na base. O painel lateral organiza contatos, histórico e validação. Abaixo de 1200 px, os painéis ficam empilhados.

Fonte: [mockup HTML](mockups/scouting-video-2026-10-12.html). A demonstração local está em http://localhost:8093; o app continua em http://localhost:8081. O servidor do protótipo atende somente em loopback. Vídeo privado e coordenadas ficam nos artefatos locais, fora do repositório.

Pasta dos artefatos: `C:/Users/gusta/.codex/visualizations/2026/10/11/01a12cb9-d4ee-7770-9707-f297b32a5d6c/scouting-video-mockup/`. Contém `index.html`, `video.mp4`, `tracks.json` e `serve.py`. Para reabrir, executar `serve.py` com Python e acessar a URL acima; o HTML usa arquivos de mídia relativos. O HTML sozinho não contém o vídeo.

Funciona no mockup:

- Player do trecho real 07:30–08:00 do amistoso El Cartel × Regenerados; pausa, velocidade, avanço por quadro e busca.
- Contato vinculado ao quadro de origem, com tempo em milissegundos e retorno por clique. Os três contatos iniciais são exemplos de interação, não anotações técnicas validadas do amistoso.
- Adicionar e revisar contato sem atleta ou com atleta explicitamente fictício.
- Coordenadas do detector já executado, sobrepostas ao vídeo. Não há inferência no navegador.
- Correção manual da bola em um quadro. Não simula correção ou reprocessamento automático de todo um trecho.
- Histórico de contatos e posições; restauração cria nova revisão, preservando as anteriores.
- Salvamento explícito do rascunho no localStorage deste navegador, sem gravação remota. Não é a persistência de produção.
- Aba de validação com os resultados reais do teste e cronômetro do modo de correção. Não representa o tempo total de trabalho de um professor.

Não implementado: upload, serviço de processamento, reprocessamento de trechos, identificação de atletas, sugestão de fundamentos/rallies/zonas e gravação de estatísticas oficiais. Nada é enviado a um processador externo.

## Reconciliação com o GitHub

Leitura autenticada e somente leitura do repositório `https://github.com/otaldogusta/GoAtleta.git`, HEAD remoto `5c42d3ef1d59b20c547ec414df01ce4534268760`, em 12/10/2026. Foram inspecionados `src/core/models.ts` e `src/db/scouting-collection.ts`, além do código local do coletor.

- `ScoutingContact` tem atleta, fundamento, fase, resultado e zona opcional; ainda não tem ID próprio nem vínculo temporal de vídeo.
- `ScoutingRally` tem ID, sessão, set, número, placar e contatos. `createdAt` é data de registro, não instante do vídeo.
- O adaptador usa `apply_scouting_command`, com `expected_revision` e `request_id`; preservar controle de concorrência e idempotência.

Esta leitura não é uma auditoria completa do esquema remoto nem prova de ativação de uma API de vídeo.

## Proposta técnica — sem migrations executadas

### Fase 1: vídeo sincronizado e revisão manual

Introduzir entidade de mídia vinculada à organização, turma e sessão: identidade imutável do arquivo, hash, duração, dimensões, base temporal e localização privada. Introduzir anotações com ID estável, vínculo ao contato/ponto, instante de apresentação no vídeo e revisão. Os vínculos são opcionais para preservar o scouting manual e o legado.

Usar timestamps da mídia (PTS com base temporal) como referência; não depender de `createdAt`, relógio de gravação ou apenas `frame / fps` para arquivos de taxa variável. Guardar frame quando disponível e a relação entre proxy de reprodução e mídia original. O mockup usa a simplificação correta para seu clipe de 30 fps e offset de 450 segundos; não comprova precisão em qualquer formato.

Revisões devem registrar antes/depois, autor, motivo, data e revisão-base. Confirmar/restaurar em transação e por comando idempotente; detectar edição concorrente. Revisões de trajetória não devem alterar o placar. A publicação de um contato validado reutiliza as regras do scouting existente, sem escrita direta do processador em estatísticas.

### Fase 2: serviço especializado

O aplicativo solicita um job autenticado e consulta progresso/resultado. Serviço externo processa mídia, retornando artefatos de trajetória com timestamps, versão do modelo/parâmetros e lacunas explícitas. Supabase continua responsável por identidade, autorização e dados canônicos.

Separar mídia, job, saída bruta do modelo, correções humanas e contatos confirmados. Mídia privada com acesso limitado; o worker recebe somente os recursos do job autorizado. Credenciais de serviço não vão para o Expo.

API proposta: criar mídia/job; consultar status; obter blocos temporais de coordenadas; enviar revisão com revisão esperada; solicitar reprocessamento de intervalo. Cancelamento, retries idempotentes e resultado versionado. Reprocessar um intervalo não apaga correções: apresentar a nova versão para revisão. O original permanece acessível.

Player desenha coordenadas na camada visual, sem renderizar outro MP4 para cada edição. Usar cópia de reprodução adequada, carregamento por intervalo e cache de resultados; escolher GPU/CPU e custos após medir. Não há fornecedor ou infraestrutura ativados nesta proposta.

### Fase 3: scouting assistido

Sugestões de rallies, fundamentos e zonas têm status próprio: pendente, aceita ou rejeitada. Não atribuir atleta, resultado, ponto ou zona por mera trajetória 2D. Só sugestões confirmadas alimentam o scouting oficial, pelas regras existentes.

## Validação com o amistoso real

Preservar parâmetros congelados e separar trechos de ajuste dos de avaliação. Os testes existentes medem cobertura, não precisão global: no trecho novo houve 593/900 quadros marcados, 12/12 acertos em amostra visível selecionada e um falso positivo adicional observado aos 07:35.

Próxima avaliação deve anotar referência em trechos representativos e registrar:

- Bola visível, oculta ou fora de quadro; perdas somente quando há referência observável.
- Falsos positivos, distância da marcação à referência, quantidade e duração das interrupções.
- Tempo real de revisão pelo professor, número de intervenções e tempo economizado contra registro manual.
- Sincronização após seek, alteração de velocidade, reabertura e troca de proxy.
- Histórico preservado após edição/restauração, concorrência, reprocessamento e retomada.

Não extrapolar a amostra de 12 quadros como precisão do vídeo completo. Estabelecer metas de aceitação após coletar esse baseline, sem inventar desempenho.

## Validação do protótipo

Conferidos em navegador local: navegação de contato até 07:49.000/quadro 14070; revisão e restauração do contato; correção da bola aos 07:35; histórico com três revisões preservado após salvar e recarregar; player e avanço de um quadro até 07:38.033. Layout móvel 390×844, tablet 834×1194 e desktop; temas claro e escuro. A revisão do mockup não substitui testes funcionais da futura integração.

## Refinamento minimalista

Removidos os rótulos permanentes sobre o vídeo e a ajuda de teclado; instrução aparece apenas durante correção. Ferramentas reunidas na reprodução, linha do tempo reduzida aos contatos e painel mais compacto. Vídeo usa a altura liberada, preservando proporção e quadro inteiro. Histórico e validação continuam em abas.


### Rallies e correção ampliada

- Faixa de quadradinhos da bola restaurada: verde com marcação, cinza sem marcação e laranja com correção manual.
- Lupa de 4× junto ao ponteiro no modo Corrigir bola, com mira central e sem alterar as coordenadas do clique.
- Navegação vídeo → rallies → contatos. O botão + separa outro rally no instante atual; os contatos são agrupados pelo instante original. As divisões também preservam histórico e podem ser restauradas.
- Apenas o recorte 07:30–08:00 está carregado. Limites dos rallies são manuais; não houve detecção automática de cortes nem importação dos 15 minutos completos.


### Entrada do vídeo completo — 12/10

Tela inicial com o amistoso local completo (15:10) e seletor de outro vídeo via URL de objeto, sem envio remoto. A preparação acompanha a leitura real dos metadados, bloqueia abertura em caso de erro e informa a disponibilidade parcial do rastreamento. O estúdio inicia em 00:00 para vídeos completos; o recorte de teste mantém o tempo original e é identificado explicitamente. Rascunhos separados por arquivo; o vídeo precisa ser selecionado novamente após recarregar. O amistoso completo usa os resultados existentes somente entre 07:30 e 08:00. Não há fila, upload remoto, detector de cortes ou processamento automático conectado; nenhum percentual artificial é exibido. O protótipo mantém passos de 1/30 s, adequados ao amistoso de 30 fps; outros vídeos ainda não têm validação de PTS/frame rate.


### Galeria de rallies e análise integral local — 12/10

Evolução que substitui os limites descritos nas etapas anteriores:

- Abas Rallies (miniaturas e intervalos), Informações (contatos e limites do recorte), Validação (alertas e revisão por amostragem). Histórico acessível por Informações/Validação.
- Selecionar um recorte delimita reprodução e linha do tempo, preservando o relógio absoluto do original. Ver vídeo inteiro restaura a faixa completa. Confirmar limites, unir recortes e dividir preservam os contatos por instante; alterações são restauráveis.
- Busca de cortes sobre todos os 27.321 quadros do amistoso (15:10,7; 30 fps): diferença média de luminância em 160×90, limiar 3 e separação mínima de 60 quadros. Gerou 79 candidatos e 80 recortes com miniaturas. Uma amostra de pares antes/depois foi inspecionada; os cortes seguem como sugestões, sem confirmação automática de rallies.
- Execução local do modelo VballNet v2 em blocos de 900 quadros, três processos, janela de 9 e stride 3. Seleção de candidatos, filtros de cor/fundo e caminho temporal mantêm os parâmetros anteriores. Blocos independentes podem produzir efeitos nas bordas; não equivalem a validação de precisão.
- A UI lê progresso e coordenadas reais dos arquivos gerados. Alertas de lacunas de pelo menos 15 quadros e saltos maiores que 100 pixels são candidatos à revisão, não contagem de erros reais. Amostras periódicas ajudam a conferir falsos positivos sem salto.
- O professor pode classificar um alerta como Erro confirmado ou Sem erro, com nova revisão e restauração. Isso não alimenta estatísticas oficiais.
- O mesmo arquivo selecionado pelo usuário é reconhecido por tamanho e SHA-256 das amostras inicial/final de 1 MiB, associando os resultados locais. É identificação prática do protótipo, não verificação criptográfica integral. Outros vídeos continuam com revisão manual; não existe serviço genérico de processamento/upload integrado.
- Mídia, miniaturas, coordenadas e scripts de execução ficam no diretório local de visualizações, fora do Git. Nenhum vídeo é enviado a terceiros.

Validações locais: seleção do arquivo original e associação ao job; miniaturas; seek do segundo recorte em 00:13.467 e faixa 404–862; união e restauração de 80 recortes; revisão de alerta em 00:06.000 e restauração para zero alertas revisados. Esses registros de teste não foram salvos como validações humanas.

Conferência adicional: replay do segundo recorte para em 00:28.733 e retorna ao vídeo completo (quadro final 27.320); galeria sem overflow horizontal em 390×844. Inspeção visual encontrou falsos positivos aos 07:35 (mão) e 08:20 (próximo ao tênis), expostos como achados locais na fila Marcações, separados de classificações feitas pelo professor. A execução integral não corrige automaticamente esses erros conhecidos.


Resultado integral concluído: 27.321/27.321 quadros processados, 20.222 com marcação (74,0%) e 7.099 sem marcação; 171 lacunas de pelo menos 0,5 s e zero saltos acima do limiar de 100 px. Tempo da execução concluída: 1.414 s, em CPU local. Zero saltos não implica ausência de falsos positivos. Todos os tempos e coordenadas dos 27.321 registros e os 80 intervalos/miniaturas passaram pelas verificações estruturais. Inspeção adicional de seis quadros dos minutos finais confirmou a exibição dos resultados, sem estabelecer precisão global. Nenhuma validação humana oficial foi salva.

Ajuste de navegação: clicar na miniatura seleciona o rally e posiciona o vídeo, mantendo a galeria aberta. Informações só abre por escolha explícita da aba.


## Entrada, análise manual e visão do atleta — 12/10/2026

Mockup independente, sem integração ou publicação. Entrada com palco vazio e ação Adicionar vídeo; arquivo local, amistoso de referência e formulário para link HTTPS direto de MP4/WebM/M4V. YouTube/Vimeo são identificados como não conectados: a reprodução por seus players não fornece automaticamente os quadros para rastreamento. Links remotos dependem da disponibilidade e do codec; não foram certificados com provedor externo nesta rodada.

Escolha Assistida por IA ou Manual após abrir o vídeo. O amistoso usa os resultados reais já processados; arquivos desconhecidos não simulam processamento e orientam a análise manual. Rascunhos manuais separados dos assistidos preservam revisões e evitam sobrescrever os cortes. Contatos manuais guardam instante, fundamento e equipe; faixa temporal usa letras dos fundamentos e cores de equipe (verde nossa equipe, azul adversário), além de rótulos textuais. Detecção automática de contato/fundamento ainda não existe.

Compartilhar abre uma prévia local do atleta: reprodução, navegação por rallies e trajetória, sem controles de edição ou salvamento. Nenhum link é publicado, nenhuma permissão remota é criada. CSS/guardas do mockup não constituem autorização de produção. A integração precisará validar no servidor usuário, organização, equipe e acesso à sessão; revogação e tokens de mídia curtos são requisitos propostos.

### Armazenamento proposto

- Hoje: vídeo original no computador e hardlink local no servidor do mockup; resultados separados em JSON. Não há nuvem conectada.
- Produto: upload direto para armazenamento privado/serviço de vídeo, processamento fora do Expo, versões de streaming adaptativas e cache local limitado. Supabase continua fonte de autorização, sessões, revisões e vínculos.
- Rallies são referências de início/fim sobre um único vídeo; exportar um recorte seria uma ação separada. Trajetórias/contatos não precisam ficar gravados nos pixels.
- Definir cotas, retenção e arquivamento por equipe; original preservado conforme política explícita, sem exclusão silenciosa. Custos de armazenamento, entrega e processamento precisam de medição antes da escolha de fornecedor.
- Referência de volume: original local 860.741.220 bytes (~861 MB decimais). Cem arquivos semelhantes somariam ~86 GB. Uma versão de 15 minutos a 2 Mbit/s teria ~225 MB apenas de vídeo, estimativa sem áudio/overhead e sem garantia de qualidade para a bola.

Referências consultadas: [Hudl: compartilhar com membros da equipe](https://support.hudl.com/s/article/share-video-and-data-new-hudl-fb?language=en_US&topic=Review_and_Share_Video_V3), [Cloudflare Stream: armazenamento, codificação e streaming adaptativo](https://developers.cloudflare.com/stream/), [URLs assinadas](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/), [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference). Exemplos de arquitetura, não seleção ou contratação de fornecedor.

Validação desta iteração: sintaxe JavaScript e IDs HTML únicos; entrada vazia, abertura do amistoso, modo manual sem cortes automáticos, criação de contato adversário e restauração pelo histórico, retorno a 80 recortes assistidos, navegação e reprodução na prévia do atleta sem controles de edição. Largura mobile 390 px sem overflow horizontal (documento 380 px); viewport restaurado. Checklist regenerado e diff check aprovados. Teste de contato desfeito; detector não foi alterado nesta rodada.


## Refinamento mobile, preparação e comparação do detector — 12/10/2026

Nomes finais: **Automático** e **Manual**. A escolha fica na importação. O modal seguinte mostra estados reais de reconhecimento da mídia, rallies e rastreamento; resultados do amistoso são reutilizados, sem progresso fictício. Manual entra diretamente após loadedmetadata. Arquivo sem resultados automáticos oferece continuar manualmente, sem fingir que foi processado.

Até 1199 px, o painel recolhível abre sobre o player, com fechamento explícito/Escape e recolhimento ao escolher um rally. A linha do tempo não é deslocada. Desktop mantém painel lateral. Registro humano de contato continua livre: qualquer fundamento, equipe e instante, sem sequência obrigatória. Campo Após o contato distingue continua na equipe, vai para o outro lado e rally encerrado, sem derivar automaticamente o fundamento ou impor regras esportivas.

### Experimento conservador v3 (não ativado por padrão)

Processado sobre todos os 27.321 quadros, reutilizando pesos ONNX e resultados v2. Arquivos locais refined-tracks.json, refined-report.json e refinement-audit.json. Rejeita candidato somente por cor quando suporte local do modelo <0,12; rejeita candidato do modelo com escore <0,65 e fração de cor <0,08. Estes números são heurísticas, não probabilidades calibradas. Usa a faixa de cor já específica deste amistoso e não representa uma solução geral para outras bolas/iluminações.

Marcação caiu de 20.222 para 17.459 quadros (74,0% para 63,9%); lacunas >=0,5s subiram de 171 para 202. Foram suprimidas 2.763 marcações, não 2.763 erros comprovados. A auditoria visual confirmou remoção dos exemplos de mão (07:35) e tênis (08:20), mas também supressão de bolas verdadeiras (por exemplo, amostra de 01:20,93). Por isso o baseline continua padrão e o candidato é opt-in em Validação / Comparar filtro experimental. Não houve treino nem alteração dos pesos; dados deste vídeo não comprovam generalização. Correções do professor permanecem prioritárias nas duas visualizações.

Para aprendizado futuro: correções revisadas e autorizadas virariam dados de treino versionados; separar jogos inteiros entre treino e teste, incluindo quadras, bolas e iluminação diferentes. Medir falsos positivos, perdas/oclusões e tempo de correção antes de publicar um novo modelo. Não há aprendizagem automática ou envio de dados implementado no mockup.
Validação: preparação passa de estados pendentes a três etapas concluídas por dados reais; Manual abre sem confirmação extra. Comparação ativada mostra 63,9%/202 lacunas e desativada restaura 74,0%/171. No mobile, escolher rally 02 recolhe painel e vai a 00:13.467; Marcar contato reabre editor. Recepção com Vai para o outro lado preservada ao registrar; registro de teste desfeito via histórico. Sintaxe/IDs/checklist/diff aprovados. Viewport restaurado.

Mobile refinado: cabeçalho compacto com ações recolhíveis, seguindo referência da quadra visual; controles em gradiente sobre o vídeo, ocultáveis e recuperáveis. Paisagem ocupa 100dvh sem reservar espaço para cabeçalho/timeline; retrato usa proporção original. ResizeObserver e resize recalculam imagem e overlay juntos. Conferidos 852x393 e 393x852, expansão/recolhimento do cabeçalho. Treinamento permanece evolução proposta: aprovação da direção não significa pesos treinados ou aprendizado automático ativo.
Ajuste responsivo adicional: cabeçalho inicia com ações em ícones na mesma linha; seta recolhe todo o bloco a um botão. Painel fica abaixo do vídeo quando sobra pelo menos 175px em retrato, recalculado por dimensões reais; em paisagem/altura curta usa ícone e painel sobreposto. Galeria compactada no modo inferior para priorizar miniaturas.
Faixas Contatos/Bola agora compartilham rolagem horizontal até 1199px, com largura mínima interna de 1128px e marcas de pelo menos 4px. Rótulos permanecem fixos; player e controle geral de busca não rolam junto.

Downloads locais: ícone por rally (MP4), seleção múltipla (ZIP) e vídeo completo. Recortes reais para fontes full/demo; outros arquivos permitem baixar o original. Sem overlay; servidor scouting-video-server.py usa imageio_ffmpeg e deve ficar junto dos arquivos de mídia. Validado ZIP com dois MP4 e seleção no navegador.

Editor manual refinado: equipe/identificação manual lado a lado a partir de 430px de painel; resultados por fundamento (saque: em jogo/ace/erro), destino opcional recolhido e ajuste de recorte separado. Valores antigos preservados, sem integração de elenco. Referências: https://www.hudl.com/support/hudl-volleyball/guides/filtering e https://www.dataproject.com/Products/us/en/volleyball/DataVolley4. Validado formulário de saque no navegador; sem salvar contato de teste.


### Recuperação da imagem no navegador integrado — 12/10

Corrigida tela preta com mídia carregada: o navegador decodificava quadros válidos, mas a superfície de vídeo não os apresentava. O mockup agora desenha os quadros em canvas na mesma área, por `requestVideoFrameCallback`, seek e pausa. Vídeo original, áudio, controles, overlays e marcações permanecem na mesma sessão. Validado no navegador integrado com a imagem restaurada; alteração aplicada também à cópia servida em 8093.
