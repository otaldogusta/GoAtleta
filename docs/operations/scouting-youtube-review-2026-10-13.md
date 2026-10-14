# Go Atleta — conferência visual das sugestões do YouTube

Vídeo: `mdfgd1K3HTc`, duração 15:11. Equipe do usuário perto da câmera, sem
troca de lado, confirmado pelo usuário nesta revisão.

**Resultado: lote de 94 rallies / 296 contatos reprovado para aplicação em
bloco. Não existe ainda uma lista completa corrigida e validada.**

A execução do Gemini terminou, mas isso comprova transporte/processamento, não
precisão esportiva. O JSON é estruturalmente válido e contém eventos que não
correspondem às imagens. Não tratar o lote como scouting confirmado.

## Evidências e limites

Inspeção de sequências do original local `full-video.mp4`, em 2 quadros por
segundo, nos intervalos 0–45, 300–310, 480–490, 660–670, 840–850 e 900–910.
O player YouTube foi conferido visualmente em aproximadamente 21 segundos,
compatível com a sequência local. Não foi certificada sincronização quadro a
quadro de toda a mídia nem revisado individualmente cada um dos 296 contatos.

| Sugestão do Gemini | Observação visual | Decisão de revisão |
| --- | --- | --- |
| Saque em 0:00 | Jogadores ainda posicionados; não se observa o contato de saque nesse instante. | Rejeitar esse instante; não substituir por um horário estimado. |
| Novo rally/saque em 5:00 | A sequência já contém bola em jogo e ações junto à rede. | Rejeitar o novo saque e o corte baseado nele. |
| Novo rally/saque em 8:00 | A jogada já está em andamento. | Rejeitar o novo saque e o corte baseado nele. |
| Novo rally/saque em 11:00 | A sequência mostra continuidade da jogada, seguida de perseguição da bola. | Rejeitar o novo saque e o corte baseado nele. |
| Novo rally/saque em 14:00 | Jogadores se reorganizam antes da próxima ação; a sequência não sustenta saque nesse instante. | Não aceitar o evento. |
| Novo rally/saque em 15:00 | Bola em jogo junto à rede, com continuidade de contatos. | Rejeitar o novo saque e o corte baseado nele. |

As discrepâncias não permitem corrigir o lote por um deslocamento global de
tempo. Os outros eventos permanecem **não verificados**, não automaticamente
errados ou corretos. A amostragem usada permite refutar esses saques; não permite
certificar todos os contatos rápidos, toques no bloqueio ou horários exatos.
Também não foi concluída a auditoria de atribuição de lados de cada contato.

## Estado preservado e pendência

- Modal de sugestões fechado sem aplicar. No estúdio YouTube: um segmento
  inicial e zero contatos; isso não representa a contagem real de rallies.
- Rascunho do arquivo original não foi editado nesta revisão.
- Cache bruto mantido como evidência, sem alterar respostas para aparentar
  acerto. Uma nova leitura do cache continuará retornando sugestões reprovadas.
- Evidências locais ignoradas pelo Git em `.tmp/scouting-gemini/review/`;
  nomes dos mosaicos indicam o segundo inicial, leitura por linhas, a cada 0,5 s.
- Reconstrução completa dos eventos e aplicação permanecem pendentes. Exigem
  conferência temporal mais fina; não usar os antigos 80 cortes de cena como
  verdade esportiva nem inventar eventos ausentes para completar a contagem.

Sem novas chamadas pagas, upload do original, publicação ou mudança remota.


### Aplicação parcial conferida — 13/10

Revisão panorâmica por imagens a cada 2 segundos cobrindo 0–911 s, seguida de sequências selecionadas a cada 8/30 s (e 4/30 s nos últimos contatos). Confirmados 18 saques/inícios em 17.5, 59.8, 93.4, 166.5, 184.1, 189.3, 218.8, 284.1, 323.5, 345.5, 417.7, 491.6, 532.6, 558.2, 633.1, 743.1, 834.5 e 874.2 segundos. Equipe do usuário perto da câmera, sem troca de lado, conforme confirmação do usuário.

Aplicados pelo importador existente e salvos no rascunho YouTube: 18 inícios e 26 contatos (18 saques e 8 contatos adicionais). A interface conta 19 segmentos por incluir o trecho inicial obrigatório em zero. Não é segmentação exaustiva: intervalos entre inícios confirmados podem conter rallies ainda não marcados. Instantes aproximados pela amostragem, tolerância de cerca de 0,27 s; sem atribuir atletas, resultados, vencedores ou pontos. Todos permanecem sem validação integral do rally.

Contrato validado com parseVideoDocument; exportação pela UI corresponde exatamente ao documento importado. Rascunho salvo, timeline micro e vídeo conferidos em 24,7 s. Backup anterior, documento corrigido, manifesto e screenshot em .tmp/scouting-gemini/review/ (youtube-before-confirmed.json, confirmed-youtube.json, confirmed-review.json, applied-export.json, applied-studio.png). O rascunho do arquivo original não foi alterado. O lote bruto 94/296 continua reprovado; esta aplicação parcial não certifica a precisão automática do Gemini.


### Revisão sequencial completa e aplicação final — 13/10

Esta etapa substitui o estado parcial descrito acima. Todo o original local já disponível, correspondente ao YouTube, foi inspecionado em sequência de 0 a 910,7 s: 92 mosaicos com imagens a cada 0,5 s. Os contatos candidatos foram ampliados em janelas de cinco segundos a 6 fps. ElCartel permanece perto da câmera, sem troca de lado.

Resultado aplicado pelo importador do estúdio e salvo: **78 segmentos de rally e 201 contatos**, acrescentando 59 segmentos e 175 contatos ao rascunho anterior. Foram descartadas as divisões em 711,3 e 876 s, que não representam novo rally. Os novos recortes podem começar na preparação após o corte da edição; não são todos timestamps exatos do saque. Os IDs e marcações anteriores foram preservados.

Os contatos registram apenas fundamentos/equipes observáveis. Toques encobertos, identidade dos atletas, qualidade do contato, vencedores e instantes de ponto não foram inferidos. Os tempos são aproximados pela amostragem, não medições quadro a quadro. A cobertura temporal é completa; a lista conservadora não pretende conter todos os toques. Os rallies permanecem sem resultado e sem selo de validação integral. O lote bruto Gemini 94/296 continua reprovado: esta correção visual não certifica a precisão automática.

Validação proporcional de dados: parseVideoDocument aceitou o documento; exportação posterior pela UI comparada por igualdade estrutural com o importado (78/201), rascunho salvo e navegação micro até o último rally conferida. Sem alteração de código, chamada Gemini, upload, commit ou ativação remota. Rascunho do arquivo original preservado.

Evidências locais em `.tmp/scouting-gemini/review/`: `complete/001.jpg`–`092.jpg`, `close/`, `accepted-final.json`, `before-full-review.json`, `full-reviewed-youtube.json`, `full-applied-export.json` e `full-applied-studio.png`. O arquivo `complete/observations.json` é provisório e não deve ser importado. A exportação anterior ao lote final permite restauração.
