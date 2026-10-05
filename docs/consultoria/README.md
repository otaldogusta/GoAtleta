# Consultoria Online - Treino Individualizado

Este documento unifica e centraliza todo o histórico de polimentos, arquitetura, persistência no Supabase, regras de progresso, sistema de notificações e suporte a mídias do fluxo de consultoria esportiva individualizada do Go Atleta.

---

## 🎯 Visão Geral do Fluxo

O módulo de Consultoria cria uma camada mínima de treino online individual sem alterar os domínios de aula coletiva, periodização global, scouting ou outros módulos core do sistema.

O contrato mínimo validado em uso real segue o fluxo:
```txt
perfil -> treino -> execução -> PSE/dor -> feedback -> revisão
```

---

## 🗃️ 1. Persistência e Supabase

A persistência do fluxo de consultoria utiliza tabelas dedicadas no Supabase com um mecanismo híbrido de fallback local automático.

### Tabelas do Banco de Dados
- `consultation_profiles`: Perfil individual de treino da aluna (anamnese compacta).
- `prescribed_workouts`: Treinos prescritos pelo professor.
- `prescribed_exercises`: Exercícios que compõem a ficha de treino.
- `workout_execution_logs`: Execuções de treinos enviadas pelas alunas.
- `completed_exercise_logs`: Registro de exercícios concluídos em uma execução.

*Nota:* Os IDs das tabelas são strings (tipo `text`) para manter compatibilidade total com os IDs gerados localmente pelo app.

### Comportamento do Repositório (`src/db/consultation.ts`)
O repositório tenta salvar e carregar dados do Supabase no contexto capturado no
carregamento da tela. Desde a correção local de 05/10/2026, somente falhas de rede
ou schema ausente permitem fallback em `src/db/consultation-local.ts`.
Para atleta sem cargo organizacional, o contexto usa seu vínculo autenticado,
verificado no servidor antes da primeira abertura; não depende de criar membership.
Os resultados distinguem:
- `supabase`: Operação concluída no servidor.
- `missing_schema` ou `network`: Estado local, sem promessa de sincronização automática.
- `unavailable`: Contexto ainda não carregado; não significa dado salvo.

Ausência de usuário/organização, troca de identidade, falha de autenticação,
negação de permissão e erro desconhecido interrompem a operação. Não viram sucesso
local. A tela conserva o contexto do snapshot para as mutações e descarta respostas
atrasadas; troca de conta/organização reinicia o estado visual. Notificações do fluxo
são solicitadas somente após resultado `supabase` ainda válido.

Novos dados locais usam `goatleta_consultation_v2:<usuário>:<organização>` com
envelope de proprietário/versionamento e mutações serializadas por chave.
`goatleta_consultation_v1` permanece intacto e fora da leitura automática: o formato
antigo não permite provar autoria. Não atribuir esses registros ao primeiro usuário
que abrir a tela nem apagá-los como cache. Recuperação exige revisão explícita da
origem; esta correção não implementa importação ou envio automático do legado.
Detalhes e validação em [correções locais](../operations/consultation-and-rules-sync-local.md).
O [smoke autenticado local](../operations/consultation-authenticated-local-smoke-2026-10-05.md)
validou o fluxo com contas fictícias e RLS real em banco descartável; não preenche
o checklist de piloto real com alunas abaixo.

A interface exibe badges de sincronização discretos baseados nessa resposta:
- `Servidor sincronizado`
- `Salvo localmente`

---

## 📈 2. Histórico, Progresso e RPE

O sistema consolida as execuções enviadas em um sumário de evolução estruturado na classe `ConsultationProgressSummary`:
- **Adesão Mínima**: Calculada em porcentagem com base nos treinos prescritos vs executados.
- **PSE Médio**: Esforço percebido médio (Escala Borg adaptada).
- **Dor Média**: Média numérica de relatos de dor.
- **Attention Flags**:
  - `initial_history`: Menos de 3 execuções concluídas.
  - `high_pain_recent`: Dor aguda informada como $\ge 7$ nas últimas 3 execuções.
  - `high_rpe_recent`: Esforço percebido $\ge 8$ nas últimas 3 execuções.
  - `low_adherence`: Adesão abaixo de 60% (calculada após no mínimo 3 treinos publicados).

---

## 🔔 3. Notificações e Push

O fluxo de eventos gera mensagens na caixa de entrada interna (`notificationsInbox`) e prepara requisições de push remoto via Edge Function `send-push`.

| Evento | Gatilho | Destinatário | Título | Mensagem |
| --- | --- | --- | --- | --- |
| `consultation_workout_published` | Professor publica treino | Aluna | Treino publicado | Seu treino já está disponível. |
| `consultation_workout_completed` | Aluna conclui o treino | Professor | Treino concluído | `[Nome] concluiu o treino.` |
| `consultation_high_pain_reported` | Envio de feedback de dor alta | Professor | Atenção no treino | `[Nome] enviou um feedback que precisa de revisão.` |
| `consultation_execution_reviewed` | Professor revisa devolutiva | Aluna | Devolutiva revisada | O profissional revisou seu feedback de treino. |

*Segurança e Privacidade:* Notificações de dor alta e relatórios enviados por push evitam expor o valor exato da dor ou os comentários abertos das alunas nas notificações externas.

---

## 🎥 4. Apoio Visual e Mídias

Para guiar a execução dos exercícios à distância de forma assíncrona:
- Cada linha de prescrição suporta um link opcional em `PrescribedExercise.mediaUrl`.
- O link aceita vídeos de curta duração, GIFs ou imagens hospedadas remotamente.
- Quando o link existe, o app da aluna exibe o botão `Ver demonstração` que abre o recurso de forma segura externamente no navegador do sistema operacional.

---

## 📋 5. Checklist do Piloto Real

Antes de iniciar novas migrações e evoluções, execute o teste do piloto real com as alunas seguindo os passos de verificação:

### Preparação
- [ ] Selecionar uma aluna de teste real.
- [ ] Preencher o perfil de treino (objetivo, materiais, restrições e frequência).
- [ ] Prescrever e publicar pelo menos um treino.
- [ ] Validar acesso da aluna à aba `Treino online`.

### Experiência da Aluna
- [ ] Conseguiu visualizar o treino sem dúvidas?
- [ ] Conseguiu iniciar, pausar e concluir a atividade?
- [ ] Conseguiu relatar e classificar a PSE e o nível de dor?
- [ ] Enviou comentários construtivos de observação?

### Análise do Professor
- [ ] O perfil foi rápido e fluído de preencher?
- [ ] A visualização da PSE e da dor permitiu ajustar as próximas cargas?
- [ ] A marcação da devolução como revisada funcionou?
