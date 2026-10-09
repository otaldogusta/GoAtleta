# Verificação de convite no cadastro

Frontend local de 09/10/2026. Edge publicada com autorização; nenhuma alteração de dados ou migration remota.

- `SignupInviteCode` permite verificar, corrigir ou remover o código. Códigos de
  links também aparecem no campo. Cadastro e Google aguardam a verificação quando
  há código; sem convite, o cadastro mantém o comportamento anterior.
- Colar um link com `inviteCode` extrai somente o código, sem navegar ao endereço
  ou confiar em papel/organização da URL. Parâmetro duplicado ou inválido é rejeitado.
- Campo compacto de uma linha, sem botão de verificação: consulta automática
  após 700 ms sem digitação, spinner durante consulta, check animado no sucesso
  e balão padrão no erro. Movimento reduzido respeitado; remoção cancela o debounce.
  Ícone para remover com rótulo acessível, sem título ou botão extra abaixo.
- Editar/remover o código invalida a confirmação e descarta respostas atrasadas.
  Falha de rede/serviço permite tentar novamente e não aparece como código inválido.
- O código é persistido antes de criar a sessão e segue para `/verify-email`.
  Consulta pública não substitui confirmação de e-mail nem aceite autenticado.
- `validate-trainer-invite` consulta o hash, sem consumir convite, criar sessão,
  aplicar vínculos ou devolver identidade, organização ou permissões. Ausente,
  revogado, expirado e esgotado retornam o mesmo erro público. O aceite existente
  continua revalidando disponibilidade, destinatário e autorização.
- A consulta informa disponibilidade no instante da resposta. Revogação posterior
  continua sendo negada pelo aceite; a pré-verificação não reserva o convite.

## Validação e ativação

Testes focados exercitam formulário, resposta atrasada, correção/remoção, cliente
HTTP e handler real da Edge com consulta simulada, incluindo casos negativos.
Não são prova de Auth/PostgREST hospedado ou aceite completo autenticado.

- 38 testes passaram nas cinco suítes de cadastro, parser de convite, força de
  senha, cliente HTTP e handler Edge. Typecheck, org-scope, perf-hygiene e build
  web passaram. Após ajustar CORS, os 9 testes do handler passaram novamente.
- Edge `validate-trainer-invite` publicada no projeto `hgmdpetpwclucvquoklv`,
  versão 2 ACTIVE, em 09/10/2026. Consulta anônima responde sem consumir convite.
- A origem exata `http://localhost:8089` é aceita apenas nesta função, além das
  origens compartilhadas existentes; sem mudança nos secrets ou CORS das demais.
- Configuração pública local conectada ao projeto em `.env.local` ignorado pelo Git.
- No navegador em `http://localhost:8089/signup`, a consulta real apresentou
  “Convite inválido, expirado ou já utilizado.” em balão sobreposto corretamente.
  Consulta administrativa somente leitura confirmou convite já utilizado (1/1),
  não expirado nem revogado. Nenhum cadastro ou aceite real foi enviado.
- Frontend não publicado. Sucesso com convite disponível está coberto em testes;
  smoke completo de cadastro/aceite com convite controlado permanece pendente.

## Entrada pelo link de equipe — 09/10/2026

A tela `/staff-invite` limpava o fragmento sensível da URL e mantinha a prova
somente no estado da própria tela. Uma remontagem pelos gates de sessão perdia
esse contexto. `StaffInviteEntryProvider`, acima do bootstrap, agora mantém a
prova apenas em memória durante a entrada; sair da rota ou concluir limpa a prova.
Não persiste token em storage nem aceita o convite automaticamente.

Quatro testes cobrem remontagem depois de limpar URL, conclusão, saída/retorno e
código sem prova. Outras 23 verificações do parser e contrato Edge passaram,
além de typecheck, org-scope, build web e perf-hygiene. Navegador local abriu a confirmação com dados
fictícios, sem enviar aceite. A causa exata do caso do usuário não foi reproduzida
com sua sessão; o link real não foi aberto nem consumido.

A correção foi isolada em `codex/staff-invite-entry-fix`, commit `c063dbb5`,
[PR #100](https://github.com/otaldogusta/GoAtleta/pull/100). `build:verified` passou
com 567 suítes / 3.178 testes e export web no checkout isolado. Preview disparado;
PR integrada em `main` no commit `9d10592d` após CI aprovado. Deploy de produção
`dpl_AmBMvsTGVjcDeyKqdfom12sNX7jW` aceito pela Vercel (QUEUED em 09/10/2026);
conclusão de produção ainda não confirmada. Os demais ajustes deste checkout seguem locais.

## Pacote completo de cadastro — 09/10/2026

A entrega da correção de entrada (#100) deixou os ajustes de senha e convite no
checkout original. Este pacote reúne esses ajustes, inclusive na conclusão de
cadastro pelo convite: barra uniforme, ajuda no `?`, sem checklist de composição
ou rótulos de força. O componente compartilhado mantém e-mail bloqueado e evita
criar outra conta no modo de conclusão.

`build:verified` aprovado no checkout de release: 571 suítes, 3.211 testes,
nove suítes SQL isoladas, lint, tipos, escopo, arquitetura e export web. Nenhuma
senha real foi alterada, nem convite consumido. Publicação deve ser confirmada
pelo commit/deploy desta entrega; os estados locais anteriores são históricos.
