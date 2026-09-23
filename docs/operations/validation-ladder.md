# Escada de validação do GoAtleta

Esta é a regra canônica para decidir quanto validar. O objetivo é manter o ciclo
`localhost:8081 -> ajustar -> conferir` rápido sem reduzir segurança antes de
publicar. Validação proporcional significa usar o menor nível que cubra o risco
real da alteração, não executar toda a esteira em toda mudança.

## 1. Microajuste local — ciclo rápido

Use quando a mudança é pequena, reversível e não altera dados, autorização,
navegação, contratos ou arquitetura. Exemplos: texto, ícone, cor, espaçamento,
estado visual e troca de um seletor por uma primitive já existente.

Meta operacional: concluir implementação e validação em aproximadamente 2–5
minutos quando o ambiente local já está saudável.

Obrigatório:

- inspecionar o diff apenas dos arquivos tocados;
- executar o teste focado existente, ou adicionar um teste pequeno quando houver
  lógica/regressão reproduzível;
- conferir diretamente o comportamento afetado no localhost quando a alteração
  for interativa; uma interação e um viewport representativo bastam;
- executar `git diff --check` somente sobre o fechamento da tarefa ou quando o
  formato do patch trouxer risco.

Não executar por padrão:

- `npm run build`;
- `npm run check:org-scope`;
- perf-hygiene completo;
- Jest amplo;
- matriz 390×844, 834×1194 e 1440×1024;
- smoke de rotas não afetadas;
- preview, commit, push ou deploy.

Se não existir teste focado e a mudança for puramente visual, a conferência local
direta pode ser a única validação além do diff. Respeitar sempre um pedido
explícito do usuário para não usar o navegador.

## 2. Alteração funcional localizada

Use quando muda estado, teclado/foco, validação de formulário, comportamento de
um componente compartilhado ou uma função de aplicação sem tocar persistência ou
limites de organização.

Obrigatório:

- testes focados do comportamento alterado;
- `npm run typecheck:app`;
- `git diff --check`;
- smoke local do fluxo afetado;
- viewport adicional somente se houver risco responsivo real.

Adicionar perf-hygiene apenas para tela/hook sensível a renderização. Não rodar
build nem a matriz completa por padrão.

## 3. Pacote, dados ou segurança

Use para múltiplos fluxos integrados, persistência, Supabase, autenticação,
permissões, RLS, organização, rotas ou mudanças arquiteturais.

Obrigatório conforme o escopo:

- testes focados e de integração relevantes;
- `npm run typecheck:app`;
- `npm run check:org-scope` para dados/navegação escopados;
- perf-hygiene para telas afetadas;
- `git diff --check`;
- smoke autenticado no localhost cobrindo o caminho feliz e o erro crítico;
- viewports/temas realmente afetados.

O build continua opcional enquanto o pacote estiver em iteração local, salvo se a
mudança afetar bundling, dependências, rotas estáticas ou configuração do Expo.

## 4. Publicação ou entrega fechada

Use quando o usuário autorizar commit/push, PR, publicação, migração ou deploy.

Antes de publicar, executar a baseline completa aplicável:

- testes focados;
- `npm run typecheck:app`;
- `npm run check:org-scope`;
- `git diff --check`;
- `npm run build`;
- smoke autenticado do fluxo afetado em `localhost:8081`;
- verificações adicionais de segurança, migração, performance e responsividade
  exigidas pelo pacote.

Publicar exige autorização explícita e continua separado de validar.

## Regras de escalada

- Não subir de nível por hábito. Subir somente quando o diff revelar risco do
  nível seguinte, um check obrigatório falhar ou o usuário pedir fechamento mais
  amplo.
- Se um microajuste ultrapassar cerca de cinco minutos por problema inesperado,
  informar o usuário antes de iniciar build, suíte ampla ou investigação lateral.
- Corrigir imediatamente um defeito adjacente apenas se ele foi causado pela
  mudança atual, impede validar o pedido ou é P0/P1 no mesmo fluxo. Caso contrário,
  registrar a pendência e manter o escopo.
- Não repetir checks que já passaram depois de uma alteração que não pode afetá-los.
  Repetir apenas o teste diretamente invalidado pelo novo patch.
- Relatar exatamente o que foi validado. Não apresentar build, HTTP 200 ou teste
  estático como prova de uma experiência que não foi exercitada.
