# Backup local do scouting — 01/11/2026

## Ativo nesta estação

`scripts/scouting-storage-snapshot.py --watch` verifica a origem localhost:8081
a cada 30 s, cria ZIP só quando o conteúdo muda, preserva versões anteriores e
confere hashes antes/depois da cópia e dentro do ZIP. Não abre o banco, não
copia o vídeo e não controla a aba. Há apenas uma instância por pasta (lock
exclusivo); erro fica em backup-status.json e é tentado novamente no ciclo
seguinte. Limite de 500 MiB em ZIPs impede crescimento ilimitado, sem apagar
arquivos. Não é backup cloud nem monitor com notificação remota.

Destino nesta estação: D:/Taça Paraná/2026/SUB19 Masculino/Backups scouting.
Processo de prioridade BelowNormal: amostra de 16,7 MiB de working set e
1,64 s de CPU acumulados em 481 s. Isso mede somente o helper local, não o app.
Ele sobrevive ao fim do chat, mas não reinicia após reboot. Launcher manual:
`scripts/start-scouting-backup.ps1 -Source <pasta IndexedDB> -Destination <pasta externa>`.
Criar STOP_BACKUP no destino encerra só o helper; remover esse arquivo antes de
uma nova execução. Lock obsoleto após crash exige confirmar que o helper parou
antes de remover apenas backup-watcher.lock. Não iniciar instâncias duplicadas.

## Recuperação exercitada

Snapshot 20261101T210442595365Z restaurado com `--restore <zip> --restore-to
<nova recovery-pasta>` sem tocar no perfil ativo. Todos os arquivos extraídos
conferiram com o manifesto. Destinos existentes, perfis, origem errada, membros
inesperados, traversal e corrupção são recusados antes da escrita do conteúdo.

`scripts/scouting-recover-records.py` reconstruiu 17 registros JSON, incluindo
blob externo do documento atual. Validadores reais de vídeo, IA e vínculos
passaram (`scripts/validation/scouting-backup-recovery.cjs`): 185 segmentos,
184 sugestões, três origens vinculadas, 12 checkpoints (720 s) e 8.081 posições.
Os 17 registros foram escritos e relidos em IndexedDB separado em
127.0.0.1:8098, sem mutar localhost:8081, com conteúdo idêntico. Isso testa a
recuperação lógica desta cópia; não houve substituição do perfil original.
JSONs portáveis e receipt recovery-tested.json foram guardados junto dos ZIPs.

A ferramenta diagnóstica usa [dfindexeddb](https://github.com/google/dfindexeddb)
20260210, python-snappy 0.7.3 e cramjam 2.14.0, instalados isoladamente e copiados
para recovery-tools/python-packages no destino privado. Adaptador de Zstandard
usa cramjam no Windows; V8 v16 é aceito exclusivamente para strings JSON,
validadas de novo pelos parsers do app. Não altera dependências do produto.
Dados recuperados e pacotes privados não são versionados.

Limites: um minuto ainda em inferência não foi commitado e pode precisar ser
refeito; há até 30 s entre uma gravação e a próxima tentativa de backup. ZIPs
conservam todo IndexedDB da origem, incluindo outros rascunhos; não incluem
localStorage, vídeo ou falhas simultâneas do disco de origem/destino. Nenhuma
promessa de perda zero, recuperação cloud ou rollback automático do banco real.

## Peso e otimização sem recarga

A reprodução simultânea do YouTube foi pausada; detector no original continuou
na GPU, de 20% para além de 23,7%. Nenhum source importado pelo app ativo mudou.

Implementação candidata em `scouting-lightweight-after-tracking.patch`:
- Um worker/modelo por execução longa, reutilizado entre minutos e liberado na
  conclusão, falha ou cancelamento; não é compartilhado entre contas/jobs.
- Conferência da prévia sem criar uma segunda coleção normalizada. Com offset
  zero e limites válidos, reutiliza as posições integrais imutáveis; divergência
  de edição continua recusada e offsets conservam precisão.

55 testes focados e tipos da árvore isolada passaram. Fixture de 111 mil
posições verificou mesma coleção e zero objetos adicionais nesse caminho,
contra 148 mil objetos normalizados no código anterior (inclui prévia de 37
mil). Não é medição de FPS, heap total, tempo GPU ou velocidade do jogo real.
Leitura sequencial por quadros e carregamento sob demanda continuam futuros.

**Candidata não ativada**, para impedir HMR/restart do rastreio atual. Depois de
concluir e salvar, conferir source hashes de
`scouting-lightweight-source-hashes.json`, revalidar diff e aplicar com
`git apply --unidiff-zero --ignore-space-change scouting-lightweight-after-tracking.patch`
a partir da raiz (usar o caminho docs/operations/ no comando). Não aplicar sobre
edições concorrentes. O check da aplicação do patch passou nesta árvore.

Validação do helper: seis testes de roundtrip, corrupção, destino existente,
perfil ativo, backup dentro da origem e traversal. Tipos da candidata e diff
conferidos. Sem publicação, migration ou troca de banco real.

## Primeiro recorte — correção preparada em 01/11

O usuário confirmou o início do rally 01 em **00:47.640**. O editor e o parser
atuais impõem início zero ao primeiro segmento. A candidata
`scouting-first-rally-after-tracking.patch` libera somente esse limite inferior
(início não negativo), mantendo ordem, duração, proteção da marca do ponto e IDs.

**Não aplicada ao app ativo:** o rastreio ainda está em andamento; alterar o core
importado pode disparar Fast Refresh e efeitos de limpeza do processamento.
O recorte salvo continua em zero até a ativação segura. Não foi corrigido na UI.

Validação isolada sobre a exportação privada atual: início 47.640, JSON roundtrip,
undo/redo, demais recortes/contatos/analysis idênticos e rejeição de início negativo,
NaN, fim e exclusão da marca do ponto em 62s. `git apply --check
--ignore-space-change docs/operations/scouting-first-rally-after-tracking.patch`
passou. Após concluir e salvar o rastreio: reler os arquivos, conferir o patch,
atualizar o teste antigo que exigia início zero, aplicar, validar o fluxo local e
salvar 47.640 pelo editor. O teste isolado não certifica o fluxo ainda não ativado.

## Ativação local após a conclusão — 01/11/2026

Às 23:08 UTC, o rastreio terminou, foi explicitamente associado e o estúdio
confirmou Sincronizado. Exportação privada anterior às correções: 163 recortes e
51.233 posições. Só depois foram aplicadas as candidatas de primeiro recorte,
otimização de worker/cópias e feedback/UX. Os patches acima são registros das
candidatas **já integradas localmente**, não instruções para reaplicação.

Rally 01 salvo com início 47.640. Exportações antes/depois comparadas: única
mudança foi esse início; demais recortes, IDs, marca do ponto, contatos,
correções e tracking idênticos. Sugestões em cache não recriam a preparação
excluída e aceitação de tracking preserva um primeiro recorte já ajustado.
Scouting mostra progresso por set e Próximo pendente, pula Sem imagem e coloca
as ações de vídeo antes dos contatos. Informações tem estado terminal de rastreio
associado e não mantém a prévia ao vivo como trabalho em andamento.

A sincronização do novo início foi recusada pelo backend atual: seu normalizador
exige primeiro início zero. Rascunho atual salvo neste aparelho e em backup;
sem alegação de sincronização final. Migration aditiva
`20261101234500_scouting_video_first_rally_start.sql` preparada e validada em
PGlite com regressões de RPC, idempotência, limites, papéis, turmas e organização;
**não aplicada remotamente**. Nenhuma policy/grant ampliada, estatística oficial
editada, commit, push ou deploy executado.

Snapshot final 20261101T231137222544Z extraído em recovery isolado, manifesto
conferido e 67 JSONs reconstruídos: 62 checkpoints, 51.233 posições até
3699.504854 s, 184 sugestões YouTube, três origens, 163 recortes; parsers reais
aceitaram inclusive início 47.640 e sidecar com 43 vínculos de vídeo/um Sem imagem.
Esta cópia final foi testada fisicamente e nos parsers; o roundtrip em IndexedDB
continua sendo o teste anterior de 17 registros, não foi repetido para esta cópia.

Validação integrada: 107 testes focados de core, revisão, processamento e retomada;
tipos do app; SQL isolado; org-scope; diff. Browser localhost 1384x704: novo início
salvo, intervalo inválido bloqueado, Resetar preserva o recorte salvo, Próximo
pendente abre registro 42 sem escrever vínculo e conclusão do tracking exibida.
Exportação final e prova visual privadas guardadas; sem certificação em native.
