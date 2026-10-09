# Acesso, organizações e administração

Leitura do código em 05/10/2026, base `d5120cff`. Este mapa descreve o checkout;
não confirma configuração, migrações aplicadas ou disponibilidade em produção.

## Responsabilidades e entradas

Autenticar a conta, confirmar identidade, resolver os papéis disponíveis e selecionar
a instituição de trabalho. Coordenação administra pessoas da própria instituição;
plataforma tem uma fronteira de acesso própria. Leia este módulo ao alterar login,
recuperação, `/pending`, provedores globais, permissões ou navegação por papel.

| Arquivo principal | Responsabilidade atual |
| --- | --- |
| [app/_layout.tsx](../../../app/_layout.tsx) | Bootstrap, composição dos provedores, interceptação de links e bloqueios de rota. |
| [auth.tsx](../../../src/auth/auth.tsx), [session.ts](../../../src/auth/session.ts) | Sessão, autenticação, atualização de identidade e obtenção do token. |
| [email-verification-state.ts](../../../src/auth/email-verification-state.ts) | Prova de e-mail confiável e restrições antes da confirmação. |
| [role.tsx](../../../src/auth/role.tsx), [role-resolution.ts](../../../src/auth/role-resolution.ts) | Papéis `trainer`, `student`, `family`, `pending`; preferência válida e reconciliação do atleta. |
| [OrganizationProvider.tsx](../../../src/providers/OrganizationProvider.tsx) | Instituição ativa, permissões do membro, limpeza de cache e proteção de identidade assíncrona. |
| [route-permissions.ts](../../../src/auth/route-permissions.ts) | Prefixos por papel e permissões funcionais de membros. |
| [platform-route-access.ts](../../../src/auth/platform-route-access.ts), [use-platform-admin-access.ts](../../../src/auth/use-platform-admin-access.ts) | Consulta de acesso à plataforma e bloqueio antes da renderização. |
| [pending.tsx](../../../app/pending.tsx), [organization-access-requests.ts](../../../src/api/organization-access-requests.ts) | Solicitações, convites e estados de acesso ainda não liberado. |
| [coordination.tsx](../../../app/coordination.tsx), [CoordinationPeopleWorkspace.tsx](../../../src/screens/coordination/CoordinationPeopleWorkspace.tsx) | Gestão institucional, equipe, convites e revisão de vínculos. |
| [PlatformDashboard.tsx](../../../src/screens/platform/PlatformDashboard.tsx), [platform-institutions.ts](../../../src/api/platform-institutions.ts) | Gestão de instituições e ciclo de vida na plataforma. |

## Contratos a preservar

- Sessão autenticada, e-mail verificado, vínculo institucional e acesso à plataforma
  são decisões distintas. Metadados editáveis `user_metadata` não comprovam identidade.
- `hasVerifiedEmailAccess` usa `app_metadata.email_verified_hybrid_at` ou provedores
  OAuth confiáveis. Sem essa prova, `RoleProvider` mantém papel pendente sem liberar dados.
- Um recibo de reconciliação de atleta não basta: `role.tsx` recarrega o cadastro sob
  RLS antes de liberar o papel. Respostas da sessão anterior são descartadas.
- Preferências locais escolhem entre papéis realmente disponíveis; não concedem
  autorização. Prévias de desenvolvimento não substituem os controles do servidor.
- Administração institucional usa associação da organização ativa (`role_level >= 50`);
  o acesso à plataforma é consultado separadamente. Não converter um no outro.
- Troca de usuário/instituição invalida dados e respostas antigas. Preservar as chaves
  de identidade e limpeza de caches antes de publicar o novo contexto.
- A matriz de rotas é proteção de interface; RLS/RPC/Edge continuam responsáveis por
  negar leitura e escrita indevidas. Alterar somente um redirecionamento é insuficiente.
- Links de recuperação/expiração são interceptados no bootstrap. O parâmetro `next`
  passa por [post-login-redirect.ts](../../../src/auth/post-login-redirect.ts), que aceita destinos internos seguros.

## Decisões atuais e limites

- A entrada `/staff-invite` mantém a prova do link apenas em memória acima do
  bootstrap para sobreviver à remontagem da tela após limpar a URL. Ao sair ou
  concluir, descarta a prova; aceite continua explícito e validado no servidor.
  [Correção e validação](../../operations/staff-invite-entry-fix.md).

- A conta sem vínculo pode solicitar acesso em `/pending`; não recebe criação livre
  de instituição. A RPC legada de provisionamento está restrita no contrato SQL.
- Atleta e familiar não são cargos da equipe; aprovação de acesso deve preservar
  essa separação. Detalhes em [atletas e famílias](atletas-familias.md).
- A carga da coordenação separa snapshot operacional obrigatório de indicadores
  opcionais; falha na leitura de membros não pode aparecer como organização vazia.
- Existência de telas/RPCs no repositório não comprova liberação comercial ou aplicação
  das migrations no ambiente conectado.

## Documentação existente e precedência

- [Pacote de acesso](../../audits/2026-09-09-access-package.md): decisões e inventário
  do pacote de setembro; estados de publicação e contagens de testes são históricos.
- [Solicitação de atleta](../../operations/athlete-access-requests.md): contrato do
  vínculo e evidência datada; consultar a implementação para o estado atual.
- [Fronteira da coordenação](../../audits/2026-09-05-coordination-data-boundary.md):
  explica a separação ainda presente no código; números e próximos recortes são históricos.

## Validação relevante

Nesta organização documental houve inspeção estática; não foram executados testes
do aplicativo, smoke autenticado ou verificações remotas.

- Para mudanças de acesso: [testes de auth](../../../src/auth/__tests__/) cobrem papéis,
  redirects, verificação, provisionamento, plataforma e reconciliação.
- Para contexto concorrente: [testes do provedor](../../../src/providers/__tests__/)
  e [useCoordinationDashboard.test.ts](../../../src/screens/coordination/hooks/__tests__/useCoordinationDashboard.test.ts).
- Aplicar o nível de dados/segurança da [escada de validação](../../operations/validation-ladder.md):
  testes focados, typecheck, org-scope e smoke autenticado do fluxo afetado.
