# Confirmação de e-mail alternativo

O perfil usa `security-contact-verification` para consultar, enviar, confirmar e
remover o contato. O endereço de login e o fluxo de recuperação de senha não são
alterados. Contatos antigos são preservados sem marca de verificação; metadados
editáveis pelo usuário não comprovam titularidade.

## Proteções

- Auth `getUser` no servidor, sem aceitar ID do usuário no payload.
- Remetente e Resend reutilizam a configuração existente; nenhuma nova credencial.
- Código criptograficamente aleatório de 8 dígitos, HMAC vinculado a usuário e
  endereço, 10 minutos de validade, 5 tentativas por código.
- 60 segundos entre envios, máximo de 5 solicitações por conta por hora.
- Desafio consumido na mesma transação da confirmação; falha no envio invalida-o.
- Tabela privada com RLS, acesso e RPC exclusivos de `service_role`.
- O contato anterior permanece enquanto o novo não for confirmado.
- Não há código fixo, log de OTP, troca de login ou confiança em `user_metadata`.

## Validação e publicação

Em 13/09/2026: migrations `20260913190519` e `20260913190750` aplicadas no projeto
`hgmdpetpwclucvquoklv`; função publicada com autenticação JWT habilitada.
Testes SQL em `supabase/tests/security_contact_verification.sql` usam rollback.
Testes do hook em `src/screens/student/__tests__/security-contact-verification.test.ts`.

O envio real foi aceito pelo provedor via perfil em localhost. O destinatário
confirmou o código e o perfil exibiu `E-mail confirmado`, encerrando o desafio
sem alterar o e-mail de login. Nenhum código foi lido ou registrado pelo agente.
O estado confirmado foi inspecionado em celular, tablet e desktop no tema claro.
Nove testes Jest, testes SQL com rollback, typecheck, org-scope, perf-hygiene,
edge-jwt, diff-check e build passaram. Os advisors não reportaram achados
relacionados à nova tabela ou RPC; avisos preexistentes permanecem fora do escopo.
O frontend continua local, sem deploy Vercel ou commit nesta tarefa.
