# Continuidade de entrada — revisão local de 25/10/2026

Escopo autorizado: ajustes locais no cadastro, login, confirmação de e-mail,
convite de equipe e solicitação de vínculo. Nível 3 da escada de validação.
Sem commit, push, deploy, migration, criação de conta ou concessão real de acesso.

## Caminhos mantidos

| Entrada | Continuidade |
| --- | --- |
| Cadastro sem convite | Confirmação de e-mail, inclusive quando Auth ainda não retorna sessão; depois resolução do papel e área pessoal de atleta se não houver vínculo. |
| Código de equipe | Código preservado entre cadastro/login, confirmação de e-mail e claim autenticado; pré-validação pública não concede acesso. |
| Link completo de equipe | Aceite explícito, prova apenas em memória e conclusão de cadastro existente; senha de conta já concluída não é alterada. |
| `/staff-invite?code=` | Sem sessão, oferece cadastro ou login; não tenta resgatar o código institucional como código OAuth. |
| Convite familiar/atleta | Destinos e claims existentes preservados; retorno familiar após OTP continua pelo recibo ou pela rota de convite se houver falha. |
| Solicitação sem convite | Estado enviado, recusado ou aprovado permanece explícito. Aprovação ainda aguarda papel autorizado antes de entrar no portal. |

## Correções

- O layout é o responsável pelo redirecionamento após autenticar. Ele aguarda
  leitura dos convites antes do destino padrão e descarta conclusão assíncrona
  quando o efeito deixa de ser atual. `next` continua limitado a destino interno.
- Código de convite de equipe é distinguido de callback OAuth na inicialização
  e na troca de código. Links completos colados na tela pendente usam o mesmo
  parser de código do cadastro, rejeitando parâmetros conflitantes. Essa entrada
  autenticada não troca de identidade nem persiste prova de e-mail.
- Remover convite no cadastro limpa também o código persistido e o parâmetro da
  rota. Cancelar a conclusão por convite evita retorno automático ao mesmo setup.
- Cabeçalho pendente preserva erro/validação do convite com prioridade sobre
  solicitação antiga. Erro definitivo permite inserir outro convite; informação
  de erro não é repetida em um segundo card de “Convite encontrado”.
- Confirmação de e-mail usa cabeçalho e balão canônicos, botão desabilitado até
  seis dígitos, trava de requisição, limpeza ao digitar e reenvio com intervalo
  de 60 segundos no próprio controle. Com sessão, o destinatário é o e-mail
  autenticado; alterar sugestão sem sessão apaga o código anterior.
- Os seis campos OTP calculam a largura disponível, incluindo telas de 390 px.

## Validação e limites

123 testes passaram em nove suítes focadas de cadastro, conclusão de equipe,
OTP, armazenamento/retomada de convites, parser, callback OAuth, verificação
confiável e solicitação de vínculo. Incluem erro de convite e aprovação sem papel
autorizado, que não libera navegação. Auth, claims, solicitações e polling nesses
testes usam respostas simuladas; não comprovam ativação remota ou RLS hospedado.

Smoke no servidor local da porta 8081: entrada pública isolada por `127.0.0.1`
para preservar a sessão do usuário em `localhost`; convite por código → login →
cadastro, manutenção/remoção do código e resposta pública real de convite inválido
conferidos. OTP com cinco/seis dígitos conferido sem enviar código, cadastro ou
claim. Não foi enviado e-mail nem consumido convite real. A validação final do
cadastro com e-mail recebido e concessão hospedada continua pendente de ambiente
de teste controlado; não declarar esse ciclo real concluído por estes testes.

Conferência de OTP em largura CSS efetiva de 390 px: página sem overflow
horizontal, seis posições visíveis, balão flutuante sem corte e limpeza ao digitar.
Viewport restaurado após a conferência. A sessão existente em `localhost` retornou
de `/login` ao painel de coordenação, sem logout ou troca de instituição.

## Continuação: ciclo real no ambiente local

Após esta primeira etapa, o usuário autorizou conta e convite de teste. O ciclo
foi exercitado com Auth, Edge Functions, PostgREST e Mailpit reais do Supabase
local, sem publicação ou mutação de produção. Um convite familiar antigo revelou
desvio após OTP; nova seleção de convite agora substitui os demais tipos e as
gravações são serializadas. 125 testes focados passaram após essa correção.
O ciclo completo foi repetido com conta nova, OTP recebido, claim e primeiro
acesso até `/prof/home`. [Evidência detalhada e limites](entry-cycle-local-2026-10-25.md).
Isso supera a pendência de E2E **local** acima; não valida o ambiente hospedado.
