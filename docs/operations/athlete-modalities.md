# Modalidades do atleta

Implementação local de 13/09/2026. Migrações `athlete_modalities` e
`athlete_modality_column_access` aplicadas no Supabase conectado.

- `tuition_plans.modality` é opcional para preservar planos anteriores. Não há
  inferência pelo nome. Coordenação pode cadastrar ou atualizar a modalidade.
- Badges automáticos são a união das modalidades dos contratos ativos, já
  iniciados e não vencidos, ligados a `students.student_user_id = auth.uid()`.
  Desativar a comercialização de um plano não encerra contratos existentes.
- Badges pessoais são persistidos por conta em `athlete_modality_preferences`,
  com RLS de proprietário. Funcionam mesmo sem instituição. Retirar um badge
  pessoal não modifica contratos ou matrículas.
- Uma escolha pessoal sobreposta a um plano continua armazenada, embora apareça
  uma única vez. Ela permanece quando o contrato termina.
- As posições legadas continuam específicas de voleibol, com sua gravação
  existente. Posições para outras modalidades não foram inventadas.

## Limites atuais

O financeiro mantém o índice `tuition_agreements_active_student_unique`: um
contrato ativo por cadastro de atleta por instituição. A leitura agrega todos os
vínculos da conta, mas vários contratos simultâneos no mesmo cadastro exigem uma
evolução própria do fluxo financeiro. Não remover esse índice sem auditar os
consumidores e a cobrança. Nenhum valor financeiro foi alterado nesta entrega.

Planos anteriores precisam receber uma modalidade na coordenação para gerar
badges automáticos. O catálogo reutiliza Voleibol, Futsal, Futebol, Basquete e
Fitness. Expandir o catálogo exige atualizar também o CHECK do banco.

## Verificação

- Jest: regras de união/remoção, API financeira e proteção de rascunho.
- SQL transacional com rollback: `supabase/tests/athlete_modalities.sql`,
  `athlete_plan_modalities.sql` e `tuition_plan_modality.sql`.
- Typecheck, org-scope, perf-hygiene strict, diff-check e export web.
- Localhost: carregamento, pesquisa, seleção por setas/Tab e remoção de rascunho;
  conferência visual em 390, 834 e 1440 px. Não foram gravados esportes fictícios
  na conta aberta. A tela financeira foi validada por código/API/SQL, não por
  um smoke visual autenticado de coordenação.
