---
name: goatleta-institutional-workflows
description: Modela obrigações e prazos documentais configuráveis por organização e programa no GoAtleta. Usar ao implementar planejamento ou relatório mensal, regras de vencimento, cobertura de aulas e avisos institucionais sem hardcode de Rede Esperança ou outra instituição no motor.
---

# Modelar fluxos institucionais

## Entrada e saída

Receber contexto organizacional, período, configuração persistida e documentos encontrados. Produzir requisitos calculados, status de cumprimento e mensagens factuais para reconciliação ou interface.

## Procedimento

1. Modelar requisito com `organizationId`, `programId` opcional, tipo `monthly_plan` ou `monthly_report`, `required` e regra de prazo.
2. Suportar `day_of_month`, `last_day_of_month` e `days_before_period` com fuso explícito.
3. Tratar “planejamento dia 15” e “relatório no último dia” como configuração da organização, nunca lógica do motor.
4. Calcular prazo, atraso e cobertura de registros de forma determinística e testável.
5. Gerar mensagens que informem documento localizado, planejamento existente, necessidade de comparação e cobertura observada.
6. Encaminhar diferenças à reconciliação e telas à `goatleta-web-ui`.

## Proibições

- Não hardcodar nome, calendário ou prazo institucional.
- Não assumir que documento localizado está aprovado ou aplicado.
- Não cruzar configuração entre organizações.
- Não escrever no ciclo a partir de um aviso.

## Checklist

- [ ] Regras persistidas e versionáveis
- [ ] Fuso e virada do mês cobertos
- [ ] Exceções por organização/programa testadas
- [ ] Nenhum hardcode institucional no motor
- [ ] Mensagens não prometem aplicação

