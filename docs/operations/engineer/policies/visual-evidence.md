# Evidência visual e autoridade

Coordinator: leitura e orquestração; testes excepcionais, nunca duplicar suíte do Test Review. Implementation: único escritor em fase isolada com allowlist, testes durante desenvolvimento. Test Review: leitura e suíte final. Security Review: leitura e testes da superfície de segurança. UI/UX Motion Review: leitura, smoke visual e revisão de artefatos. Só o humano aprova integração pelo gateway.

Use localhost:8081 primeiro. Matriz de auditoria UI: 390×844, 768×1024 e 1440×900. Microajustes obedecem à escada existente; uma nova auditoria em três viewports não torna a matriz obrigatória em toda mudança. Uma tarefa visual só recebe PASS após revisão explícita de screenshots do candidato. Motion alterado exige vídeo por viewport (ou sequência de frames avaliada manualmente, ainda não suportada pelo validador v1) e captura com reduced motion. Native, haptic e performance em aparelho ficam fora do escopo web.

Artefatos privados em evidence/, com hashes SHA-256, manifesto/candidato vinculado, cenário reproduzível, console e snapshot ARIA. HAR/cookies/storage e credenciais não são exportados. Browser não acessa Supabase nem qualquer host externo; bloqueio de rede pode impedir uma tela autenticada, que permanece UNVERIFIED. Use fixtures locais aprovadas, nunca uma sessão de produção.

UI_UX_GATE e MOTION_GATE: NOT_APPLICABLE, PASS, PASS_WITH_FINDINGS, FAIL, UNVERIFIED. BLOCKER/HIGH bloqueiam; MEDIUM/LOW/INFO exigem revisão mas não bloqueiam automaticamente. Artefato presente não prova que foi avaliado: ui-review.json deve referenciar cada captura necessária, hash do manifesto e findings sustentados. A decisão é uma avaliação humana/especialista, não uma nota estética automática. O gateway inclui hashes do capture, review e artefatos no fingerprint e recusa mudanças depois da aprovação.

Snapshots não atestam fluidez nem conformidade WCAG integral. Não afrouxar gates em caso de runtime ausente. Pacotes vNext deste estágio são exclusivamente locais/read-only e create --live é bloqueado.
