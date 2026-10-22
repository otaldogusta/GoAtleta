# Criação de turmas por professores — diagnóstico de 22/10/2026

**Atualização:** a correção foi implementada localmente após esta inspeção.
Ver [contrato, validação e pendências de ativação](../operations/class-creation-permissions.md).
As seções abaixo preservam a evidência do diagnóstico inicial.

Inspeção do Go Atleta na base local `a17c2401` e consultas somente leitura ao
projeto Supabase configurado no repositório. Nenhuma permissão, dado, policy ou
migration remota foi alterada. Este registro é diagnóstico, não implementação.

## Resultado

Há desalinhamento entre o formulário oferecido ao professor e a autorização de
gravação. A permissão existente `classes` libera acesso à área, mas não existe
permissão específica para a coordenação/dono autorizar criação de turmas.

| Camada | Evidência atual |
| --- | --- |
| Permissões e convites | `src/api/members.ts` descreve `classes` como acesso a turmas/chamada/sessão. `default_member_permission` retorna verdadeiro para essa chave; o convite padrão inclui `classes` em `src/screens/coordination/application/invite-form.ts`. |
| Gestão institucional | `CoordinationPeopleWorkspace.tsx` permite editar permissões por membro da instituição. A lista não tem uma ação separada de criação de turma. |
| Interface | `app/classes/index.tsx` oferece “Criar turma” e aceita `tab=criar` sem gate específico. O modal de sincronização de alunos também oferece esse atalho. |
| Escrita local | `saveClass` em `src/db/classes.ts` envia `organization_id`, mas não `tenant_id`/`user_id`. A última policy local de INSERT de turmas, em `2026021203_update_rls_classes_by_staff.sql`, exige `is_org_admin(organization_id)`. |
| Banco conectado | RLS está habilitada. A única policy de INSERT encontrada foi `authenticated_fd920a729e_insert`: `is_org_admin(organization_id) OR (tenant_id = app_tenant_id() AND user_id = auth.uid())`. Não consulta a permissão `classes`. `tenant_id`/`user_id` não têm default e não foram encontrados triggers de usuário na tabela; `owner_id` tem default `auth.uid()`, que não satisfaz essa policy. |

Assim, o payload atual não satisfaz a alternativa legada de tenant/usuário para
um professor sem administração institucional. Não é necessário supor que a
coordenação concedeu uma permissão de criação: essa opção ainda não existe.
A policy adicional do banco conectado também evidencia divergência em relação
ao histórico local inspecionado; uma correção deve reconciliar ambas as fontes.

## Erros observados

Os logs consultados em 22/10/2026, na janela padrão das últimas 24 horas,
retornaram **19 ocorrências**, em 21/10/2026, de
`new row violates row-level security policy for table "classes"`.
Isso confirma rejeições reais de INSERT compatíveis com o relato, mas a consulta
agregada não identifica o professor nem associa todas as ocorrências à sua conta.
Não foram exportados cadastros, tokens ou corpos de requisições.

## Formulário e perda de preenchimento

Em `app/classes/index.tsx`, `saveNewClass` tem `try/finally`, sem `catch` para
converter erro de RLS/rede em `formError`. A rejeição escapa sem retorno local
adequado ao professor.

Depois de `await saveClass`, o fluxo chama `resetCreateForm()` antes de
`await loadClasses()`. Se a gravação concluir e a atualização da lista falhar,
os campos já terão sido limpos, apesar do erro posterior. A turma pode já existir
nesse cenário; repetir a gravação pode duplicá-la.

Uma falha do próprio INSERT, isoladamente, ocorre antes do reset no código
inspecionado. Portanto, **o descarte descrito pelo professor não foi reproduzido
nem sua causa exata comprovada**. Também existe uma tentativa de resolver/criar
unidade antes do INSERT, em `ensureUnit`, que é outro ponto possível de falha.

## Correção proposta, ainda pendente

1. Separar acesso às turmas de **criar turmas**, com criação negada por padrão
   para professores e liberação explícita pela coordenação/dono na instituição.
   A granularidade inicial sugerida é por professor, usando a gestão já existente.
2. Fazer o servidor aplicar essa permissão, preservando vínculo institucional e
   isolamento entre organizações. Reconciliar a policy legada ativa; somente
   adicionar checkbox, esconder botão ou enviar campos legados não resolve o contrato.
3. Usar o mesmo gate no botão, deep link, atalho da sincronização e submissão.
   Revisar duplicação de turmas, que também insere na tabela, e o acesso do
   professor à turma recém-criada sem conceder gestão de outros membros.
4. Tratar falhas de gravação mantendo o preenchimento e mensagem clara. Separar
   sucesso da gravação de falha ao atualizar a lista para evitar reenvio duplicado.
5. Validar professor sem liberação, professor liberado, coordenação/dono,
   ausência de sessão, outra organização e revogação. Exercitar erro de INSERT
   e erro de atualização posterior em backend isolado e localhost autenticado.

Uma implementação atravessa permissões, convites/RPCs, UI e RLS: nível 3 da
[escada de validação](../operations/validation-ladder.md). Mudanças remotas e
publicação dependem de autorização própria. Nesta rodada houve inspeção estática
e leitura de catálogo/logs remotos; não houve smoke com a conta do professor,
teste de escrita ou alteração funcional.
