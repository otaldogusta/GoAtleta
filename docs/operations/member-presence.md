# Presença no avatar — preparação local em 22/10/2026

O perfil administrativo de um membro mostra um ponto no canto inferior do
avatar. Verde significa atividade recente nesta instituição; cinza preenchido,
sinal expirado; anel vazio, status desconhecido/indisponível. Último login e
conexão local do coordenador não são usados para inferir presença do colega.

O cliente autenticado/verificado envia heartbeat a cada 30 segundos enquanto o
app está em primeiro plano e a aba visível. O servidor define identidade e hora;
não recebe um usuário ou timestamp escolhido pelo cliente. A tabela privada
mantém somente o sinal mais recente por usuário/instituição. Escritas repetidas
em menos de 20 segundos não atualizam a linha; múltiplas abas não apagam o sinal
de outra aba ao fechar. O sinal expira em 75 segundos, com consulta a cada 20.
Offline pode levar até aproximadamente 95 segundos para aparecer. É presença
recente do aplicativo, sem promessa de resposta imediata ou de disponibilidade
da pessoa para conversar.

`touch_my_org_presence` exige vínculo real na instituição. Consulta de outro
membro exige administração da mesma instituição; só retorna status de membros
atuais dela. A tabela privada não tem acesso direto para anon/authenticated,
mesmo com UUID conhecido. Presença não concede autorização a nenhuma operação.

As requisições usam o cliente com identidade de sessão capturada e cancelamento
na troca de conta. A consulta invalida estado antigo em mudança de contexto,
falha ou ausência de resposta recente; nunca continua mostrando verde por cache
ou transforma erro em offline. Usuários sem heartbeat são desconhecidos.

Validação: migration real em PGlite isolado cobre autenticado, anônimo, outra
instituição, escrita somente própria, leitura administrativa, tabela privada e
transições desconhecido/online/offline. Testes do hook cobrem atualização,
expiração, falha e background. Tipos, lint, escopo e perfil focado aprovados.

## Ativação do backend

Em 22/10/2026, com autorização explícita do usuário, a migration foi aplicada ao
projeto `hgmdpetpwclucvquoklv` como `20261022214444_org_member_presence`. O arquivo
local foi alinhado ao identificador remoto. A leitura posterior confirmou RLS
ativo, negação de leitura direta a authenticated/anon e negação das RPCs a anon.
Após recarregar o localhost autenticado, o servidor recebeu um heartbeat real.
O próprio perfil exibiu Online nesta instituição e a bolinha verde; o perfil
de colega sem sinal manteve desconhecido. Conferência visual sem alterações
de permissões. Publicação do frontend autorizada pelo usuário em 22/10/2026;
aceite de fila não certifica disponibilidade em produção. Só clientes com esse
código enviam os sinais.
Recarregar após a ativação habilita a tentativa de consulta/heartbeat. Usuários
que ainda não enviaram sinal continuam desconhecidos. Teste hospedado com duas
sessões e desaparecimento por expiração permanece pendente. Não foram alteradas
funções ou permissões de membros da instituição.

Referência: [funções e segurança no Supabase](https://supabase.com/docs/guides/database/functions).
