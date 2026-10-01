> Registro histórico da seleção inicial, anterior à autorização de instalar todo o catálogo. O estado atual está no [relatório de instalação](skills-package-review.md).

# Pacote de skills selecionadas — Go Atleta

Revisão e instalação local em **01/10/2026**. A marca pública é **Go Atleta**, com espaço; nomes técnicos de pastas, símbolos e skills são preservados.

## Resultado

| Decisão | Entradas |
| --- | ---: |
| Instaladas | 4 |
| Cobertas pelas ferramentas/skills existentes | 23 |
| Pendentes de correção | 2 |
| Não instalar neste pacote | 20 |
| Fora da stack/plataforma atual | 61 |
| Reserva para necessidades futuras | 84 |
| Total inventariado | 194 |

O [inventário completo](skills-catalog-triage.md) explica cada decisão; a [versão JSON](skills-catalog-triage.json) registra a profundidade da leitura e as fontes. “Fora do escopo” ou “reserva” não significa que a skill seja ruim.

## O que foi instalado

As quatro skills estão no diretório pessoal de skills do Codex, com **109 arquivos**, incluindo regras, referências e metadados. Não foram adicionadas dependências ao aplicativo.

| Skill | Fonte | Acionamento no projeto |
| --- | --- | --- |
| `vercel-react-native-skills` | [Vercel Labs](https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278/skills/react-native-skills) | Implementação específica de listas, imagens e animações RN; ler apenas regras pertinentes |
| `react-native-best-practices` | [Callstack](https://github.com/callstackincubator/agent-skills/tree/61e6e7dfdf3a8ee862254c200d751fcb1fb863dc/skills/react-native-best-practices) | Diagnóstico medido de FPS, renderizações, memória, bundle e inicialização |
| `vercel-composition-patterns` | [Vercel Labs](https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278/skills/composition-patterns) | Refatoração de API de componentes e composição; não impor providers/componentes compostos a toda tela |
| `property-based-testing` | [Trail of Bits](https://github.com/trailofbits/skills/tree/82fe8226252622fa807643bdca1710901198553a/plugins/property-based-testing/skills/property-based-testing) | Propriedades de serializers, parsers, normalização, datas e invariantes; não substituir E2E ou RLS |

Callstack orienta **medir, otimizar e medir novamente**. Preferir essa entrada para diagnóstico; a Vercel complementa padrões de implementação. Não carregar ambas por padrão em qualquer TSX. Expo continua responsável por SDK, configuração, build e módulos do ecossistema.

## Adaptações rastreáveis

O [manifesto fixado](skills-package.lock.json) contém commits completos, hashes SHA-256 de cada arquivo original e instalado e todas as substituições aplicadas.

- **Composition Patterns:** corrigidas a regra React 19 e sua cópia compilada para não classificar `useContext()` como incorreto ou exigir migração indiscriminada de `forwardRef`. `useContext` permanece documentado; `use` é uma alternativa com capacidades adicionais. Fontes: [useContext](https://react.dev/reference/react/useContext), [use](https://react.dev/reference/react/use). Licença, autoria e arquivos restantes foram preservados.
- **Property-Based Testing:** removido somente o campo superior `effort: low`, não aceito pelo validador de skills desta instalação. Conteúdo e referências preservados.
- As duas skills de React Native foram mantidas byte a byte como no commit fixado. As ressalvas específicas do produto ficam em `AGENTS.md` e neste documento.

## Ressalvas de aplicação

- Virtualizar listas quando volume, custo ou medição justificarem. Não instalar FlashList/LegendList para toda lista pequena.
- Preservar `src/ui/Pressable.tsx`, teclado, foco, hover e semântica acessível. Exemplos com GestureDetector não autorizam trocar todas as ações por gestos.
- Não trocar navegação, gerenciador de estado, estilos ou biblioteca de imagens automaticamente. NativeWind, Galeria, Jotai/Zustand e ferramentas de profiling exigem necessidade concreta e compatibilidade.
- Referências a React Native CLI, Xcode ou comandos Bash precisam de adaptação ao Expo e à máquina Windows; não executar literalmente exemplos incompatíveis. Nenhum simulador, profiler ou pacote nativo foi instalado.
- Testes por propriedades só agregam quando existe uma propriedade relevante. A biblioteca fast-check não foi instalada; adicionar uma dependência continua sendo uma decisão da tarefa correspondente.
- Usar a escada canônica de validação e o design system local. Skills não autorizam push, deploy, gravação remota ou comunicação a terceiros.

## O que não entrou e por quê

| Candidato/grupo | Evidência e decisão |
| --- | --- |
| Brand Guidelines da Anthropic | A entrada original aplica explicitamente cores/fontes da Anthropic. Não é um gerenciador genérico da nossa marca |
| Using Superpowers | O gatilho em toda conversa e a obrigação de invocar skills com probabilidade mínima conflitam com a seleção contextual |
| TDD/Systematic Debugging/Verification do pacote Superpowers | Conceitos úteis, mas há obrigações universais, dependências cruzadas e instrução de apagar código anterior ao teste. O fluxo local já cobre investigação e evidência proporcional |
| Web Design Guidelines | As regras remotas mandam manter submit habilitado até a requisição, contrariando o contrato de autenticação do projeto. Acessibilidade e revisão web já têm cobertura local |
| GH Fix CI | Reprodução offline confirmou que o helper descarta JSON válido de checks quando `gh` retorna código 1. Não instalado nesta revisão |
| GH Address Comments | Reprodução offline confirmou resolução pelo repositório de origem do fork, em vez do destino do PR; leitura também mostrou limites de paginação. Não instalado nesta revisão |
| Sentry skill da OpenAI | Reservada: demanda CLI/login e a entrada consultada recomenda instalação Bash via script remoto. Não configurar conta ou coletar incidentes como efeito de instalar skills |
| Revisão genérica Sentry / Find Bugs / análises estáticas adicionais | Sobreposição com revisão React, skills locais e Codex Security; não adicionar checklists extensos a toda mudança |
| Expo, Supabase, Figma, documentos, planilhas, PDF, Playwright e Vercel | Preservar os provedores existentes; evitar duplicatas com o mesmo propósito |
| Azure/.NET, Terraform, outros bancos/hosts e iOS Simulator | Não correspondem à stack/ambiente atual; podem ser boas escolhas em outros projetos |
| Pacotes enormes de design, marketing, pesquisa e agentes autônomos | Reserva ou rejeição para este pacote por sobreposição, mudança de processo ou falta de necessidade concreta; não foram auditados integralmente |

Os problemas dos helpers GitHub foram reproduzidos com respostas fictícias e monkeypatch local, sem acesso a conta/PR ou postagem de comentários. Não houve correção desses terceiros nesta tarefa.

## Método e limites

O diretório [AgenticSkills](https://agenticskills.io/) serviu à descoberta. Foram coletadas 194 entradas únicas pelas páginas de categoria do sitemap. A rota `/browse` retornou 404; a descoberta continuou pelas categorias. Números de estrelas, instalações e selos não foram usados como prova de segurança.

Houve leitura dirigida do conteúdo upstream de **15 candidatos**, incluindo pontos conflitantes e helpers executáveis relevantes, e triagem por metadados dos demais. Foram baixadas sete candidatas em área temporária ignorada para inspeção; somente quatro foram instaladas no diretório ativo. Não foi uma auditoria exaustiva de segurança de 194 repositórios, nem execução de todos os exemplos dos 109 arquivos.

## Reproduzir em outra máquina

Após levar este pacote por Git, com Python e o instalador de skills do Codex disponíveis:

```powershell
python scripts/install-reviewed-skills.py --dry-run
python scripts/install-reviewed-skills.py
python scripts/install-reviewed-skills.py --check
```

O instalador usa o helper oficial do Codex com commits fixos, confere os hashes originais, aplica somente os patches registrados e verifica o resultado. Diretórios já existentes com conteúdo diferente são preservados e sinalizados; não há sobrescrita, atualização automática ou remoção. `--check` e `--dry-run` não acessam a rede. Respeita `CODEX_HOME` quando definido.

Para atualização futura, revisar um novo commit e regenerar o manifesto conscientemente. Rodar um atualizador genérico sobre essas skills pode perder adaptações; `--check` detecta a divergência. As novas skills devem ser descobertas no próximo turno do Codex.

## Validação

- Instalação de quatro skills e igualdade dos 109 arquivos com os hashes esperados.
- Instalador exercitado em cópia isolada: instalação íntegra aceita, divergência detectada com retorno de erro e alteração local preservada. Links locais e soma das 194 decisões conferidos.
- `quick_validate.py` aprovado para as quatro skills após as adaptações.
- `check-brand-name` aprovado; `git diff --check` aprovado.
- Reproduções offline dos dois helpers excluídos, sem chamadas externas.
- Nenhum teste do aplicativo ou profiling de dispositivo executado. Nenhum commit, push, deploy, migration ou alteração de credencial.
