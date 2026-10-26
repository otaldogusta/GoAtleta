# Revisão final local do pacote de entrada — 25/10/2026

Escopo: alterações acumuladas de login/cadastro, OTP, resolução de convite,
solicitações de atleta e responsável, logout e recuperação da leitura de papel.
Testes sem publicação do aplicativo ou alteração remota de banco; commit e push
posteriores seguem a autorização específica registrada abaixo.

## Contratos revisados

- O layout resolve a continuação de login/cadastro; convite de equipe não é
  confundido com código OAuth. Convite permanece entre login e cadastro e é
  removido do storage e da rota quando descartado.
- Confirmação de e-mail depende da prova confiável do produto. Cadastro sem
  sessão retornada segue para OTP. Sessão autenticada define o destinatário,
  sem prevalência do e-mail fornecido por URL. Envio e reenvio não concorrem.
- Nova escolha de convite substitui intenções antigas de outros tipos por fila
  serializada; logout limpa as três chaves. A troca de conta dentro de uma rota
  explícita preserva a intenção daquela rota.
- Aprovação de solicitação aguarda papel autorizado. Atleta recebe o próprio
  cadastro; responsável recebe relação familiar, preservando o login próprio
  da atleta e sem cargo de equipe. Restrições financeiras permanecem explícitas.
- Recuperação transitória refaz as leituras de autorização. Não concede papel de
  cache após erro e não repete automaticamente negações 401/403/404.

## Ajustes encontrados nesta revisão

Eventos de visibilidade, conexão e `pageshow` recebidos juntos não disparavam
chamadas simultâneas, mas podiam zerar o contador depois que a primeira tentativa
já tinha começado. A guarda `started` agora antecede a alteração do orçamento.
Regressão cobre falha subsequente e garante o intervalo e o teto de tentativas.

Uma conta já cadastrada, ao abrir `/staff-invite?code=...`, era enviada ao endpoint
de conclusão de senha e recebia uma orientação inadequada para conferir o e-mail.
Agora essa conta segue para `/pending`, que valida/consome o código com a sessão
atual. Somente contas com `app_metadata.staff_invite_setup_required=true` retomam
a definição de senha. Duas regressões distinguem os caminhos e garantem que a tela
não troca conta, concede organização ou chama a conclusão de senha indevidamente.

Depois de recusar um convite, `Usar outro convite` abria um formulário que ficava
oculto quando a conta já tinha uma solicitação aprovada. Agora o formulário de
convite existente pode aparecer sem repetir a busca de instituição ou o estado
de confirmação de acesso. Fechar retorna ao estado anterior e ir para o início
preserva a área familiar. Regressões cobrem solicitação aprovada de atleta e de
responsável; o caso familiar também foi conferido visualmente no localhost.

## Evidência e validação do pacote

O fechamento usa `npm run build:verified`, com o executor e os recibos descritos
em [release-validation.md](release-validation.md). Logs e resultados ficam em
`.tmp/validation/`; o resumo da execução acompanha o fechamento da revisão.
Esse comando valida e exporta localmente; não publica.

Na primeira rodada, os checks e o build passaram (644 suítes / 4.031 testes),
mas houve mudança de entradas durante a execução: o executor invalidou a rodada
e não emitiu recibos válidos. O fechamento requer nova execução após estabilizar
os arquivos e aplicar o ajuste do convite; não reaproveitar esse sucesso como
aprovação do pacote final.

A rodada final local passou com entradas estáveis: 12 checks e build web,
644 suítes Jest / 4.035 testes e 14 suítes SQL, sem reaproveitamento, em 368 s.
Recibo e prints adicionais em `.tmp/entry-package-review/review/`, com galeria
local em `http://127.0.0.1:8087/`. Credenciais e fixtures não integram o pacote Git.

## Preparação do commit e push

Após a validação local, o usuário autorizou commit e push, sem merge ou deploy.
Branch: `codex/fluxo-entrada-20261025`, criada a partir do checkout destacado.
`vercel.json` desabilita o deploy automático exclusivamente nessa branch, conforme
a [configuração Git da Vercel](https://vercel.com/docs/project-configuration/git-configuration).
EAS Update permanece limitado a `main`/`master`. Não criar PR ou integrar a branch
como parte desta autorização. A presença do commit remoto não certifica ambiente
hospedado nem libera produção.

Evidências de UI e API local relacionadas:

- [Conta e convite reais](entry-cycle-local-2026-10-25.md).
- [Atleta sem convite](entry-no-invite-local-2026-10-25.md).
- [Responsável sem convite](entry-guardian-local-2026-10-25.md).
- [Recuperação da aba](startup-resume-local-2026-10-25.md).

O smoke final reutiliza as contas fictícias e verifica portais, restrições e
retomada no frontend isolado de 8082. O frontend existente em 8081 é preservado.
Nenhuma fixture deve ser criada ou alterada em produção para esta revisão.

## Limites preservados

Não há certificação do ambiente hospedado, do template/entrega de e-mail de
produção ou de suspensão prolongada pelo sistema operacional. O Auth local
autoconfirma nativamente: o cenário de cadastro sem sessão vem dos testes de
tela, enquanto o bloqueio híbrido e o OTP foram exercitados no ambiente local.
Os registros da falha antiga de inicialização não estavam disponíveis; o
travamento por falha transitória de papel foi reproduzido e corrigido.
