# Encerramento das correções de código

Continuação da auditoria sobre `8f8810db`. Os relatórios anteriores preservam o diagnóstico e a primeira etapa; este documento registra a segunda etapa e os gates de publicação.

## Alterações adicionais

- Animações estáveis por instância e por chave, sem manipulação de refs na renderização. Cada aba segmentada possui sua própria animação, inclusive abas adicionadas dinamicamente.
- Formulários, fotos, acesso familiar e configurações financeiras acompanham a identidade do contexto. Atualizações do mesmo atleta preservam o formulário; mudança de organização encerra o estado anterior.
- Cargas iniciadas por efeitos podem ser canceladas antes da execução. Respostas antigas são descartadas nos fluxos familiares e financeiros. Sinais de regeneração da periodização são consumidos uma vez.
- Relógio, disponibilidade de desfazer e diagnóstico de renders têm responsabilidades separadas. As regras de hooks e pureza permanecem ativas.
- A consultoria do aluno mantém sua função de carga estável. Foram removidos a consulta de convites sem consumidor na lista de atletas, estados, imports, funções e callbacks mortos.
- Rascunhos associam operações à chave de usuário/organização. Conclusões antigas não alteram outro contexto; gravações e exclusão são serializadas por chave. A hidratação não sobrescreve uma edição já enfileirada.
- Recuperação de senha trata novos links após a montagem e descarta a resposta inicial atrasada. Links expirados prevalecem sobre uma sessão existente. Convites de equipe mantêm a prova em memória.
- O plano do aluno utiliza a resolução canônica por data civil. Telas com cargas reais recebem medição; redirecionamentos, superfícies estáticas e wrappers documentam a responsabilidade pela carga.
- Portais web usam uma fronteira única. Quatro imports condicionais de runtime têm justificativa local de plataforma; testes usam as APIs do Jest. Não foram desligadas regras globais para passar o gate.

## Prevenção de regressão

O baseline histórico de lint ficou vazio. O gate também bloqueia warnings. Tipos, testes completos, transações SQL isoladas, escopo organizacional, JWT, encoding, assets, arquitetura e performance fazem parte de `validate:app`. EAS depende do check do mesmo commit; Vercel executa `build:verified`.

As novas regressões cobrem relógio/cleanup, desfazer, cancelamento de efeitos, consumo de sinais, recuperação de senha concorrente, persistência/exclusão de rascunho e preservação do formulário familiar durante a chegada dos dados. O teste textual desse formulário foi substituído por renderização e interação com o componente, com rede e primitivas nativas simuladas.

## Evidências e publicação

Logs: `.codex-tmp/code-audit-fixes-2026-09-05/`.

- Lint completo sem cache: zero erros e zero warnings; baseline vazio. O orçamento de warnings também é zero.
- Tipos oficiais de React DOM adicionados; `@humanfs/node` atualizado para remover o alerta corrigível da ferramenta. O alerta por versão de `image-size` continua visível no audit; o patch existente e seu probe de arquivos malformados são mantidos. Não tratar audit por versão como prova de ausência ou presença do patch.
- Arquitetura strict: 911 módulos, 3.596 imports internos e zero violações.
- Build web concluído em `C:/Users/gusta/AppData/Local/Temp/goatleta-code-audit-phase2-20260905-web-build`, sem upload de sourcemaps.
- Smoke autenticado no localhost: navegação de coordenação, troca de abas financeiras, abertura/fechamento das configurações e formulário familiar. Convite permaneceu desabilitado sem dados; nenhuma chamada, convite ou cobrança foi enviada pelo smoke.
- Tipos do app passaram; Jest completo: 413 suítes e 2.342 testes passaram. Três suítes PostgreSQL isoladas passaram, incluindo 15 cenários de chamada e 18 financeiros.
- Performance strict global: 293 arquivos candidatos validados na execução final, com base `6011a364` e worktree. O check do pacote de release também passou.
- Patches reinstalados e probes concluídos; `npm audit --omit=dev` sem vulnerabilidades reportadas. Build mantém o aviso conhecido da importação interna de `ExpoFontLoader`.

### Backend publicado

Projeto `hgmdpetpwclucvquoklv`: quatro migrações aplicadas, sem pendências no dry-run posterior. A ordem financeira foi respeitada. As funções estão `ACTIVE`: `finance-provider-connection` v5, `asaas-webhook` v4, criação e claim de convite familiar v3, e `lgpd-process-dsr` v1.

Conferência remota: uma conexão identificada, nenhuma credencial sem namespace, dois recebimentos e quatro eventos legados preservados. As cinco RPCs verificadas existem. As RPCs internas de finanças/LGPD não concedem execução a `authenticated` ou `anon`; a de chamada mantém execução autenticada e as políticas RLS existentes. Não havia solicitações LGPD pendentes; o worker não foi invocado para excluir dados reais.

O localhost demorou a recompilar depois da atualização das dependências e perdeu temporariamente a conexão de automação. Após recuperar a sessão, o app concluiu o bootstrap e exibiu o aviso esperado de histórico financeiro sem conta confirmada. Isso não foi tratado como falha de aplicação das migrações.

Teste autenticado do conector concluído em 05/09/2026 às 20:21 UTC; sincronização finalizada às 20:22 UTC, sem `sync_error_code`. Foram importados dois recebimentos com namespace conhecido, mantendo os dois recebimentos e quatro eventos antigos. A conexão permanece em sandbox, ativa e com `charges_enabled=false`. O aviso de quarentena informa a preservação do histórico, sem solicitar sincronização indefinidamente. A entrega de um novo evento real pelo Asaas não foi provocada; a validação de replay/atomicidade ocorreu nos testes isolados.

O envio para `main` aciona a publicação web pelo Vercel e o workflow EAS; o estado desses pipelines deve ser distinguido da conclusão já verificada do backend.

A conferência remota anterior à migração encontrou uma conexão Asaas em sandbox, dois recebimentos e quatro eventos importados. Esses históricos são preservados sem atribuir uma origem não comprovada. A ordem obrigatória está em `docs/architecture/finance-provider-rollout.md`.

## Limites restantes

Alunos, perfil, coordenação e periodização ainda têm rotas grandes. O gate impede violações de dependência, mas não mede toda a complexidade. Novos casos de uso devem continuar saindo das telas quando tiverem entrada, resultado e comportamento próprios.

Pagamentos reais, emissão no provedor, estornos, reatribuição de acordos, progresso familiar e reconciliação completa entre Asaas e mensalidades locais são entregas de produto próprias. Esta correção não habilita movimentação de dinheiro. PGlite usa conexão serializada; não substitui teste de carga PostgreSQL com múltiplas conexões.
