# Design QA

## Convite de funcionário: credencial sem perfil duplicado — 2026-09-04

- A conclusão do convite pede somente o e-mail bloqueado, senha e confirmação. Nome e foto permanecem na etapa existente `Como quer ser chamado?`, exibida após o vínculo ser aplicado.
- A sessão temporária do destinatário é renovada em memória antes da conclusão quando estiver vencida ou próxima de vencer. A identidade renovada precisa ser a mesma do convite; a conta que já estava aberta no navegador não é publicada nem substituída antes do sucesso.
- A função `accept-staff-invite` grava apenas a senha nessa etapa. Ela não preenche `full_name` ou `name`; depois do aceite, o gate canônico de primeiro acesso continua sendo a fonte única para nome e foto.
- Validação local: 43 testes focados passaram, incluindo renovação, rejeição de troca de identidade, formulário sem nome, repetição após senha já salva, vínculo seguro e abertura do perfil inicial sem nome. Typecheck, org-scope, edge-jwt, perf-hygiene estrito, Deno check, diff check e build web passaram. `accept-staff-invite` v2 foi ativada no Supabase; o teste ponta a ponta com destinatário controlado permanece pendente.

## Coordenação: confirmação flutuante do convite — 2026-09-04

- O sucesso de envio por e-mail e de cópia do link usa o `useSaveToast` global no topo, com fechamento automático, sem ocupar espaço no rodapé do modal.
- Texto reduzido à ação concluída. Avisos de envio/cópia parcial e erros continuam na região da ação para permitir correção, conforme o padrão transacional do app.
- Smoke local no tema escuro confirmou o toast acima da tela e do modal, sem bloquear a interface, em 1360×914. O acionamento foi sintético e removido após a conferência; nenhum convite foi criado ou enviado. O componente global já preserva largura fluida para telas menores; tablet, celular e tema claro não foram revalidados nesta rodada.

## Cadastro canônico para concluir convite — 2026-09-04

- `/signup` e a conclusão do convite agora renderizam o mesmo `SignupScreen`; removido o formulário duplicado. A rota de convite permanece como controlador seguro, preservando os links existentes.
- Destinatário bloqueado, nome, senha, confirmação e indicador de força compartilhados. Conclusão não cria outra conta; contas existentes continuam sem redefinição de senha. Código de convite, Google e links de criação de conta ficam ocultos nesse modo.
- 44 testes focados passaram, incluindo cadastro comum, identidade do componente compartilhado, confirmação de conta, erro/repetição e validade dos convites. Typecheck, org-scope, perf-hygiene estrito, diff check e build web passaram.
- QA local com dados fictícios e fixture temporária sem autenticação/escrita: 390×844, 834×1194 e 1440×1024 sem overflow horizontal; e-mail bloqueado, erro único, campos preservados e erro limpo ao digitar. Fixture removida antes da publicação. Viewport restaurada e tab de teste fechada; sessão do usuário preservada.
- Tema escuro conferido; tema claro não revalidado. Aceite ponta a ponta com destinatário real permanece pendente. Nenhum convite consumido, e-mail enviado ou senha real alterada nos testes. Publicação autorizada inclui também a validade dos convites abaixo, sem mudanças de banco ou Edge Functions.

## Coordenação: validade dos convites — 2026-09-04

- Pessoas e responsabilidades passa a manter convites vencidos visíveis com `Expirado`, em vez de removê-los da lista; status e contagem usam o mesmo resolver das solicitações. Aceitos e cancelados continuam fora da lista de pessoas.
- A validade aparece na linha. O prazo exato (`expires_at <= now`) prevalece sobre falhas antigas de envio/vínculo; aceites e cancelamentos já concluídos são preservados. Um relógio agenda a próxima expiração e reavalia no retorno à tela, sem alterar o banco.
- Consulta somente leitura confirmou que o convite apontado pelo usuário vence em 18/09/2026 às 09h10 de Brasília. Ele não foi artificialmente marcado como expirado. Validade do convite e validade do link de autenticação são distintas; esta revisão não muda os prazos do Auth.
- Smoke autenticado no localhost: convite antigo vencido visível com `Expirado`, dois convites válidos contados como pendentes, busca e endereço longo conferidos. Viewports efetivos 390×844, 834×1194 e 1440×1024 sem overflow horizontal, no tema escuro; tema claro não revalidado. Tab temporária fechada e viewport restaurada, preservando o formulário aberto pelo usuário.
- 15 testes focados passaram, cobrindo prazo exato, precedência, contagem, visibilidade, atualização automática e limpeza do timer. Ajuste local, sem publicação nem mutação de convites.

## Preparação da publicação autorizada — 2026-09-04

- Pacote acumulado de permissões, alternância de perfil, foco dos campos e convite de funcionário reconciliado com origin/main (sem divergência). Capturas privadas excluídas do versionamento.
- 121 testes em 15 suites, typecheck:app, check:org-scope, check:edge-jwt, perf-hygiene estrito, Deno check e build web passaram. Migrações locais e remotas sincronizadas; nenhuma alteração de esquema ou segredo necessária.
- Smoke autenticado em localhost: tela de convite mantém a conta atual e exige confirmação. Em carregamento novo, a URL passou a /staff-invite sem fragmento, resolvendo a pendência de limpeza da URL da revisão anterior. Prova sintética não consumida.
- Entrega prevista: validação/aceite no Supabase, uma publicação Vercel pela main e ativação do envio do novo link somente com a tela disponível. Teste completo com destinatário real e QA visual do formulário após autenticação continuam pendentes; nenhum convite real enviado nesta validação.

## Convite de funcionário: identidade e primeiro acesso — 2026-09-04

- Implementação local: convite por e-mail usa prova de autenticação de uso único do destinatário; uma sessão já aberta exige confirmação e só é substituída após sucesso. O link copiável continua sendo apenas um convite, sem credencial de autenticação.
- Conta criada pelo envio recebe marcação em app_metadata no servidor. O primeiro acesso pede nome, senha e confirmação em bloco compacto de 440px. Contas existentes nunca são marcadas nem têm a senha redefinida por esse fluxo.
- Cadastro incompleto não concede vínculo de funcionário. A conclusão valida a identidade novamente, atualiza nome/senha com a sessão do próprio destinatário e aplica o aceite pelo RPC existente. Isso preserva a sessão de cadastro e permite retomar uma falha no aceite sem redefinição administrativa de senha.
- Convite compartilhado por WhatsApp preserva cadastro/login/verificação canônicos; contas com primeiro acesso pendente retomam o mesmo formulário. A tela pending não exibe mais acesso aprovado só porque a conta aberta já tinha outro papel.
- Validação: 55 testes focados cobrem troca explícita, conta existente, cadastro novo, campos inválidos, e-mail divergente, expiração, falha/repetição do aceite e link compartilhado. Typecheck do app, Deno check das duas funções novas/alteradas do fluxo de e-mail, org-scope, edge-jwt, perf-hygiene estrito e diff check passaram. Build web exportou a rota staff-invite.
- Smoke autenticado em localhost apenas da confirmação, com prova sintética não consumida: bloco central conferido em 1360px e medições sem overflow horizontal em 390×844 e 834×1194. A limpeza do fragmento também remove o parâmetro do roteador; coberta por teste, mas não confirmada pelo estado de URL retornado pelo navegador integrado.
- Pendentes antes de produção: QA visual do formulário após autenticação nos três viewports/temas, confirmação da limpeza da URL em navegador real e teste ponta a ponta com destinatário controlado (conta nova, existente e WhatsApp). Publicar web + create-trainer-invite + accept-staff-invite + claim-trainer-invite de forma coordenada; convites enviados anteriormente mantêm o link antigo. Sem publicação, envio real, aceite real ou alterações manuais de contas nesta rodada.

## Alternância de perfil por vínculo real — 2026-09-04

- Menu lateral exibe Alternar perfil somente com mais de uma opção autorizada. Prévia administrativa não conta como vínculo e a ausência de conta híbrida não inventa perfis de aluno/coordenação.
- Reutilizada a exceção de desenvolvimento já existente na tela de perfil; aplicada também ao menu, carregamento do papel, organização e perfil efetivo. Contas comuns ignoram prévias salvas e não conseguem gravar novas prévias.
- Smoke autenticado local: conta de professor redirecionada de Coordenação para /prof/home; menu contém somente Perfil e configurações e Sair. Conferidas larguras 390×844, 834×1194 e 1440×1024 sem overflow horizontal; viewport restaurada. Tema claro não revalidado, sem alteração de estilos.
- 43 testes passaram, incluindo prévias salvas indevidas, menu sem alternância e múltiplos vínculos reais. Typecheck, org-scope, perf-hygiene estrito e diff check passaram. Revisão de React manteve opções derivadas dos vínculos, sem novas consultas. Sem alteração de permissões no servidor e sem publicação.

## Coordenação: permissão real e erros de consulta — 2026-09-04

- A prévia administrativa de desenvolvimento não autoriza operações reais: o acesso exige também o vínculo original retornado pela organização, com nível de coordenação.
- Consultas administrativas recusadas deixam de virar listas vazias e indicadores zerados; a tela mostra o erro e permite tentar novamente. Forbidden recebe mensagem de permissão em português.
- Smoke autenticado em localhost:8081/coord/management: conta sem permissão de coordenação recebe o estado de acesso negado, sem formulário de convite. Nenhum convite enviado e nenhum vínculo alterado.
- Validação: 30 testes focados, typecheck:app, check:org-scope, perf-hygiene estrito e git diff --check passaram. Envio com conta autorizada não testado nesta revisão. Ajuste local, sem publicação.

## Campos de texto sem contorno de foco — 2026-09-04

- A revisão inicial trocou o verde por cinza, mas o usuário solicitou remover o contorno por completo. Inputs e textareas agora usam outline e box-shadow de foco desativados, inclusive nos modais; sem anel substituto.
- Por solicitação explícita, a exceção aplica-se ao contorno de foco dos campos de texto. Preservados foco funcional, cursor, bordas de validação, autofill e comportamento dos demais controles.
- Smoke local na busca de atletas: INPUT focado com outline-style none e box-shadow none, conferidos no estilo computado. Modal de convite não reaberto, pois a conta atual não tem autorização real.
- Ajuste local, sem publicação.

## Atletas: status de acesso e horário — 2026-09-03

- Turma em cima e dias/horário abaixo, na mesma coluna em todas as larguras, conforme referência atualizada do usuário; removida a coluna separada Horário.
- Ativo neutro quando o acesso não foi ativado; verde com vínculo do aluno ou acesso familiar aceito. Matrícula, financeiro e frequência continuam independentes.
- Motivo do badge em balão sobreposto, por hover, foco ou toque; sem subtexto permanente adicional.
- Validação automatizada: 24 testes focados, typecheck:app, check:org-scope, perf-hygiene estrito e diff check passaram.
- Primeira tentativa de QA interrompida por retorno ao login; sessão autenticada disponível nas revisões seguintes.
- Revisão do agrupamento turma/horário: conferida com sessão autenticada em 390×844, 834×1194 e 1440×1024, no tema escuro, sem overflow horizontal global. Tema claro não revalidado nesta revisão. Viewport original restaurada.
- Smoke de publicação: lista autenticada em 1360px, balão do badge abre ao clique, informa corretamente quando a ativação ainda não foi confirmada e fecha ao clicar fora sem abrir o perfil. Nenhum dado alterado ou convite enviado.

## Primeiro acesso: nome e foto

- Desktop `1209x812`: bloco central de `400px`, sem navegação ou conteúdo da Home ao fundo.
- Mobile `390x844`: conteúdo permanece centralizado, sem corte vertical ou rolagem desnecessária.
- Avatar: área inteira clicável; no hover, o avatar escurece e mostra a câmera no centro.
- Foto: ações de câmera e galeria usam o modal compacto com fechamento no cabeçalho.
- Nome: sugestão editável, campo obrigatório e botão desabilitado enquanto inválido ou salvando.
