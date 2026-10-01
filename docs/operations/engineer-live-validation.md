# Go Atleta Engineer — primeira validação real

Executada em 01/10/2026 com autorização explícita de cobrança, envio do pacote e criação das duas chaves. Resultado: conexão e revisão estática concluídas; ainda não é validação completa da suíte do produto.

## Evidências

- Run local: `fe144a6cd4394d11b5ef482d7d04f0bf`.
- Sessão: `sess_023a282e2086586b006abe66824b28819cb8744ba8eab93a74`.
- Turno raiz: `turn_023a282e2086586b006abe678a22a4819c9fe12b976ca04635`, estado `completed`, 65 segundos.
- Modelo: `gpt-6-astra`; 12 arquivos selecionados; limite de subagentes 0; nenhum subagente observado.
- Nove comandos registrados; quatro falharam. A imagem não fornece `rg`, Python ou Git. A resposta registrou corretamente que nenhum teste foi executado.
- Entrada: 128.890 tokens, dos quais 95.847 em cache; saída: 1.998; total informado: 130.888. São totais acumulados de chamadas no turno, não tamanho de um único prompt. Uso best-effort da API, não fatura final.
- Custo financeiro exato não determinado: os dados não incluem cobrança de escrita em cache, tier efetivo e demais ajustes. Não representar desconhecido como zero. [Tabela oficial consultada](https://developers.openai.com/api/docs/pricing).
- `attest`: PASS, zero arquivos alterados, excluídos, binários ou inesperados, após teardown confirmado.
- Container encerrado e removido. Sessão preservada para auditoria; nenhuma nova tarefa foi enfileirada.

Artefatos privados ignorados: `.tmp/engineer-runs/fe144a6cd4394d11b5ef482d7d04f0bf/history.json`, `agent-response.md`, `run-report.md`, `run-report.json`, `attestation.json` e marcadores arquivados de tentativas. Não publicar o pacote ou histórico bruto.

## Aceitação e limites

O agente explicou corretamente: máximo de seis skills por etapa, sem mínimo obrigatório; Core Go Atleta antes de trusted engineering e catálogo auxiliar; helpers sujeitos a revisão, hashes sem equivalência a auditoria e manutenção dos limites de autorização.

Ele declarou usar segurança e testes. O histórico de comandos não demonstra leitura explícita dos respectivos SKILL.md; não contabilizamos essa declaração como prova de abertura. A métrica `skills_opened` permanece desconhecida. As três skills selecionadas no pacote são arquitetura, segurança e testes.

A revisão identificou dependência de `max_primary` sem validação de intervalo, possível adiamento de segurança com inclusões explícitas e lacunas nos testes negativos. Esses são achados para triagem, não correções aplicadas ou falhas confirmadas em produção. O pacote não contém `skill-routing.json`, o lockfile ou os diretórios esperados pelo registry; o agente delimitou essa falta sem afirmar que o repositório completo está quebrado.

O gate de conexão passou. A fidelidade das três respostas de governança passou na revisão desta execução, com leitura de skills não comprovada. Execução de testes, especialistas, escrita mínima e sequência de 3–5 execuções aprovadas continuam pendentes. Não executar tarefas adicionais com cobrança automaticamente.

## Ajustes validados no provisionador

1. Aceitar o `remote_url` HTTPS retornado pela API no host `api.openai.com`, sem reescrevê-lo; o executor negocia a conexão WebSocket.
2. Instalar certificados CA na imagem. Nenhum bypass de TLS foi usado.
3. Fornecer home temporário existente e gravável para o usuário 1000, preservando `/workspace`, capabilities e perfis somente leitura.
4. Reutilizar a sessão após falha conhecida, com teardown e `--retry-after-teardown`, preservando marcadores antigos.

O plugin OpenAI Developers estava instalado; suas skills `agents` e `openai-api-troubleshooting` foram utilizadas no diagnóstico. O guia de sandbox do plugin confirma CA certificates e separação das chaves. O fluxo de novas credenciais do plugin deve ser preferido em futuras configurações; as chaves deste teste já estavam criadas e autorizadas e não foram duplicadas.

## Retomar com credenciais protegidas

```powershell
pwsh -NoProfile -File scripts/goatleta-engineer-local.ps1 doctor
pwsh -NoProfile -File scripts/goatleta-engineer-local.ps1 reconcile .tmp/engineer-runs/fe144a6cd4394d11b5ef482d7d04f0bf
```

O launcher lê somente os dois arquivos DPAPI de `%LOCALAPPDATA%/GoAtletaEngineer`, injeta as variáveis apenas durante o comando e restaura o ambiente depois. A chave de aplicação expira em 02/10/2026; a chave restrita de executor não tem expiração exibida. Nenhum segredo está em Git, no relatório ou em variáveis globais do Windows.

## Continuação

A limitação de runtime desta primeira execução foi resolvida nas runs 002–004. Ver [histórico real, preflight e escrita limitada](engineer-run-history.md). Os números acima permanecem como registro histórico da Run 001.
