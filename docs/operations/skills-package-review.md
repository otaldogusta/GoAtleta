# Skills instaladas — Go Atleta

Instalação ampliada em 01/10/2026, conforme solicitação explícita de instalar todo o catálogo anteriormente triado.

## Resultado atual

- **194/194 entradas disponíveis; zero instalações pendentes.**
- **853 raízes de skills** após resolver coleções e eliminar cópias específicas de outros editores.
- **849 skills com versão e hashes fixados**, somando **12536 arquivos**. Inclui as quatro instaladas na seleção inicial.
- Quatro entradas já existentes foram preservadas: `imagegen`, `openai-docs`, `pdf` da OpenAI e `find-skills`.
- Instalação pessoal em `C:/Users/gusta/.codex/skills`; as dez skills locais do Go Atleta e os plugins existentes foram preservados.

A lista completa e o mapeamento de cada coleção estão no [inventário](skills-catalog-triage.md) e no [JSON](skills-catalog-triage.json). O [manifesto](skills-package.lock.json) registra repositório, caminho, commit completo, hashes e adaptações. O [relatório inicial](skills-package-initial-review.md) é histórico; suas exclusões e pendências de instalação foram superadas pela autorização posterior.

## Correções e compatibilidade

- `gh-fix-ci`: aceita JSON válido quando `gh pr checks` retorna 1 (checks com falha) ou 8 (pendentes), inclusive no fallback de campos; erros de autenticação/formato continuam sendo erros.
- `gh-address-comments`: identifica o repositório de destino pelo URL do PR, evita repetir conexões já paginadas e pagina comentários dentro das threads. Orientações de permissões respeitam o ambiente atual.
- Nomes conflitantes recebem prefixo de origem. Metadados incompatíveis com o validador do Codex são preservados em `metadata`; nomes e descrições são normalizados quando necessário. Os patches constam do manifesto.
- As adaptações anteriores de composição React 19 e testes por propriedades foram preservadas. `using-superpowers`, `using-agent-skills` e `loki-mode` têm acionamento explícito; a skill de marca da Anthropic fica restrita à marca Anthropic.

## Uso no Go Atleta

Selecionar apenas skills relevantes à tarefa. A disponibilidade de Azure, AWS, outros bancos, marketing, pesquisa ou workflows autônomos não muda a arquitetura do projeto. `AGENTS.md`, a marca **Go Atleta**, as primitives e a escada de validação continuam valendo.

Instalar skills disponibiliza instruções e recursos. Não instala automaticamente todas as CLIs/dependências citadas, não autentica serviços nem executa os scripts recebidos. Esses requisitos são específicos de uma futura tarefa que use a integração; não há download de skill pendente. Não houve commit, push, deploy ou alteração de dados remotos.

## Verificação e reprodução

```powershell
python scripts/install-reviewed-skills.py --check
python scripts/validate-installed-skills.py
python scripts/test-installed-skill-helpers.py
```

Para instalar em outra máquina, executar `python scripts/install-reviewed-skills.py` com Python e o helper de instalação do Codex disponíveis. O comando baixa pelos commits fixados usando o instalador oficial, confere arquivos originais, aplica somente patches registrados e verifica os hashes finais. Nunca sobrescreve divergências locais. A primeira instalação do catálogo completo pode demorar; repetição verifica o que já existe.

A validação cobre integridade dos arquivos, formato das entradas e oito regressões offline dos helpers GitHub. Não constitui auditoria exaustiva de segurança de todos os scripts nem prova de funcionamento de todas as integrações. A triagem inicial distinguiu leitura dirigida de análise por metadados; esse histórico foi preservado. As novas skills estarão disponíveis no próximo turno do Codex.

## Resultado das verificações

- Integridade: **849/849** skills e **12.536 arquivos** iguais ao manifesto; nenhum arquivo ausente ou divergente.
- Formato: **849/849** entradas aprovadas pelo validador do Codex.
- Cobertura: **194/194** entradas do catálogo com os respectivos arquivos `SKILL.md` presentes.
- Helpers GitHub: **8 testes offline aprovados** na instalação final.
- Marca pública e `git diff --check`: aprovados.
