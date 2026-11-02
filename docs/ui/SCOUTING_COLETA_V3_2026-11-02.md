# Scouting: desfecho e continuidade, coleta v3

02/11/2026. Frontend no localhost; migration aplicada com autorização, sem deploy do site.
[Pesquisa comparada](SCOUTING_PESQUISA_COMPARADA_2026-11-02.md) e
[mockup v2](mockups/scouting-unified-2026-11-02-v2.html).

## Decisões de domínio

Os contatos continuam descrevendo ações observadas da nossa equipe. Um desfecho
opcional descreve quem cometeu a falta ou marcou o ace. Não gera um recebedor,
erro de recepção ou contato presumido. Ponto sem contatos continua válido.

| Situação | Registro | Efeito |
| --- | --- | --- |
| Rede, dois toques, linha do saque, invasão, quatro toques ou rodízio | `outcome.kind=falta`, equipe e motivo; Outra também é aceita | Ponto para a outra equipe, sem converter a falta em erro de ataque |
| Ace adversário | `outcome.kind=ace`, equipe `them` | Um ponto; exige saque adversário, sem contatos ou apenas recepção/erro observada |
| Freeball enviada | `ataque/freeball_devolvida`, apresentado como Bola de graça | Não encerra; excluído da eficiência e das contagens legadas de ataque |
| Ataque volta do bloqueio | `ataque/bloqueio_continua` | Não encerra; oferece Cobertura a seguir, sem preenchê-la |
| Bloqueio encerra | `ataque/bloqueio_ponto` | Ponto adversário; permanece distinto de continuidade |

O fundamento técnico continua no contrato existente para evitar que leitores
normalizem uma categoria desconhecida como Saque. A classificação de freeball é
explícita, com exclusão estatística própria. A fase `freeball` histórica não é
reinterpretada. O resultado antigo `bloqueado` continua ambíguo e preservado.
Não há captura completa dos contatos adversários nem motor de arbitragem.
Ace nosso aceita somente ausência de contatos ou Saque/Ace. Uma sequência de
recepção boa, levantamento e ataque não pode terminar classificada como ace.
Falta na linha do saque exige a equipe sacadora. As verificações não apagam
contatos e não impõem um limite de três registros ao rally inteiro.

## Rodízio e regras consultadas

O scouting já usa a **zona do levantador**, não um índice ordinal de rotação.
Na recuperação do saque, percorre **P1 → P6 → P5 → P4 → P3 → P2 → P1**.
Mantém a zona quando conserva o saque ou perde o ponto. Na Quadra Visual,
`rotationIndex=2` significa P6; não se pode passar zona 6 como índice 6.
A seleção do levantador não implementa escalação completa, líbero ou substituições.

A [FIVB 2025–2028](https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN-v05.pdf),
regras 7.6.2 e 14.4, confirma o sentido do rodízio e que toque de bloqueio não
consome os três toques seguintes. Um ataque que retorna pode ter cobertura e
novo ataque no mesmo rally. Regras 11.3 e 12.4 distinguem faltas na rede e na
execução do saque de qualquer contato incidental ou aterrissagem posterior.

O [comunicado FIVB de 2026](https://www.fivb.com/fivb-board-of-administration-approves-rule-tests-for-2026-competitions/)
descreve a permissão de dois contatos na ação de levantamento do segundo toque,
mantendo a bola no mesmo lado, nas competições indicadas. Não presume aplicação
à Taça Paraná. A opção registra a **falta assinalada**, sem apitá-la automaticamente.
O formato adaptado informado pelo usuário (sets de 21, teto 23) não é substituído
pelo formato adulto do regulamento geral.

## Persistência e compatibilidade

- Nova migration aditiva: `20261102163000_scouting_rally_outcomes.sql`.
  Coluna nullable `scouting_rallies.outcome`, sem backfill e sem alteração de IDs.
- `get_scouting_detail.captureVersion=3` confirma suporte. Ausência significa v2;
  novos controles/resultados não aparecem e novos payloads são bloqueados antes
  do transporte. O cliente não finge salvar um atributo que o RPC antigo descartaria.
- Desfechos aceitam somente campos, equipes e motivos previstos. A mesma RPC
  preserva autorização, revisão, chave idempotente, recibo e transação.
- Reabrir recupera `recoveredOutcome`. Payload sem esse campo preserva a
  recuperação para clientes antigos; `null` explícito limpa. Não usar reabertura
  para migrar ou recriar pontos já ligados ao vídeo.
- O rascunho mantém a chave local por conta/organização/sessão. V1 continua
  legível; a escrita V2 guarda o desfecho. Ausência e limpeza explícita são
  distintas. JSON ilegível bloqueia mutações, preserva bytes e permite nova leitura.
- Pending request conserva o payload original. Resposta tardia de reload não
  substitui leitura mais recente. Backend sem suporte não recebe um draft novo.

Rubricas antigas continuam intactas; somente as duas novas chaves recebem
`rubric_version=3`. Vínculos continuam usando os mesmos sessionId/rallyId e
fingerprint, sem alterações no sidecar dos 99 vínculos revisados.

## Interface local

Motivo do ponto é opcional e recolhido; faltas revelam os motivos quando necessário.
Não exige atleta para falta de equipe ou ace adversário. Os dois botões de ponto
ocupam sua largura natural, com alvos de toque preservados. Contatos e confirmação
ficaram mais compactos. O inspetor mantém Recortes/Scouting/Informações, transporte
e timeline existentes; esta etapa não os substitui pelo desenho do mockup.

## Validação e ativação

43 testes de domínio, 54 de adaptador/hook/coletor e 29 de revisão passaram.
PGlite passou com esquema limpo e fixture de compatibilidade: round-trip,
recuperação, retry/hash/revisão, rollback, autorização e isolamento. Os 99 IDs
históricos dessa prova SQL são **sintéticos**; não equivalem ao jogo real.
Tipos, org-scope, arquitetura strict e perf-hygiene strict passaram.

Preflight remoto **somente leitura** confirmou o projeto da sessão e equivalência
dos corpos de sete funções atuais com a base usada na migration. Não houve DDL,
backfill, aplicação de migration, escrita de scout ou deploy nesse preflight.

A migration `scouting_rally_outcomes` foi aplicada após autorização explícita.
O pós-cheque confirmou coluna, constraint e `captureVersion=3`, sem classificar
nenhum rally histórico. Os hashes anteriores e posteriores permaneceram iguais
para os 118 rallies, 159 ações e 12 sessões existentes. A resposta autenticada
de `get_scouting_detail` no localhost retornou HTTP 200 e capacidade 3; o set
concluído continuou com os mesmos 40 rallies e 58 ações, sem novos desfechos.
Não foi criado ponto artificial no jogo para testar escrita pela UI. O teste
de novos comandos hospedados via Auth/PostgREST continua pendente; o round-trip
de escrita é atestado somente pelo SQL isolado e testes de frontend.

Conferência real em 1063 × 704 e 390 × 844 sem overflow horizontal. As abas
Recortes/Scouting/Informações e a troca Registrar/Vídeo conservaram o iframe
`widget2`, transporte e timeline. Os hashes dos documentos e sidecar do vídeo
permaneceram idênticos: 118 recortes e 99 vínculos revisados com vídeo.

Publicação do frontend é separada e não ocorreu. Clientes antigos não ganham
os novos controles e podem não interpretar os novos subtipos nas métricas
locais; esta ativação não equivale a um rollout público completo.
