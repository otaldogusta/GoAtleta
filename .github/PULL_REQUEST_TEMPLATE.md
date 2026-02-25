# Pull Request

## Summary
- 

## Type
- [ ] Feature
- [ ] Fix
- [ ] Refactor
- [ ] Infra / Build
- [ ] UI / UX

## Linked Issues / Context
- Closes #
- Related:

## Screenshots / Video (if UI changes)
- Before:
- After:

## Risks / Impact
- Areas impacted:
- Possible regressions:
- Notes:

## How to test
- Steps:
- Devices tested:

## Perf Hygiene (required when changing screens)
- [ ] `markRender("screen.<feature>.render.<target>")` adicionado/ajustado
- [ ] `measureAsync("screen.<feature>.load.<target>", ...)` no(s) load(s) principal(is)
- [ ] Derivações pesadas (`filter/map/sort/groupBy`) estão em `useMemo`
- [ ] Handlers que cruzam componentes/listas estão em `useCallback`
- [ ] Lista volumosa usa `FlatList` + `keyExtractor` estável + row memoizada
- [ ] Não adiciona `style={{...}}` inline em contexto de row/lista (`renderItem`/`.map(`)

## Rollback plan
- [ ] Revert PR
- [ ] Revert EAS Update to previous commit
- Notes:

---

## Definition of Done
- [ ] QA checklist executado (quando aplicável)
- [ ] Nenhum erro crítico no Sentry em dev
- [ ] Changelog atualizado (se release)

---

## Release / QA Checklist

Release:
- Version: v0.x.x (YYYY-MM-DD)
- Channel: main
- Commit: <hash>
- Build: <optional>
- Platform(s): Android / iOS / Web
- Tested by: <name>
- Release notes / Changelog: (optional link)

---

## 1) Boot / Config
- [ ] App inicia sem crash (Expo Go + build).
- [ ] `.env.local` existe e contém:
  - [ ] `EXPO_PUBLIC_SUPABASE_URL`
  - [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] No EAS, envs existem em **development** e **production** (Plain text).
- [ ] Logs não mostram `Missing env:` (requireEnv).
- [ ] Login tenta autenticar sem erro 404/500.

---

## 2) Auth / Login
- [ ] Login com email/senha válido funciona.
- [ ] Erro de login mostra mensagem clara (sem stack trace).
- [ ] “Esqueceu a senha” envia link e mostra contador.
- [ ] Botões ficam `loading` e impedem double submit.
- [ ] Voltar do login não quebra o fluxo / navegação.

---

## 3) Alunos
- [ ] Abrir cadastro → campos vazios corretamente.
- [ ] Criar aluno com unidade/idade/data/telefone (validação ok).
- [ ] Editar aluno → salvar alterações persiste e atualiza lista.
- [ ] Excluir aluno → confirmação + undo funciona.
- [ ] Modal fecha com toque fora (e “X” se existir).
- [ ] DatePicker abre e fecha sem travar / sem overlay errado.

---

## 4) Turmas
- [ ] Lista de turmas em ordem crescente por faixa etária.
- [ ] Editar turma (modal) abre correto.
- [ ] Salvar alterações funciona (persistência + feedback).
- [ ] Excluir turma mostra confirmação.
- [ ] Alterar turma selecionada reflete no calendário / aulas do dia.

---

## 5) Treinos
- [ ] “Criar plano de aula” abre formulário.
- [ ] Salvar plano cria registro e mostra aviso (toast/sucesso).
- [ ] Aplicar treino → modal abre, salvar, fecha e avisa sucesso.
- [ ] “Treino já aplicado” mostra alerta correto (warning).
- [ ] Aplicar treino errado (ex: sem turma selecionada) mostra erro claro.

---

## 6) Periodização
- [ ] Abas (Visão geral / Ciclo / Semana) alternam sem erro.
- [ ] Dropdowns meso/micro aparecem na frente (z-index ok).
- [ ] Guidance bubble aparece quando há alerta.
- [ ] Tooltip ACWR mostra explicação (sem cortar / sem overflow).
- [ ] Remover alertas (quando dados mudam) atualiza sem travar.

---

## 7) Calendário / Agenda
- [ ] Calendário semanal abre e fecha listas.
- [ ] Seleção de data é persistida corretamente.
- [ ] Aplicar treino pelo calendário abre modal correto.
- [ ] “Ver aula do dia” respeita turma selecionada.
- [ ] Trocar turma com calendário aberto não quebra UI.

---

## 8) Modals / Overlays
- [ ] ModalSheet abre/fecha com clique fora (Android + iOS).
- [ ] Confirmações/toasts não ficam atrás do modal.
- [ ] Dropdown dentro de modal não fica atrás do overlay.
- [ ] Animações suaves sem “pular” / sem flicker.

---

## 9) Performance (rápido)
- [ ] Scroll em listas grandes sem travar (Alunos, Treinos).
- [ ] Troca de abas sem freeze (Periodização).
- [ ] Abrir/fechar modais repetidamente não degrada performance.

---

## 10) Sentry (sanity check)
- [ ] Abrir app → evento “session start” (se estiver usando).
- [ ] Forçar um erro controlado em dev (opcional) e confirmar captura.
- [ ] Nenhum erro crítico aparece durante o smoke test.

---

## 11) EAS Update
- [ ] `eas update --channel main` finaliza sem warnings.
- [ ] App no celular recebe update após abrir (e reiniciar se necessário).
- [ ] Versão exibida no app (se houver) corresponde ao release.

---

## Smoke devices
- [ ] Web (Chrome)
- [ ] Android físico
- [ ] iOS (se disponível)

---

## Post-release (monitoramento)
- [ ] Monitorar Sentry por 30–60 minutos após release.
- [ ] Se houver crash-rate alto, reverter para commit anterior (rollback plan).
