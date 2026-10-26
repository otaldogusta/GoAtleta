# Publicação do pacote de entrada e agenda — 26/10/2026

O usuário autorizou integrar na `main`, fazer push e deploy em produção nesta
data. O pacote inclui o commit de entrada `ebb6d78b` e os ajustes locais posteriores
de agenda, atalhos e menu. Não inclui mudanças remotas de banco ou de segredos.

## Escopo

- Cadastro, OTP, continuidade de convites, solicitação de vínculo e retomada de
  sessão: [revisão anterior](entry-package-review-local-2026-10-25.md).
- Agenda da coordenação com permissão `calendar`, sem mudar de contexto de papel.
- Professor e coordenação priorizam turmas, pessoas, planejamento e agenda no menu
  e nos atalhos. O perfil no menu compacto mantém apenas o avatar circular.
- Atleta reutiliza o calendário novo somente com a turma e organização do seu
  vínculo; não consulta dados gerais nem oferece aplicação de planos. O treino
  abre o plano do dia do atleta. Exportação ICS acompanha o mês visível e fica no
  menu de três pontos do cabeçalho.

## Evidência e publicação

Os fluxos afetados foram conferidos autenticados em `localhost:8081`, incluindo
agenda de coordenação e atleta, seleção de treino, abertura/retorno e menu de
exportação. Capturas privadas ficam em `.tmp/coord-shortcuts/` e
`.tmp/agenda-coord/`; não são versionadas. Os testes locais não substituem uma
validação de RLS ou de envio de e-mail no ambiente hospedado.

O gate obrigatório é `npm run build:verified`, com os recibos e logs reais em
`.tmp/validation/`. Somente após aprovação desse gate o pacote segue para commit
e push de `main`. O status remoto de CI e Vercel deve ser conferido pelo SHA
publicado; esta nota, preparada antes do gate, não declara o deploy concluído.
