# Contexto técnico do Go Atleta

Mapa seletivo do código inspecionado em **05/10/2026**, base `d5120cff`.
Serve para localizar responsabilidades e contratos antes de editar. Não é uma
especificação nova nem certificação do ambiente remoto. O
[índice documental](../README.md) continua sendo a entrada de todas as fontes;
o [checklist](../product/goatleta-checklist.html) acompanha entrega e pendências.

## Como consultar antes de editar

1. Confira `git status --short --branch`, diff staged/unstaged e arquivos novos.
   Preserve trabalho existente, inclusive o Python e HTML compartilhados do checklist.
2. Escolha **um módulo** na tabela. Leia outro somente se a mudança atravessar
   seu contrato (ex.: perfil financeiro → atletas + financeiro).
3. Abra a rota/caso de uso, persistência e teste indicados **do fluxo afetado**.
   Use `rg` para localizar símbolos e ler trechos; não concatene todas as fontes.
4. Consulte a fonte especializada/skill pertinente e classifique a validação pela
   [escada](../operations/validation-ladder.md). Contrato documental não substitui
   conferir a implementação atual, sobretudo se `HEAD` mudou.
5. Faça a alteração autorizada; atualize apenas os resumos e itens do checklist
   afetados. Registre decisão/evidência com data e limites, sem reescrever histórico.

Quando uma referência divergir, confronte código, testes e migration do fluxo;
registre a divergência. Política de autorização não pode ser relaxada só porque
o código permite uma ação. Proposta antiga não autoriza implementação automática.

## Módulos — escolha pela tarefa

| Se a tarefa envolve… | Leia primeiro | Fronteira principal |
| --- | --- | --- |
| Login, recuperação, onboarding, papel, unidade, coordenação, plataforma | [Acesso e organizações](modules/acesso-organizacoes.md) | `app/_layout`, `src/auth`, `access`, `providers`, `navigation` |
| Cadastro/perfil de atleta ou equipe, matrícula, família e convite | [Atletas e famílias](modules/atletas-familias.md) | `screens/students`, `profiles`, `student`, `family`, APIs de vínculo |
| Turma/equipe temporal, perfil pedagógico, plano diário/mensal e importação | [Turmas e planejamento](modules/turmas-planejamento.md) | `screens/classes`, `training`, `planning`, `core` e `db` |
| Ciclo, semana, progressão, estratégia e observação pedagógica | [Periodização](modules/periodizacao.md) | `screens/periodization`, `core/periodization`, `cycle-day-planning` |
| Aula realizada, relatório, chamada, NFC, QR e faltas | [Aulas e presença](modules/aulas-presenca.md) | `screens/session`, `attendance`, `src/nfc` e fila |
| Exercícios, biblioteca, quadra visual, diagramas e scouting | [Biblioteca e quadra](modules/biblioteca-quadra.md) | Catálogo, `core` visual, workspace tático e scouting |
| Academia, treino resistido, consultoria individual e percepção | [Treinamento e consultoria](modules/treinamento-consultoria.md) | Núcleo de treino/consultoria e superfícies do atleta |
| Conversa, geração, voz, modelo, memória e sugestões | [Assistente e IA](modules/assistente-ia.md) | `assistant`, `copilot`, Edge `assistant` e `_shared` |
| Drive, documentos, conhecimento acadêmico, fontes científicas e curadoria | [Documentos e acadêmico](modules/documentos-academico.md) | `db/document-context`, APIs documentais e Edges de ingestão/retrieval |
| Mensalidade, baixa manual, financeiro do perfil, Asaas e recebíveis | [Financeiro](modules/financeiro.md) | `src/finance`, `api/finance`, `core/payments` e Edges |
| WhatsApp, inbox, push, eventos e comunicações | [Comunicação](modules/comunicacao.md) | `notifications`, `push`, APIs/eventos e templates |
| Regulamentos, relatórios, exportações e home/agenda operacional | [Regulamentos e relatórios](modules/regulamentos-relatorios.md) | `regulation`, `screens/reports`, `home`, exportadores |
| Persistência, cache, offline, RLS, LGPD, identidade e privacidade | [Dados e segurança](modules/dados-seguranca.md) | `src/db`, `api/rest`, `security`, migrations e `_shared` |
| Tema, formulário, modal, dropdown, shell e responsividade | [Interface](modules/interface.md) | `src/ui`, `theme`, `components` e variantes de plataforma |
| Setup, testes, build, CI, observabilidade, checklist e continuidade | [Operação e validação](modules/operacao-validacao.md) | `scripts`, workflows, configuração e documentos operacionais |
| Skills, pacotes Engineer, candidatos, revisores e orçamento | [Engenharia assistida](modules/engenharia-assistida.md) | Ferramentas locais, sem ativação implícita do runtime remoto |

## Estrutura e contratos transversais

| Camada | Papel e limite |
| --- | --- |
| `app/` | Expo Router e composição de interação; há rotas que redirecionam/reutilizam telas |
| `src/screens/`, `components/`, `ui/` | Apresentação, hooks e casos de uso em `application` onde existentes |
| `src/core/` | Tipos/regras puras; preservar independência de React, navegador e Supabase |
| `src/api/`, `db/`, `services/`, `integrations/` | Acesso remoto/local, adaptação e orquestração dos fluxos existentes |
| `src/assistant/`, `copilot/`, `ai/` | Contexto e recomendações pelos contratos do produto |
| `supabase/functions/`, `migrations/` | Backend, autenticação, RLS/RPC e integrações privilegiadas |
| `scripts/`, `.github/`, `docs/` | Ferramentas, verificações e evidência; não são permissões de execução |

O [contrato arquitetural](../architecture-hygiene.md) é a fonte de fronteiras.
Essas camadas descrevem responsabilidades e direção de manutenção; não prometem
que toda rota tenha sido extraída nem autorizam reorganização em massa.
Supabase permanece a fonte de dados/autorização; sessão, organização e recurso
devem sobreviver a todo o fluxo. IA propõe, professor confirma, aula realizada
permanece evidência distinta. Interface respeita o [guia existente](../ui/README.md).

## Implementação, registro e proposta

| Tipo de fonte | Como usar |
| --- | --- |
| Código, testes e migrations referenciados nos módulos | Evidência da implementação local; testes listados não significam testes executados |
| Guias canônicos de arquitetura, UI, validação e autorização | Contratos de manutenção; conferir o trecho pertinente |
| [Handoff](../operations/handoff.md), [CHANGELOG](../../CHANGELOG.md), auditorias e relatórios datados | Evidência daquele checkout/ambiente; localizar seção por assunto/data |
| [ROADMAP](../../ROADMAP.md), documentos de proposta, mockups e backlog | Intenção que precisa de reconciliação com o código, mesmo com checkbox marcado |
| [Archive](../archive/) | Histórico preservado; não é a fonte inicial de procedimentos atuais |

Exemplos já separados nos módulos: fallback de perfil institucional legado,
modelo de IA implementado versus proposta de migração, quadra implementada versus
proposta original e preparação Engineer versus autorização de execução.
Existência de Edge/migration não demonstra implantação. Aceite passado pertence
ao escopo e à execução registrados, não a esta ou à próxima tarefa.

## Manutenção deste mapa

Cada resumo contém responsabilidades, arquivos de entrada, contratos, decisões,
fontes e validações pertinentes. Mantenha-o curto; detalhes continuam na fonte
especializada. Se mudar um contrato, atualize o módulo junto da implementação.
Se apenas conferir, registre a evidência sem declarar novo comportamento.
Não renomeie itens/IDs do checklist para ajustar redação deste mapa.

[Registro desta organização](revisao-2026-10-05.md): escopo, preservação, checagens
executadas e limites. Nenhum módulo certifica produção pelo simples fato de existir.
