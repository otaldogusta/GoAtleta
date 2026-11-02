# Release do scouting — 02/11/2026

Publicação da etapa atual autorizada pelo usuário. O pacote reúne estúdio
unificado, revisão manual/vídeo, recortes e sugestões assistidas, desfechos da
coleta v3 e ferramentas locais de câmera/backup. O checkout de release parte de
`origin/main` em `6b9222e2`, preservando a edição de unidade na agenda.
O checkout `8400` e seu companion permanecem separados da validação.

## Banco e limites de ativação

Preflight somente leitura confirmou as migrations já aplicadas no projeto
`hgmdpetpwclucvquoklv`: `20261102125248 scouting_rally_outcomes` e
`20261102132034 scouting_video_first_rally_start`. Os timestamps remotos diferem
dos arquivos locais; não reaplicar por essa diferença. Nenhuma Edge Function
mudou nesta etapa, nem houve nova alteração de ambiente ou segredo.

Câmera/QR e execução da IA pelo companion permanecem restritos a desenvolvimento
local. Produção não anuncia essas ações. Sincronização dos 99 vínculos revisados
continua em sidecar da origem localhost: publicar o código não transfere esse
armazenamento para goatleta.com. Pontos e contatos oficiais não são reescritos.

## Validação e publicação

O smoke autenticado em localhost:8081 abriu a revisão existente, reproduziu o
ponto vinculado a partir de 01:02, mostrou Sincronizado e navegou entre Registrar
e Vídeo sem editar pontos. Captura privada: `scouting-release-local.png`.
Os 59 testes Node dos serviços de câmera/YouTube passaram.

A primeira rodada completa apontou lint/performance e um timeout da agenda:
751 de 752 suítes passaram. A suíte da agenda passou isoladamente, 42/42.
Correções mínimas de lifecycle/escopo e medições reais foram validadas pelas
suítes focadas; sem ampliar baseline ou relaxar autorização.

O fechamento usa `npm run build:verified`, após preparar o runtime ONNX,
com recibos por conteúdo em `.tmp/validation`. Consultar o resultado real do
executor; este documento não substitui seus recibos nem certifica produção.
Após os gates, fazer um único push para main e verificar a aceitação na fila
Vercel/CI, sem disparar um segundo deploy manual. A confirmação READY é separada.

Pendentes: novos controles no Android físico, infraestrutura pública da câmera
e transferência/publicação dos sidecars locais. Ver
[operação da câmera](scouting-live-local.md) e
[contrato do estúdio](../ui/SCOUTING_ESTUDIO_UNIFICADO_2026-11-02.md).
