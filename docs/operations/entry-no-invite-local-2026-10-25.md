# Entrada sem convite — evidência local de 25/10/2026

Teste real autorizado, sem publicação: frontend isolado em `localhost:8082`
e `127.0.0.1:8082`, Supabase local em `127.0.0.1:54321` e Mailpit local.
O frontend de 8081 conectado ao ambiente existente foi preservado.

## Ciclo exercitado

1. Cadastro pela interface, sem código ou link de convite.
2. Recebimento do OTP no Mailpit e confirmação pela interface.
3. Área pessoal sem vínculo institucional; busca da instituição fictícia.
4. Solicitação como atleta, informando o nome do cadastro existente.
5. Coordenação em sessão separada: solicitação pendente, conferência da sugestão
   pelo nome, seleção explícita do cadastro e aprovação.
6. Conta solicitante saiu da espera automaticamente, sem novo login após a
   aprovação. Início e perfil mostraram instituição e turma do atleta.

Instituição: `Instituição QA Sem Convite mvoepfmy`. Conta fictícia:
`no-invite-mvoepfmy@example.test`. O cadastro de atleta foi preparado sem e-mail
para impedir reconciliação automática antes da revisão institucional.
A coordenação foi preparada como fixture local; a conta solicitante foi criada
e confirmada pela interface. Nenhum convite foi criado para este ciclo.

O banco local confirmou `status=approved`, `request_kind=athlete` e
`reviewed_student_id=qa-no-invite-student-mvoepfmy`. `students.student_user_id`
passou de vazio ao usuário solicitante. A conta permaneceu com **zero** linhas
em `organization_members` e `trainers`: o vínculo não concedeu acesso de equipe.

## Correção observada

O logout mantinha um convite familiar antigo, retomado ao entrar com outra conta.
`signOut` agora limpa os três tipos de intenção pela fila serializada. A rota
explícita de convite legado repersiste seu token quando o usuário muda, preservando
a troca de conta dentro daquele convite. Teste de storage cobre chaves antigas
simultâneas; logout e novo login da coordenação foram repetidos no navegador.

## Prints e limites

15 capturas reais em `.tmp/no-invite-cycle/review/`, com `manifest.json` e galeria
local em `http://127.0.0.1:8084/`. Credenciais e chaves estão fora da pasta servida.
Capturas cobrem cadastro, e-mail, área sem vínculo, solicitação, revisão e acesso.

Validação final: 9 suítes focadas / 111 testes aprovados, `typecheck:app`,
`check:org-scope`, lint dos arquivos de código alterados nesta etapa e
`git diff --check` aprovados. Jest informou handles assíncronos ao finalizar,
mas encerrou com código zero. Recibo sanitizado do banco em `final-state.json`.

O Auth local usa autoconfirmação nativa, mas o bloqueio híbrido do produto exigiu
o OTP recebido para liberar a entrada. O Mailpit usa o template padrão local;
entrega e template hospedados não foram validados. Não houve commit, push,
deploy, migration remota ou alteração de produção.
