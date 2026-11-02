# Scouting — pesquisa comparada e proposta visual

Pesquisa de fontes primárias consultadas em 02/11/2026. As afirmações sobre
outros produtos abaixo são documentação dos fornecedores/autores, sem teste
hands-on ou medição independente de precisão. **Adotar** e **evitar** são
decisões propostas para o Go Atleta; não descrevem funcionalidades já entregues.

[Mockup v2](mockups/scouting-unified-2026-11-02-v2.html) ·
[Notas da v2](mockups/scouting-unified-2026-11-02-v2.md) ·
[Implementação do workspace](SCOUTING_ESTUDIO_UNIFICADO_2026-11-02.md) ·
[Domínio, regras e ativação da coleta v3](SCOUTING_COLETA_V3_2026-11-02.md).

## Comparação de seis ferramentas

| Ferramenta e documentação primária | O que está documentado | Adotar no Go Atleta — proposta | Evitar — inferência de projeto |
| --- | --- | --- | --- |
| [SoloStats123 — Capture Buttons Explained](https://www.solostatslive.com/product/solostats-123) | Entrada por atleta, ação e vencedor; ações separadas entre continuidade, ponto, erro e falta. Confirmação fica indisponível enquanto incompleta. Desfazer muda de função durante a edição. Saque/recepção dependem de quem saca. | Separar o que aconteceu de quem venceu; manter desfazer perto do placar e uma confirmação clara. Mostrar ações pertinentes à jogada. | Reproduzir toda a grade especializada ou inferir assistência automática ao levantador. Simplificar navegação não autoriza fabricar contatos. |
| [Data Volley 4 — produto e comparação de versões](https://www.dataproject.com/Products/us/en/volleyball/DataVolley4) | Coleta pode começar parcial e ser completada depois; vídeo integrado; buscas por jogador, fundamento e rotação, incluindo side-out/break point. Há versões com capacidades distintas. | Profundidade opcional: registrar o que foi visto e complementar pelo vídeo. Manter vídeo, ponto e contatos relacionados. | Exigir códigos de especialista como porta de entrada ou prometer todas as capacidades profissionais como um único recurso simples. |
| [VolleyStation — manual](https://volleystation.freshdesk.com/support/solutions/articles/103000030663-volleystation-manual) e [sincronização](https://volleystation.freshdesk.com/support/solutions/articles/103000030691-how-to-synchronize-the-game-) | Cards básicos/avançados e codificação; modos de timestamp preditivo e em tempo real; sincronização pode ser corrigida, ancorando o código ao instante do vídeo. | Fluxo guiado, com detalhes recolhidos; separar tempo estimado de tempo confirmado. Permitir ajuste fino sem refazer a coleta. | Tratar incremento temporal preditivo como identificação visual comprovada ou deslocar o jogo inteiro por uma única âncora após pausas na gravação. |
| [Hudl para vôlei — Completing Data](https://www.hudl.com/support/hudl-volleyball/guides/completing-data) e [Balltime — FAQ](https://academy.balltime.com/getting-started/faqs) | Revisão de sets, placar, rotações iniciais, cantos da quadra, blocos e atletas desconhecidos; tarefas podem ser puladas e reabertas. Contatos podem ser reavaliados com desfazer. O FAQ permite corrigir identificação automática. | Uma fila de pendências com contexto, assistir, confirmar, pular e desfazer. Permitir rotação desconhecida e lance sem imagem. | Usar conclusão do processamento como sinônimo de análise revisada, ou converter sugestões em dados oficiais sem confirmação. |
| [BallerCam — Point Classification and Tag Stats](https://support.ballercam.com/hc/en-us/articles/49263651878925-How-to-Use-Volleyball-Point-Classification-and-Tag-Stats) | Classifica pontos ao vivo em aparelho iOS secundário autorizado; permite completar tags no desktop depois. Diferencia Block Point de Block defensivo. Seu fluxo não atribui erros a atleta. | Aceitar registro ao vivo reduzido e revisão posterior. Distinguir ação terminal de bloqueio com continuidade. | Copiar a decisão de não atribuir erro ao atleta como regra universal; presumir que suporte iOS de outro produto comprova nosso fluxo Android/notebook. |
| [ovscout2 — manual](https://ovscout2.openvolley.org/articles/ovscout2-user-manual.html) e [repositório](https://github.com/openvolley/ovscout2) | Coleta guiada por clique ou digitação; retoma arquivo parcial; contempla freeball e toque no bloqueio. Detalhes de transição podem ser omitidos. O manual alerta que defaults podem virar dados falsos. | Preservar parcialidade; distinguir continuidade/encerramento e dado desconhecido. Retomar revisão sem reescrever o que já foi observado. | Preencher automaticamente atleta, toque ou bloqueadores apenas para completar a interface; transportar sua stack R/Shiny para o app. |

## Limites que mudam nossas decisões

**Coleta incompleta não é um jogo sem erros nem sem tentativas.** O README do
ovscout2 explica que registrar apenas pontos e erros de ataque não fornece o
total de tentativas necessário para medir a eficiência completa. Para o caso
relatado pelo usuário — marcou principalmente quem fez o ponto — o Go Atleta
deve apresentar ações observadas e amostra parcial, sem inventar tentativas,
recepções ou percentuais de um jogo completo.
[Explicação dos autores](https://github.com/openvolley/ovscout2).

**Automação precisa de revisão explícita.** Balltime documenta que ângulo e
qualidade interferem na identificação e permite corrigir rallies, ações e
atletas. O fluxo Hudl aceita pular dados faltantes e desfazer avaliações. Isso
fundamenta nossa proposta de candidatos com status de conferência, sem afirmar
precisão equivalente ao produto comercial.
[Balltime FAQ](https://academy.balltime.com/getting-started/faqs),
[Hudl — Completing Data](https://www.hudl.com/support/hudl-volleyball/guides/completing-data).

**Selecionar “5 × 1” não comprova um motor de rodízio.** O próprio manual do
ovscout2 informa que essa seleção atualmente não produz efeito; estratégias
com dois levantadores têm comportamento específico. Nosso desenho P1/P6/P5/P4/
P3/P2 é uma referência ilustrativa. Não demonstra validação de escalação,
substituições, líbero, sobreposição, mudanças de lado ou formação real.
[Manual — Starting a new match](https://ovscout2.openvolley.org/articles/ovscout2-user-manual.html).

**Licença não é decisão de arquitetura.** O `DESCRIPTION` do ovscout2 declara
`MIT + file LICENSE`, e o arquivo complementar identifica os autores/ano.
Nesta pesquisa não houve cópia de código ou instalação de R/Shiny. Aproveitamos
conceitos de fluxo; qualquer reutilização futura de código precisa registrar
origem, avisos e licenças das dependências efetivamente usadas.
[DESCRIPTION](https://github.com/openvolley/ovscout2/blob/master/DESCRIPTION),
[LICENSE](https://github.com/openvolley/ovscout2/blob/master/LICENSE).

## Exemplos do usuário e resposta visual

| Situação observada nesta conversa | Resposta na proposta |
| --- | --- |
| Primeiro scouting, com registro principalmente do ponto e de quem pontuou | Registro rápido de resultado, com atribuição quando conhecida. Contatos adicionais opcionais. Indicadores continuam identificados como amostra parcial. |
| Placar errado durante o jogo e necessidade de voltar rápido | Desfazer próximo ao placar; diferença entre preparar uma entrada e confirmar o ponto. Correção tem alvo do set explícito. |
| Primeiro rally começa em **00:47.640** e havia um recorte sem rally | Recortes com início/fim, preview e quadro a quadro. Corte automático é candidato revisável; o desenho usa esse instante como exemplo, sem declarar nova detecção. |
| Primeiro rally do terceiro set ausente apenas no vídeo | Estado sem imagem e alinhamento por set/lance; nenhuma tentativa de fabricar trecho ou apagar o ponto registrado. |
| Preservar os **99 vínculos com vídeo revisados** e a coleta original | Revisão de candidatos fora dos registros autorais; mudanças explícitas e reversíveis nos vínculos. A nova proposta não é autorização para reescrever os existentes. |
| Registrar/Vídeo/Câmera aprovados, mas preservar abas e timeline reais | Uma navegação principal e inspetor **Recortes / Scouting / Informações** no Vídeo. Transporte e camadas da timeline permanecem. |
| Registrar faltas, freeball e bloqueio sem ponto com menos esforço | Estados compactos de estudo; continuidade não aumenta o placar. Falta de equipe não vira automaticamente erro técnico de um fundamento ou atleta. |

## Decisões da v2

O cabeçalho reúne contexto e **Registrar / Vídeo / Câmera**. No Vídeo, o
inspetor preserva **Recortes / Scouting / Informações**. Recortes cuidam de
seleção e limites; Scouting reúne ponto e contatos; Informações reúne fonte,
processamento, trajetória e recuperação. Configurações ficam recolhidas.

O transporte conserva marcação anterior/próxima, quadro a quadro, play, relógio,
trajetória, marcar contato/ponto e velocidade. A timeline mantém segmentos,
contatos, contexto e faixa **Bola**. A proposta compacta o tamanho visível dos
controles, preservando foco, nomes acessíveis e alvos operacionais. Em telas
estreitas, o inspetor passa para baixo; não há zoom global nem fonte remota.

Registrar explora uma confirmação por resultado e observações de continuidade.
Os rótulos **Ponto / Falta nossa / Falta adversária / Freeball / Bloqueio com
continuidade** correspondem aos critérios explícitos do contrato da coleta v3.
O mockup é uma demonstração desses estados e não executa comandos no banco.
A referência 5 × 1 tem sinalização ilustrativa própria.

## Custos e estado de entrega

Esta comparação orienta fluxo e dados, sem recomendar contratação nem cotar
preços. Recursos comerciais não identificam, por si, um modelo de IA que possa
ser incorporado ao Go Atleta. Custos de uma automação própria dependem de
duração processada, amostragem, resolução, retomada e retrabalho; eficiência e
precisão precisam ser medidas em vídeos representativos.

O mockup é HTML/CSS/SVG e JavaScript local, sem serviço de inferência ou acesso
ao scouting. O smoke DOM cobriu modos, abas, sets, timeline/quadro a quadro,
continuidade, placar/desfazer e estados da câmera. Esse teste não comprova
layout, captura no Android, motor completo de 5 × 1 ou análise de vídeo real.

A extensão de domínio/SQL para novas marcações está implementada e testada
localmente, conforme o [contrato da coleta v3](SCOUTING_COLETA_V3_2026-11-02.md).
A migração foi aplicada remotamente após autorização explícita, com schema e
contagens/hashes históricos preservados. O frontend permanece somente no
localhost, sem deploy, e a conferência visual não incluiu nova escrita RPC pela
UI. Isso não transforma o mockup em prova de análise automática ou motor
5 × 1. Regras e recibo de ativação ficam no contrato da coleta v3; os 99
vínculos revisados permanecem preservados.
