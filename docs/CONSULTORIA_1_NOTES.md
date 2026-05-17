# CONSULTORIA 1 - Fluxo minimo de treino online individual

## Decisao arquitetural

O pacote CONSULTORIA 1 cria uma camada minima de treino online individual sem alterar os dominios atuais de aula, periodizacao, scouting ou Supabase.

O app ja possui estruturas de planejamento e treinos para turmas, mas nao havia um contrato claro para:

- perfil de treino individual;
- treino prescrito por aluno;
- execucao remota do treino;
- feedback da aluna com PSE, dor e observacao;
- revisao simples pelo professor.

Por isso, este pacote cria o dominio puro em `src/core/consultation` e uma persistencia local/fallback em `src/db/consultation-local.ts`. A migracao Supabase fica propositalmente para CONSULTORIA 2, quando o contrato estiver validado em uso real.

## Fluxo entregue

### Professor

O professor acessa `Consultoria online` a partir de Treinos e pode:

- selecionar uma aluna;
- preencher o perfil de treino;
- informar objetivo, ambiente, materiais, restricoes e cuidados;
- prescrever um treino simples da semana;
- publicar o treino;
- acompanhar execucoes, PSE, dor e comentario;
- marcar a devolutiva como revisada.

### Aluna

A aluna acessa `Treino online` na area do aluno e pode:

- ver o treino publicado;
- entender objetivo, duracao e exercicios;
- iniciar o treino;
- concluir o treino;
- informar esforco percebido;
- informar dor;
- enviar observacao para o profissional.

## CONSULTORIA 1.1 - Piloto real

O polimento 1.1 organiza o MVP para uso com uma aluna real em fase piloto.

### Como usar no piloto

1. Abrir `Treinos` e acessar `Consultoria online`.
2. Selecionar a aluna.
3. Criar o perfil de treino com objetivo, ambiente, materiais, restricoes e cuidados.
4. Publicar o treino da semana.
5. Entrar na area da aluna e abrir `Treino online`.
6. Visualizar objetivo, duracao e exercicios.
7. Tocar em `Iniciar treino`.
8. Concluir o treino e enviar esforco percebido, dor e observacao.
9. O professor revisa o feedback e ajusta manualmente a proxima semana.

### Criterios para piloto

- A aluna consegue entender o treino sem explicacao externa.
- O professor consegue publicar o treino em menos de alguns minutos.
- O feedback volta com PSE, dor e observacao.
- Dor alta ou PSE alta aparece como sinal de atencao.
- O professor consegue marcar a devolutiva como revisada.

## CONSULTORIA 1.3 - Perfil compacto

O polimento 1.3 reorganiza o `Perfil de treino` como uma anamnese operacional compacta.

### Organizacao visual

O card passa a mostrar um resumo no topo com os principais dados selecionados:

`Objetivo · ambiente · materiais · frequencia · duracao`

Exemplo:

`Saude · Casa · Peso corporal · 3x/semana · 45min`

Os campos foram agrupados em quatro blocos:

- Objetivo e rotina: objetivo principal, dias por semana e duracao media.
- Ambiente e materiais: local de treino e materiais disponiveis.
- Cuidados: restricoes e lesoes informadas.
- Observacoes: observacoes gerais do professor.

O objetivo e reduzir a sensacao de formulario longo sem remover campos do piloto.

### Limitacoes conhecidas

- Os dados ficam no fallback local do dispositivo/browser.
- Ainda nao ha sincronizacao Supabase canonica.
- Nao ha notificacao de treino publicado ou feedback recebido.
- Nao ha midia de exercicio.
- Nao ha PDF ou relatorio formal.
- Nao ha historico visual de progresso.
- Permissoes robustas ficam para uma etapa posterior.

### Criterios para avancar para CONSULTORIA 2

- Pelo menos um ciclo semanal testado com uma aluna real.
- Contrato de perfil, treino, execucao e revisao validado.
- Campos obrigatorios e microcopy revisados com uso real.
- Decisao sobre RLS/permissoes antes de abrir uso multi-cliente.
- Migração Supabase desenhada com base no contrato validado.

## Regras de seguranca

A interface inclui orientacao curta:

> Interrompa o exercicio se sentir dor forte, tontura ou mal-estar e avise o profissional.

O pacote nao faz diagnostico, nao substitui avaliacao presencial e trata restricoes/lesoes como cuidados de treino.

## O que ficou para CONSULTORIA 2

- Persistencia Supabase canonica.
- Historico por event log e snapshots.
- Notificacoes de treino publicado e feedback recebido.
- Midias de exercicio com armazenamento externo.
- Devolutiva em PDF.
- Relatorio visual de evolucao.
- Ajuste semanal conectado a progresso real.
- Controle de permissao aluno/professor mais completo.

## Limites preservados

Este pacote nao altera:

- Scouting;
- ScoutingAction, ScoutingSession ou ScoutingImpact;
- Evidence Matrix;
- Team Context;
- Supabase migrations;
- geracao de plano;
- periodizacao;
- chamada;
- PDF/exportacao;
- regras de treino existentes para turmas.
