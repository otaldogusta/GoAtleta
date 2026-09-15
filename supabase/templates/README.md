# E-mails de autenticação

Visual aprovado do e-mail alternativo: fundo externo branco, cabeçalho azul-marinho,
divisor verde e cartão compacto de 440 px. HTML com tabelas e estilos inline,
sem imagens externas ou rastreamento.

- confirmation, magic_link e reauthentication: código `{{ .Token }}`.
- recovery, email_change e invite: botão `{{ .ConfirmationURL }}`.
- E-mail alternativo: `functions/_shared/security-contact-email.ts` (8 dígitos,
  expiração própria de 10 minutos). Não alterar esse prazo nos fluxos do Auth.

Os templates do Auth não afirmam um prazo: a expiração depende da configuração
do projeto. Não mudar tokens, URLs, expiração, SMTP ou provedores ao publicar.

`supabase/config.toml` configura os arquivos para desenvolvimento local.
Isso NÃO atualiza os templates do projeto hospedado. Para publicação autorizada,
salvar uma cópia dos templates anteriores no painel do Supabase e substituir
somente assunto e corpo das seis categorias acima em Authentication > Email
Templates. Preservar quaisquer configurações de autenticação existentes.

Validar recebimento e uso de código no cadastro/reenvio e link na recuperação
antes de considerar a publicação concluída. Convites institucionais enviados
por funções próprias e notificações de segurança não estão neste pacote.

Referência: https://supabase.com/docs/guides/auth/auth-email-templates
