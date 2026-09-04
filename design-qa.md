# Design QA — Planejamento unificado

## Fonte de verdade

- Mockup aprovado: `C:\Users\gusta\.codex\generated_images\019fe23d-25f6-7a70-bcd7-799bd2aa0d13\exec-eea9f356-20fe-45b2-a751-ddfe3e19fe7a.png`.
- Cópia estável da referência: `artifacts/design-audit/planning-workspace-2026-08-09/source-selected-mockup.png`.
- Implementação autenticada: `http://localhost:8081/prof/planning`.
- Evidência do workspace preenchido: `artifacts/design-audit/planning-workspace-2026-08-09/implementation-1707x960.png`.
- Evidência final do estado `Novo plano`: `artifacts/design-audit/planning-workspace-2026-08-09/new-plan-blank-final-1707x960.png`.

## Viewport, estado e normalização

- Referência: 1488 × 1054 px.
- Implementação: viewport CSS de 1707 × 960 px, tema escuro e perfil Professor.
- Estado principal comparado: Biblioteca expandida, plano recente selecionado, PDF em 100%, ajuste à largura, conteúdo salvo e bloco `Parte principal` selecionado.
- Estado adicional verificado: `Novo plano`, com apenas turma, data e horário contextuais; título, objetivos, situação-problema, tempos, atividades, descrições e observações vazios.
- A comparação foi feita pela hierarquia e proporção dos elementos porque a referência e a superfície real têm relações de aspecto diferentes. Não houve normalização de densidade necessária para essa avaliação de layout.

## Comparação e histórico

1. P2 inicial — a barra contextual repetia o bloco selecionado e consumia altura sem acrescentar uma decisão.
2. P2 inicial — o canvas limitava o documento a 210 mm, proporção de A4 retrato, apesar de o plano ser paisagem.
3. Correção inicial — a barra redundante foi removida, o documento passou a ocupar a área útil e a posição do editor foi estabilizada depois de carregamentos e interações no iframe.
4. Refinamento posterior — a prévia passou a respeitar as dimensões reais do A4 retrato, com 210 mm de largura e 297 mm de altura mínima, igualando a orientação já usada pelo arquivo exportado.
5. P1 de interação — `Novo plano` preenchia a folha com objetivos, pergunta pedagógica, atividades e tempos genéricos, contrariando a expectativa de começar do zero.
6. Correção — o rascunho ganhou modo explícito de campos vazios; o renderizador deixou de gerar conteúdo de fallback e a célula `Semana` passou a editar o título diretamente.
7. Pós-correção — a captura `new-plan-blank-final-1707x960.png` confirma a folha limpa, com toolbar visível, sem texto genérico e sem erro de console.
8. P1 de persistência — alterações feitas diretamente no documento podiam ser perdidas ao sair, sem restauração nem confirmação contextual.
9. Correção — o workspace passou a salvar um rascunho local por usuário e organização, aguardar a hidratação antes da seleção inicial e confirmar saída ou troca de plano quando houver alterações.
10. Pós-correção — o fluxo autenticado `digitar → Rascunho salvo → sair → voltar` restaurou o conteúdo editado e exibiu `Rascunho restaurado`; o rascunho só é descartado ao trocar de plano com confirmação ou após o salvamento definitivo.
11. Refinamento de conteúdo — linhas pedagógicas e blocos passaram a usar alturas mínimas compactas; texto curto não cria grandes vazios e conteúdo longo continua expandindo a linha naturalmente na prévia e no PDF exportado.

## Fidelidade visual

- Tipografia: títulos, ações, metadados e itens da Biblioteca preservam a hierarquia compacta do GoAtleta; o PDF mantém tipografia documental legível e independente do shell.
- Espaçamento: Biblioteca e editor formam um workspace contínuo, sem a antiga coluna duplicada de roteiro; toolbar e canvas permanecem visíveis sem overflow horizontal.
- Cores: superfícies azul-marinho, bordas discretas, verde de ação e seleção verde do bloco seguem os tokens já usados em Turmas e Gestão.
- Imagens e ícones: a marca vetorial e o registro de ícones existentes foram reutilizados; não há raster temporário nem placeholder na interface.
- Copy: rótulos são curtos e operacionais — `Biblioteca`, `Novo plano`, `Inserir atividade`, `Salvar`, `Aplicar à aula` e `Baixar PDF`.

## Interações verificadas

- Seleção de plano recente e de modelo pronto.
- Busca, recolhimento e expansão da Biblioteca.
- Zoom, ajuste à largura e seleção direta de blocos no PDF.
- Edição direta no documento, transição `salvo` → `alterado` e restauração por desfazer, sem gravar dados reais durante o teste.
- Salvamento automático local após edição, confirmação ao sair e restauração do rascunho em uma nova sessão da tela.
- Criação de uma folha limpa e edição direta do título na célula `Semana`; apagar atividades não recria placeholders automaticamente.
- Inclusão de atividade, salvamento, aplicação à aula e download permanecem ligados aos fluxos existentes.
- Nenhum erro de console foi observado na captura final; permaneceu apenas o aviso conhecido do React Native Web sobre `Animated` e `useNativeDriver`.

## Responsividade

- O contrato automatizado passou nos breakpoints exatos de 390, 834 e 1440 px.
- Em celular e tablet, a Biblioteca recolhe automaticamente; no celular, o rail compacto deixa apenas o controle de expansão e o editor recebe espaço lateral para não ficar coberto.
- A superfície fixa do navegador de validação não permitiu capturas pixel a pixel nos dois viewports menores. Isso permanece como lacuna P3 de evidência, não como defeito funcional identificado.

## Diferenças intencionais P3

- As ações permanecem na toolbar do editor, em vez de duplicadas no cabeçalho da página, para manter uma única área operacional.
- A toolbar flutuante de rich text do mockup não foi simulada: o modelo atual persiste conteúdo estruturado em texto, e um controle visual sem persistência seria enganoso.
- A Biblioteca usa `Recentes` e `Modelos prontos` alimentados pelo código real, em vez dos agrupamentos fictícios da referência.
- O mockup não especifica o estado vazio. A implementação mantém a mesma moldura visual e deixa o conteúdo pedagógico intencionalmente em branco nesse estado.

final result: passed

---

# Design QA — Motivo do alerta de frequência

## Evidências

- Fluxo autenticado validado em `http://localhost:8081/coord/students`.
- Capturas locais: `artifacts/design-qa/student-attendance-reason-tooltip-1360x914.jpg`, `artifacts/design-qa/student-attendance-reason-tooltip-mobile-390x844.jpg`, `artifacts/design-qa/student-attendance-reason-tooltip-tablet-834x1194.jpg` e `artifacts/design-qa/student-attendance-reason-tooltip-wide-1440x1024.jpg`.

## Resultado

- O badge de frequência com alerta exibe o motivo em um balão flutuante por clique, foco ou hover no web.
- O conteúdo permanece oculto no estado padrão e não adiciona subtexto permanente ao resumo operacional.
- O balão usa posicionamento absoluto e não altera a altura do modal nem desloca as seções seguintes.
- No layout empilhado de 390 × 844, o balão abre acima do badge; em 834 × 1194 e 1440 × 1024, abre abaixo.
- Leitura assistiva anuncia o estado e o motivo, com estado expandido exposto pelo gatilho.
- Nenhum erro foi observado no console durante o smoke visual.
- O comportamento do bloco Financeiro permaneceu inalterado, aguardando decisão de produto sobre o resumo contextual.

final result: passed

---

# Design QA — Simplificação dos estados do atleta

## Evidências

- Referência do problema: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-9abd906e-a3b4-4f95-b441-86c892edf8ee.png`.
- Estado principal revisado: `artifacts/design-qa/student-operational-strip-simplified-1360x914.jpg`.
- Dropdown revisado: `artifacts/design-qa/student-operational-strip-simplified-dropdown.jpg`.
- Responsividade: `artifacts/design-qa/student-operational-strip-simplified-mobile-390x844.jpg`, `student-operational-strip-simplified-tablet-834x1194.jpg` e `student-operational-strip-simplified-wide-1440x1024.jpg`.

## Comparação e resultado

- Cadastro, Financeiro e Frequência exibem somente título e estado atual, sem frases explicativas.
- O estado fica alinhado à direita do respectivo título; no mobile, os três itens permanecem empilhados e compactos.
- `Histórico` foi movido para o cabeçalho do modal, imediatamente antes do botão de fechar.
- O dropdown mostra somente `Ativo` e `Inativo`; a opção selecionada usa `primaryText` sobre `primaryBg`, eliminando o contraste insuficiente da referência.
- Os ícones redundantes dos três títulos foram removidos para preservar a leitura de `Financeiro` em larguras compactas.
- Comparação visual conjunta concluída sem diferenças P0, P1 ou P2 restantes.
- Nenhuma alteração de cadastro foi confirmada durante o smoke visual.

final result: passed

---

# Design QA — Faixa operacional do perfil do atleta

## Fonte de verdade e estado

- Referência autenticada da coordenação: `artifacts/design-qa/coordination-horizontal-reference-1360x914.jpg`.
- Implementação autenticada: `artifacts/design-qa/student-operational-strip-implementation-1360x914.jpg`.
- Comparação completa: `artifacts/design-qa/student-operational-strip-comparison-full.jpg`.
- Comparação focada: `artifacts/design-qa/student-operational-strip-comparison-focused.jpg`.
- Estado adicional do seletor: `artifacts/design-qa/student-operational-strip-dropdown-open.jpg`.
- Viewport solicitado: 1360 × 914 CSS px. As duas capturas principais foram normalizadas na mesma escala do navegador, 2125 × 1428 px renderizados.
- Estado comparado: coordenação carregada e modal `Editar aluno` de um atleta da organização, com o seletor de cadastro fechado na captura principal.

## Resultado visual e funcional

- Cadastro, Financeiro e Frequência formam uma única faixa horizontal no desktop e tablet, seguindo a organização visual do painel de Coordenação.
- No mobile, os três indicadores empilham verticalmente sem overflow horizontal.
- Cada indicador mostra somente o estado atual. As opções não selecionadas de cadastro aparecem apenas no dropdown ancorado do produto.
- O dropdown abre como sobreposição e não desloca os dados do aluno; contém somente `Ativo` e `Inativo` e preserva o fluxo existente de motivo para inativação.
- Financeiro continua derivado da mensalidade e abre a área financeira do atleta. Frequência continua derivada das faltas consecutivas e mantém o aviso contextual.
- `Histórico` permanece disponível na célula de cadastro.
- Responsividade conferida em 390 × 844, 834 × 1194 e 1440 × 1024 CSS px.
- A comparação focada não revelou diferenças P0, P1 ou P2. P3 intencional: os indicadores do atleta mantêm rótulo e detalhe operacional, portanto são mais densos do que os contadores numéricos da referência.

## Histórico da iteração

- Primeira comparação pós-implementação: sem diferenças P0, P1 ou P2; nenhum ciclo corretivo adicional necessário.
- Nenhuma mutação de cadastro, mensalidade ou presença foi executada durante o smoke visual.

final result: passed

---

# Design QA — Novo responsável e situação do aluno

## Fonte e estado comparados

- Fonte visual: comentários do Browser em `http://localhost:8081/coord/students`, nos estados `Adicionar outro responsável` e `Situação do aluno`.
- Implementação autenticada: mesma rota local, com o drawer de acessos familiares e o modal `Editar aluno` abertos separadamente.
- Viewports conferidos: 1360 × 914, 834 × 1194 e 390 × 844; a escala interna do navegador resultou em 1360, 1042 e 487 px de largura CSS.

## Correções verificadas

- P1 corrigido: `Adicionar` abria o formulário e um recarregamento do painel o fechava imediatamente. O estado agora é reiniciado somente quando o atleta ou o modo do painel muda.
- O formulário permaneceu visível após a conclusão da busca de acessos, com e-mail, relação, permissões e ação `Salvar e convidar`.
- P2 corrigido: a antiga caixa `Situação do aluno` misturava cadastro, ação destrutiva, histórico e financeiro sem hierarquia.
- A composição final usa três linhas operacionais: `Cadastro`, `Financeiro` e `Frequência`. Cada linha mostra somente o badge do estado atual; não há seletor manual de situação financeira.
- O badge financeiro é derivado das cobranças reais da organização para o atleta. O clique abriu `/coord/finance` em `Cobranças`, com o atleta preenchido na busca e filtrado por ID.
- O badge de frequência é derivado das chamadas. No caso autenticado verificado, quatro faltas consecutivas produziram o estado vermelho `Atenção` com o detalhe `4 faltas seguidas`.
- A inativação continua exigindo motivo e preserva histórico, avaliações e presenças; nenhuma alteração operacional foi submetida durante o smoke.
- O documento permaneceu sem overflow horizontal navegável nos três viewports. No mobile, as ações e badges permaneceram legíveis dentro da mesma lista compacta.
- Não restaram diferenças P0, P1 ou P2 nos dois estados revisados.

final result: passed

---

# Design QA - gestos, relatório, periodização e cadastros no mobile

**Fontes visuais do problema**

- Relatório encoberto pelo teclado:
  `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-e6c10f43-6bb5-4972-8721-635a27961bf6.png`
- Gerenciador de periodização invadindo a barra do sistema:
  `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-38d227fb-dcfc-46aa-a819-ac56280129a9.png`
- Cabeçalho quebrado e menu de recálculo superdimensionado:
  `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-e81e30b9-8242-41b9-94b5-489aa5c96394.png`

**Implementação capturada**

- Home e gesto horizontal: `artifacts/design-qa/mobile-polish-home-horizontal-gesture.png`
- Turmas com atualização global: `artifacts/design-qa/mobile-polish-classes-refresh.png`
- Relatório com teclado: `artifacts/design-qa/mobile-polish-report-keyboard.png`
- Periodização: `artifacts/design-qa/mobile-polish-periodization-galaxy-s25.png`
- Menu de recálculo: `artifacts/design-qa/mobile-polish-periodization-recalculate.png`
- Gerenciador do ciclo: `artifacts/design-qa/mobile-polish-periodization-manager.png`
- Lista de alunos: `artifacts/design-qa/mobile-polish-students-list.png`
- Detalhes e cadastro: `artifacts/design-qa/mobile-polish-student-detail.png` e
  `artifacts/design-qa/mobile-polish-student-create.png`
- Menu da turma: `artifacts/design-qa/mobile-polish-class-menu.png`

**Ambiente e normalização**

- Dispositivo: Galaxy S25, viewport físico `1080 x 2340 px`, tema escuro e
  development build conectado ao Metro por ADB reverse.
- As três capturas de origem e as nove capturas da implementação foram
  comparadas juntas. Diferenças de turma, data e conteúdo são dados reais da
  sessão e não alterações de layout.

**Comparção visual e funcional**

- Gestos: o carrossel da Home bloqueia o pull-to-refresh enquanto há gesto
  horizontal. O refresh continua disponível na Home e em Turmas, com o mesmo
  componente visual.
- Relatório: o campo focado acompanha a abertura do teclado; `Salvar` usa a ação
  primária verde e `Baixar PDF` usa a ação secundária, sem ambiguidade entre
  persistir e exportar.
- Periodização: o título permanece em uma linha e as ações ficam em uma faixa
  própria. O cabeçalho nativo não tem o recorte de sombra superior ou inferior.
- Modais: o gerenciador respeita as áreas seguras, tem margens consistentes e
  densidade menor. O menu de recálculo usa altura de conteúdo e largura ampliada
  para os rótulos do mês. O menu da turma é um bottom sheet alinhado ao rodapé,
  com margens laterais e rótulos legíveis.
- Planejamento: a troca de mês usa rolagem animada; o visualizador do plano
  completo compartilha a moldura compacta do plano da turma; o valor da carga
  foi recentralizado no gráfico circular.
- Alunos: a lista ganhou densidade consistente. Detalhes, edição e cadastro
  usam modal central seguro, hierarquia compacta e campos em duas colunas quando
  o espaço permite.

**Interações verificadas**

- Swipe horizontal entre turmas na Home sem spinner de atualização.
- Pull-to-refresh em Turmas com indicador visível.
- Foco e digitação no relatório mantendo o campo de conclusão acima do teclado.
- Abertura e fechamento do recálculo e do gerenciador de periodização.
- Lista, detalhes e novo cadastro de aluno.
- Abertura e rolagem do menu da turma.
- Exportação do PDF, recálculo e regeneração não foram executados para não
  alterar dados reais. A moldura compartilhada do plano e a área segura foram
  cobertas por teste focado.

**Validação técnica**

- `npm run typecheck:app`
- `npm run check:org-scope`
- `npm run build`
- Jest focado: 4 suítes e 29 testes aprovados.
- `git diff --check` sem erro de whitespace; apenas avisos CRLF preexistentes em
  arquivos fora deste pacote.

**Escopo adiado**

- O refinamento de quadra visual e análise de scouting permanece fora desta
  rodada, conforme priorização do usuário.

**Smoke físico final com o aparelho reconectado**

- `artifacts/design-qa/goatleta-smoke-home-swipe.png`: o carrossel mudou de
  `Estrelas do Saque` para `Águias` sem disparar o refresh.
- `artifacts/design-qa/goatleta-smoke-classes-refresh.png`: Turmas permaneceu
  responsiva ao gesto vertical de atualização.
- `artifacts/design-qa/goatleta-smoke-report-keyboard-connected.png`: o campo
  `Conclusão` permaneceu visível e focado acima do teclado.
- `artifacts/design-qa/goatleta-smoke-periodization.png` e
  `artifacts/design-qa/goatleta-smoke-periodization-recalculate-final.png`: o
  cabeçalho ficou em uma linha e o rótulo completo de setembro coube no menu.
- `artifacts/design-qa/goatleta-smoke-periodization-manager-final.png`: o modal
  respeitou as margens superior, lateral e inferior do Galaxy S25.
- `artifacts/design-qa/goatleta-smoke-class-menu-final.png` e
  `artifacts/design-qa/goatleta-smoke-class-menu-scroll.png`: bottom sheet
  alinhado ao rodapé, com rolagem e todos os destinos legíveis.
- `artifacts/design-qa/goatleta-smoke-students-final.png`,
  `artifacts/design-qa/goatleta-smoke-student-detail-final.png` e
  `artifacts/design-qa/goatleta-smoke-student-create-final.png`: lista, edição
  e cadastro permaneceram dentro da área segura e com hierarquia compacta.
- Nenhuma chamada, relatório, recálculo ou cadastro foi salvo durante o smoke.

final result: passed
---

# Chamada responsiva — 2026-08-22

## Referência e implementação

- Referência aprovada: `C:/Users/gusta/AppData/Local/Temp/codex-clipboard-5720d554-9c53-46d5-8d63-8d84145fa858.png`.
- Rota verificada: `/class/c_1775903848643/attendance`, com sessão autenticada e dados reais da turma.
- Desktop: cabeçalho compacto, data e ações na mesma faixa, lista densa e status segmentado.
- Mobile: título e turma no cabeçalho, data em faixa própria, contagem com relatório e salvar persistente após a lista.

## Correções aplicadas

1. Restaurados o botão de voltar e o título `Chamada` com o `BackTitleHeader` compartilhado pelas demais telas.
2. Removidos os cards altos e os metadados redundantes de unidade e faixa etária.
3. Adicionados avatar com iniciais/foto, status `Presente`/`Faltou` e chevron de detalhes por aluno.
4. Mantidos os detalhes operacionais existentes em expansão, sem perder contexto, observação ou alertas.
5. Corrigido o seletor de data para não colapsar no desktop.
6. Validado encaixe em 390 px: controles de status permanecem dentro do viewport e o botão de salvar ocupa a largura útil.

final result: passed

---

# Design QA — Perfil responsivo V3

## Fonte de verdade

- Mockup aprovado: `C:\Users\gusta\.codex\generated_images\01a020cf-f134-7351-82bf-f4f14a2da701\exec-a78c9689-926a-4b86-9a78-947e567815e4.png`.
- Implementação autenticada: `http://localhost:8081/prof/profile`.
- Comparação combinada: `artifacts/design-qa/profile-v3-2026-08-21/profile-v3-reference-vs-local.png`.
- Comparação focada da identidade: `artifacts/design-qa/profile-v3-2026-08-21/profile-v3-identity-comparison.png`.
- Capturas finais normalizadas: `profile-v3-desktop-1440x1024-normalized.png`, `profile-v3-tablet-834x1194-normalized.png` e `profile-v3-mobile-390x844-normalized.png`, na mesma pasta.

## Viewport, estado e normalização

- Referência: 1487 × 1058 px.
- Desktop solicitado: 1440 × 1024 px; a escala de sistema de 90% produziu viewport CSS de 1600 × 1138 e captura bruta de 1778 × 1263 px.
- Tablet solicitado: 834 × 1194 px; viewport CSS observado de 926 × 1326.
- Mobile solicitado: 390 × 844 px; viewport CSS observado de 433 × 938.
- O capturador local reservou um canvas duplicado vazio; as evidências `-normalized.png` recortam somente a região renderizada no canto superior esquerdo, sem redimensionar o conteúdo útil.
- Estado: tema escuro, perfil Professor, nome longo real, dois workspaces, Google e Google Drive conectados. Nenhuma informação de conta foi alterada durante o QA.

## Comparação e histórico

1. P2 inicial — a identidade ainda parecia um card compacto isolado e o nome longo ficava limitado a uma única linha no desktop, enquanto a V3 usa um trilho lateral contínuo e até duas linhas.
2. Correção — em split view, a identidade passou a ocupar a altura da região, perdeu a superfície de card e ganhou o divisor vertical; o nome aceita duas linhas no workspace e permanece em uma linha no mobile.
3. Pós-correção — as comparações `profile-v3-reference-vs-local.png` e `profile-v3-identity-comparison.png` confirmam a proporção 4/8, o lápis junto ao nome, o perfil/função na mesma faixa e o seletor compacto de workspace.

## Fidelidade visual

- Tipografia: preserva a família e os pesos do GoAtleta; nome, função, títulos de seção e metadados mantêm a hierarquia da V3. Nomes longos truncam sem deslocar ações.
- Espaçamento: desktop usa trilho 4/8 com divisor; tablet e mobile empilham as regiões. Gaps, raios e alvos interativos usam os tokens existentes.
- Cores: navy, superfícies graphite, bordas discretas e verde para seleção/estado seguem o tema real.
- Imagens e ícones: a implementação usa a foto real quando disponível e o ícone cadastrado como fallback; não foi inserida a pessoa fictícia do mockup. Google Drive e os ícones do registro existente foram preservados.
- Copy: `Preferências`, `Conta`, `Integrações`, `Workspace` e `Sair da conta` reproduzem a organização aprovada sem texto redundante.

## Interações e responsividade verificadas

- Perfil e workspace abrem seus seletores sem mutação de dados; as opções reais permaneceram disponíveis.
- 1440 × 1024: composição 4/8, divisor contínuo e duas linhas máximas para o nome.
- 834 × 1194: regiões empilhadas, sidebar compacta e ausência de overflow horizontal.
- 390 × 844: cabeçalho de identidade horizontal, nome em uma linha, navegação inferior preservada e ausência de overflow horizontal.
- Uma aba limpa confirmou zero erros de console após o carregamento final.

## Diferenças intencionais P3

- O usuário atual não possui foto carregada; o avatar usa o fallback funcional do produto, enquanto o mockup usa uma pessoa demonstrativa.
- Preferências e integrações mantêm as superfícies compactas do componente real `SettingsRow`, em vez das linhas totalmente planas da imagem, para preservar consistência com as outras configurações do GoAtleta.
- A sidebar e o cabeçalho usam os componentes atuais do app; não foram redesenhados fora do escopo da tela de perfil.

final result: passed

---

# Design QA — Equipe da turma na coluna Professor

## Fonte de verdade

- Mockup aprovado: `C:\Users\gusta\.codex\generated_images\01a020cf-f134-7351-82bf-f4f14a2da701\exec-03baafc5-2b42-426f-b3b3-fae40dec2af5.png`.
- Implementação autenticada: `http://localhost:8081/coord/classes`.
- Comparação combinada: `C:\Users\gusta\.codex\visualizations\2026\08\20\01a020cf-f134-7351-82bf-f4f14a2da701\class-team-comparison.png`.
- Capturas finais: `class-team-final-desktop.png` e `class-team-mobile.png`, na mesma pasta da comparação.

## Comparação e correções

1. A coluna preserva o professor principal e usa o nome compacto quando há nome completo, como `Gustavo R.`; nomes compostos curtos, como `Ana Júlia`, permanecem inteiros.
2. Auxiliares e estagiários aparecem em um pill sem o texto redundante `Equipe`, com até dois avatares e contador `+N`.
3. Hover, foco ou toque abrem o popover com nome completo e função; o conteúdo foi refinado para uma linha compacta por pessoa.
4. Fotos usam shimmer durante o carregamento e caem para iniciais apenas quando não existe foto ou a imagem falha.
5. O pill foi aproximado do nome do professor, preservando a leitura conjunta da equipe e o menu de ações no fim da linha.

## Responsividade e estado real

- Breakpoints conferidos em 390 × 844, 834 × 1194 e 1440 × 1024; não houve overflow horizontal e o pill permaneceu disponível em cards e tabela.
- A organização autenticada já possui turmas com um e dois estagiários, permitindo verificar o estado real e o popover sem criar dados de teste.
- Diferença intencional P3: a referência usa pessoas e fotos demonstrativas; a implementação mostra as identidades reais disponíveis. Logins permanecem visíveis quando o cadastro Auth não possui nome completo.
- A resolução organizacional de fotos depende da migration local `20260821022829_list_org_class_staff_identities.sql`; sem aplicá-la, o fallback seguro mantém nomes e iniciais.
- Nenhum erro novo apareceu no console; permaneceram apenas os avisos conhecidos do React Native Web sobre `pointerEvents` e propriedades antigas de sombra.

final result: passed

---

# Design QA — Biblioteca hierárquica e cabeçalho do planejamento

## Fonte de verdade

- Mockup aprovado: `C:\Users\gusta\.codex\generated_images\019fe23d-25f6-7a70-bcd7-799bd2aa0d13\exec-649e0e80-9178-4282-8d82-3c612e62b9e4.png`.
- Implementação autenticada: `http://localhost:8081/training?ui=planning-library-hierarchy-v3` (mesma tela servida por `/prof/planning` no perfil Professor).
- Evidência final: `artifacts/design-audit/planning-library-hierarchy-2026-08-11/implementation-1440x1024.png`.
- Viewports verificados pelo controle responsivo do Browser: 1440 × 1024, 834 × 1194 e 390 × 844. O navegador aplicou o fator de escala do sistema; as dimensões internas observadas foram 1600 × 1138, 926 × 1326 e 433 × 938.
- Capturas foram inspecionadas lado a lado com o mockup durante a implementação; a evidência ficou no histórico visual desta tarefa.

## Comparação e correções

1. O cabeçalho foi reduzido a `Planejamento` e às ações globais: estado do autosave, download, adicionar à turma, novo plano e importar PDF.
2. `Novo plano` e `Importar PDF` deixaram de aparecer na Biblioteca; `Inserir atividade` e a segunda toolbar foram removidos do workspace.
3. Somente desfazer, zoom, contador de páginas e ajustar largura permanecem flutuando sobre a margem do documento.
4. A Biblioteca ganhou navegação por `Por turma` e `Rascunhos`, busca unificada, hierarquia Unidade → Turma → Mês → Semana e modelos recolhíveis.
5. A lista interna mantém scroll independente e não prende o restante do workspace.
6. O estado sem planos foi protegido contra data indefinida; `Novo plano` abre uma folha A4 limpa.
7. O A4 usa zoom inicial responsivo e centralização calculada dentro do iframe; o documento não cria overflow horizontal no viewport móvel.
8. O status do cabeçalho acompanha o autosave real do rascunho: `Salvando`, `Salvo` ou falha.

## Fidelidade e responsividade

- Desktop: hierarquia, densidade, contraste e distribuição de ações correspondem ao mockup aprovado, usando tokens e componentes reais do GoAtleta.
- Tablet: Biblioteca recolhida, A4 redimensionado e controles acessíveis sem duplicar a toolbar.
- Mobile: cabeçalho quebra as ações em ícones compactos, rail da Biblioteca permanece recolhido e o documento cabe no iframe sem scroll horizontal da página.
- Diferença intencional P3: o mockup usa dados demonstrativos de Rede Esperança/Primeiros Saques; a implementação mostra somente unidades, turmas, meses e semanas existentes no estado real do usuário.
- Avisos antigos do console foram desconsiderados na leitura final; após a correção do estado vazio, nenhuma nova exceção foi produzida pelo bundle atual.

final result: passed

---

# Design QA — Detalhe compacto da periodização

## Fonte de verdade

- Mockup aprovado: `C:\Users\gusta\.codex\generated_images\01a01208-2d18-7d71-b80e-54e1e07de316\exec-eb7d33f9-b1c3-47f6-9099-da3d8cf70377.png`.
- Implementação autenticada: `http://localhost:8081/class/c_1784679714555/periodization?classId=c_1784679714555&month=2027-01&unit=Rede%20Esportes%20Pinhais&backTo=%2Fclass%2Fc_1784679714555`.
- Comparação combinada: `artifacts/design-qa/periodization-reference-vs-localhost.png`.
- Captura final: `artifacts/design-qa/periodization-final-1209x812.png`.
- Estados de interação: `artifacts/design-qa/periodization-hover-tooltip-1209x812.png` e `artifacts/design-qa/periodization-curve-scrolled-1209x812.png`.

## Viewport e normalização

- Viewport CSS validado: 1209 × 812 px, tema escuro e sessão autenticada.
- O navegador local estava com escala de sistema de 90%, por isso a captura física resultou em 1342 × 902 px.
- A comparação combinada normaliza referência e implementação para a mesma largura de painel; hierarquia, alinhamento e densidade foram comparados no mesmo estado preenchido.

## Comparação e correções

1. A coluna de detalhe foi reduzida a horário, duração, título, vínculo semanal, gráficos, resumo e ação principal.
2. Os blocos duplicados de contexto e de antes/agora/depois foram removidos.
3. `Carga da aula` e `Curva do ciclo` ficaram lado a lado, preservando a leitura científica da onda anual.
4. A legenda fixa do donut foi removida; cada arco exibe rótulo, minutos e percentual em tooltip flutuante no hover.
5. A curva mantém largura útil de 520 px dentro de um scroll horizontal, sem comprimir as 52 semanas.
6. `Recalcular mês` foi alinhado à borda interna da tabela e `Regerar ciclo` foi adicionado ao cabeçalho, reaproveitando o fluxo real de confirmação e preservação de aulas concluídas ou personalizadas.
7. O título e a legenda redundantes acima do trilho anual foram removidos no desktop compacto, aproximando a densidade do mockup aprovado.
8. Os handlers inválidos do SVG foram substituídos por cálculo de hover no contêiner web; nenhuma nova exceção de console foi gerada após a correção.

## Interações verificadas

- `Regerar ciclo` e `Parâmetros do ciclo` presentes e habilitados no cabeçalho; a ação destrutiva de regeneração não foi confirmada durante o QA.
- Hover sobre o arco azul exibiu `Aquecimento · 10 min · 17%` sobre a área dos gráficos.
- Scroll horizontal da curva moveu o recorte das semanas iniciais para as semanas finais e reposicionou o indicador da barra.
- Seleção de aula, destaque da linha e `Abrir plano completo` permaneceram funcionais.
- Permaneceram apenas avisos conhecidos do React Native Web sobre `pointerEvents` e `Animated/useNativeDriver`; não houve novo erro após o reload final.

## Diferenças intencionais P3

- A implementação usa a carga real do ciclo e a aula mensal selecionada, enquanto o mockup contém valores demonstrativos e seleciona a primeira aula.
- A curva real oscila por semana e por política de recuperação; o mockup ilustra uma onda simplificada.
- O trilho anual mantém os cards e o scroll já existentes, mas omite o cabeçalho redundante no breakpoint compacto.

final result: passed

---

# Design QA - preview A4 e navegação móvel

**Fonte visual**

- A4 completo no leitor: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-b3a61dc2-4a21-4eab-a873-838fbe2a3cdc.png`
- Densidade de leitura no Word: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-801c0871-53ab-4a99-b735-8c671ef0720a.png`
- Estado anterior do GoAtleta: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-73b433a3-c8c6-47ae-8941-ad1d2d073305.png`

**Implementação capturada**

- Preview inicial a 125%: `C:\Users\gusta\Downloads\GoAtleta\tmp\device-plan-zoom125.png`
- Preview após pan horizontal: `C:\Users\gusta\Downloads\GoAtleta\tmp\device-plan-zoom125-panned.png`
- Gaveta lateral nativa: `C:\Users\gusta\Downloads\GoAtleta\tmp\device-native-sidebar.png`

**Ambiente e normalização**

- Dispositivo: Galaxy S25, Android 16/API 36, development build `1.0.2-dev`.
- Viewport e capturas: `1080 x 2340 px`; fonte e implementação possuem a mesma
  densidade de captura do aparelho, sem redimensionamento para a comparação.
- Estado: usuário autenticado, turma com plano aplicado, tema escuro do app e
  documento A4 branco editável.
- A captura do Word usa outro plano, tema e chrome de aplicativo. A comparação
  considera escala, legibilidade e área visível da tabela, não cores ou controles
  proprietários do Word.

**Comparação visual**

- Visão completa: o estado anterior ajustava quase toda a largura do documento
  dentro do modal e deixava a tabela pequena. O estado revisado abre a 125%,
  mostra aproximadamente a mesma quantidade de colunas da referência do Word e
  preserva uma faixa lateral navegável.
- Região focada: cabeçalho e primeiras linhas da tabela continuam nítidos; os
  rótulos, valores, bordas e pesos tipográficos permanecem legíveis no zoom
  inicial. O pan revela a coluna de descrição sem deslocar a toolbar do modal.

**Superfícies de fidelidade**

- Tipografia: família e pesos continuam sendo os do documento exportável; o
  ganho de leitura vem do zoom do visualizador, não de uma alteração destrutiva
  de fontes ou quebras de linha.
- Espaçamento e layout: a folha usa `210 x 297 mm`, proporção `210 / 297` e
  `box-sizing: border-box`. A toolbar fica fixa, com o documento navegável abaixo.
- Cores e tokens: o documento permanece branco e imprimível; o chrome mantém os
  tokens escuros do GoAtleta. Não foi copiado o tema preto do Word.
- Imagens e ativos: não há imagem ou ativo de referência dentro do plano; os
  ícones da toolbar e da gaveta vêm do registro de ícones existente.
- Copy e conteúdo: nomes, datas e exercícios diferem porque as capturas usam
  turmas distintas. Os rótulos estruturais do plano permanecem equivalentes.

**Histórico da iteração**

- P2 anterior: o enquadramento inicial deixava o plano pequeno demais para
  leitura e não lembrava um editor de documento no celular.
- Correção: definição explícita da caixa A4 e zoom móvel inicial de 125%, mantendo
  pan e pinça e sem modificar o PDF gerado.
- Evidência posterior: `device-plan-zoom125.png` e
  `device-plan-zoom125-panned.png`; não restaram diferenças P0, P1 ou P2 no alvo
  visual desta rodada.

**Interações verificadas**

- Pan horizontal no documento após a nova escala.
- Pinça aprovada pelo usuário antes da calibração final; a ponte de zoom não foi
  removida ou substituída nesta mudança.
- Gaveta lateral aberta pelo botão da Home e fechada pelo botão físico Voltar.
- Toolbar do plano permaneceu acessível; ações não foram executadas para evitar
  alterar o plano real.

**Pendências funcionais fora deste aceite visual**

- Pan vertical nas bordas, edição longa, salvar/reabrir e APK sem Metro ainda
  pertencem à matriz de release e não são considerados concluídos por este QA.

final result: passed

---

# Design QA - drawer nativo com marca e perfil

**Fonte visual e funcional**

- Sidebar web expandida: `C:\Users\gusta\Downloads\GoAtleta\artifacts\design-qa\goatleta-brand-sidebar-expanded.png`
- Menu de perfil e troca de workspace web: `C:\Users\gusta\Downloads\GoAtleta\artifacts\design-qa\workspace-switcher-local-1209x812.png`
- Componentes canônicos: `src/ui/WebSidebar.tsx` e `src/ui/GoAtletaBrand.tsx`.

**Implementação capturada**

- Drawer aberto: `artifacts/design-qa/native-sidebar-brand-profile-galaxy-s25.png`
- Menu de perfil aberto: `artifacts/design-qa/native-sidebar-profile-menu-galaxy-s25.png`
- Destino de perfil aberto pelo menu: `artifacts/design-qa/native-sidebar-profile-route-galaxy-s25.png`

**Ambiente e normalização**

- Dispositivo: Galaxy S25, Android 16/API 36, development build conectado ao
  Metro por ADB reverse.
- Viewport físico: `1080 x 2340 px`, tema escuro, sessão autenticada no perfil
  Coordenação.
- A referência web e a captura nativa foram comparadas juntas. A normalização
  considera a mesma estrutura expandida; a diferença de quantidade de itens é
  intencional porque a referência está no perfil Professor e o aparelho no
  perfil Coordenação.

**Comparação visual**

- Marca: o placeholder textual `GA` foi removido. O topo nativo agora usa o
  símbolo e o wordmark SVG oficiais, em branco, com o subtítulo contextual do
  perfil, como no web.
- Hierarquia: marca, navegação rolável e conta foram separados em três regiões.
  A conta não rola com os atalhos e permanece ancorada ao rodapé.
- Perfil: avatar por iniciais, nome, função e chevron repetem dimensões, estados,
  bordas e paleta do card web.
- Menu: `Perfil e configurações` e `Sair` aparecem acima do card, com divisor e
  tratamento de perigo equivalentes à referência.
- Movimento: o drawer permanece montado e usa `Animated.Value` com driver
  nativo para translação e opacidade. Isso elimina o flash de montagem e mantém
  a Home estável sob o scrim.

**Histórico da iteração**

- P1 anterior: o drawer aparecia de forma abrupta, sem transição estável.
- P1 anterior: a marca oficial havia sido substituída por um círculo com `GA`.
- P1 anterior: não existia o card de conta nem o menu de perfil no rodapé.
- Correção: drawer persistente animado, ativos oficiais e rodapé funcional.
- Comparação final: não restaram diferenças P0, P1 ou P2 no escopo solicitado.

**Interações verificadas**

- Abertura pelo botão de três linhas e fechamento pelo botão físico Voltar,
  repetidos três vezes sem tela branca, remount da Home ou erro no Metro.
- Abertura e fechamento do menu de perfil.
- Navegação real para `Perfil` por `Perfil e configurações`.
- `Sair` foi mantido funcional, mas não executado para preservar a sessão usada
  no restante da validação.

final result: passed

---

# Design QA — Financeiro da coordenação

## Referência e estado

- Mockup aprovado: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-15683cdf-0f39-457b-8ab7-262703848cb0.png` (1576 × 742).
- Estado anterior apontado pelo usuário: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-722fadff-2617-45de-8c0c-29900e77432a.png` (1444 × 408).
- Estado comparado: desktop, tema escuro, agosto de 2026, primeira página e cobrança de Enzo Martins selecionada.
- Viewport de validação: 1440 × 1024.

## Implementação e evidências

- Rota local: `http://localhost:8081/coord/finance`.
- Captura da direção visual aprovada: `artifacts/design-qa/finance-dashboard-list-header-revised-1440.png` (1360 × 914 renderizados pela superfície do navegador).
- Comparação normalizada no mesmo recorte: `artifacts/design-qa/finance-dashboard-reference-vs-revised-focus.png`.
- Evidência da sidebar em sobreposição: `artifacts/design-qa/finance-dashboard-sidebar-overlay-1440.png`.
- O cabeçalho fixo, a seta de retorno e a arquitetura final em abas foram ajustados depois dessas capturas e validados por testes de contrato e typecheck; ainda requerem uma nova captura autenticada nos três breakpoints.

## Correções visuais

- O módulo foi organizado nas abas `Visão geral`, `Cobranças`, `Planos` e `Pagadores`, mantendo o contexto financeiro em uma única rota.
- O cabeçalho usa o componente compartilhado do app, permanece fixo e oferece retorno real com fallback para o painel da coordenação.
- O título, as ações e os filtros de `Contas a receber` foram retirados do card grande e voltaram a ocupar a área livre acima da tabela, como no mockup.
- A contagem duplicada sob o título foi removida; a informação permanece no rodapé paginado.
- A tabela agora é o único bloco com borda nessa seção e preserva a composição densa do mockup.
- O cabeçalho de `Vencimento` recebeu o indicador de ordenação.
- A linha selecionada usa o círculo verde preenchido com check e o estado pago usa o rótulo `Pago`.
- `Nova cobrança` abre um modal próprio, sem trocar de rota; planos recorrentes ficam na aba `Planos` como `Planos e mensalidades`.
- `Configurar financeiro` abre um modal centralizado, sem navegar para uma tela avulsa.
- Acesso de atletas e responsáveis não pertence ao Financeiro: a gestão de vínculos ficou em `Gestão > Acessos familiares`.
- Pesos tipográficos da lista foram reduzidos para evitar a aparência pesada do estado anterior.
- P0: nenhum.
- P1: nenhum.
- P2: falta recapturar a composição final depois da troca para cabeçalho fixo e abas.

## Interações verificadas

- Seleção de uma cobrança atualiza linha e painel de detalhes; no mobile, o detalhe usa a superfície adaptada da tela.
- O estado final foi restaurado para Enzo Martins, igual ao mockup.
- Paginação, busca e filtros permanecem disponíveis.
- Criação de cobrança, configuração financeira e registro manual usam modais e mantêm `/coord/finance`.
- `Pagadores` encaminha a administração de responsáveis para Gestão, evitando duplicar o cadastro familiar.
- Na captura anterior, o console da rota ficou sem erros novos.

## Veredito

A direção visual foi aprovada; contratos, testes focados e typecheck da implementação final passaram. O smoke visual autenticado final em 390 × 844, 834 × 1194 e 1440 × 1024 continua como gate de QA, sem bloquear a publicação da fundação desativada por feature state.

final result: passed with visual revalidation pending

---

# Design QA — Acessos familiares na lista de Atletas

## Fonte de verdade

- Popover desktop aprovado: `C:\Users\gusta\.codex\generated_images\01a05a30-94a7-7091-b778-f9582a39aa3a\exec-a81948b8-64eb-4b29-b041-9dbbb3ec64c1.png`.
- Drawer desktop aprovado: `C:\Users\gusta\.codex\generated_images\01a05a30-94a7-7091-b778-f9582a39aa3a\exec-848ab963-00e9-4a5b-897c-7cf5ea1c9fe9.png`.
- Bottom sheet mobile aprovado: `C:\Users\gusta\.codex\generated_images\01a05a30-94a7-7091-b778-f9582a39aa3a\exec-86b9d42c-5d5d-463e-93d9-0df33e8b1be6.png`.
- Barra de filtros aprovada: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-9e55a8c8-34c5-46f2-974d-f5991d0c9afd.png`.
- Referência ampliada do encaixe dos rótulos na borda: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-90b3db2a-e92d-4db6-8ea3-1e894254598e.png`.
- Captura local focada após o ajuste: `C:\Users\gusta\AppData\Local\Temp\goatleta-filter-legend.png`.
- Lista mobile aprovada: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-df0ad7a4-40c0-42e2-8ecb-83fb09252473.png`.
- Implementação autenticada: `http://localhost:8081/coord/students`.

## Implementação comparada

- A tela permanece dedicada a `Atletas` na navegação lateral e usa `ATLETA`, `Adicionar atleta`, `Editar atleta` e `Salvar atleta` no escopo da coordenação.
- No desktop, a barra principal repete o mockup com busca, `Turma`, `Status`, `Responsável / acesso` e `Limpar filtros` em uma única superfície horizontal.
- Os três seletores usam rótulos flutuantes que interrompem visualmente a borda superior, como um `legend`, em vez de empilhar o rótulo dentro do campo.
- No mobile, a busca permanece visível e `Filtros` abre um bottom sheet funcional com as mesmas três dimensões, sem duplicar controles antigos.
- A lista usa as quatro colunas aprovadas: atleta com idade, turma, status e responsável/contato. O estado familiar aparece como `Acesso ativo`, `Convite enviado` ou `Adicionar responsável`.
- `Adicionar responsável` abre um popover ancorado à linha no desktop e um bottom sheet no mobile. A segunda linha preservou exatamente a mesma coordenada vertical antes e depois da abertura, comprovando que a lista não sofre reflow.
- A ação de mais opções abre um drawer alinhado à direita, acima da tabela. A caixa de busca preservou posição e largura antes e depois da abertura, comprovando que o conteúdo não encolhe.
- Somente uma superfície contextual pode permanecer aberta. Abrir o convite rápido fecha o drawer e abrir o drawer fecha o convite rápido.
- O drawer usa os vínculos e convites reais do atleta e oferece editar permissões, duplicar acesso, gerar novo link, revogar vínculo e cancelar convite. Ações destrutivas usam confirmação global.
- A antiga entrada de `Acessos familiares` foi removida de Gestão para não duplicar o diretório de atletas.

## Responsividade e interação

- Viewports conferidos pelo controle responsivo em 390 × 844, 834 × 1194 e 1440 × 1024; a escala interna do navegador resultou em 487, 1042 e 1800 px de largura CSS.
- Não houve overflow horizontal em nenhum breakpoint.
- No mobile, busca e filtros dividem a primeira linha e a tabela densa preserva as quatro colunas do mockup.
- O formulário mantém e-mail, relação e permissões em composição compacta; o botão permanece desabilitado até o e-mail ser válido.
- Nenhum convite, vínculo ou remoção foi submetido durante o smoke visual.
- Nenhum erro foi observado no console após a revisão final.

## Iteração visual — 03/09/2026

- P2 corrigido: os rótulos dos seletores apareciam dentro das caixas e não recortavam a borda como na referência.
- A correção posiciona o rótulo sobre a borda, mascara apenas o trecho necessário e mantém valor e seta centralizados.
- A comparação conjunta entre a referência ampliada e a captura local não revelou diferenças P0, P1 ou P2 nesse detalhe.

## Diferenças intencionais P3

- Os mockups usam fotos, nomes, turmas e estados demonstrativos. A implementação preserva os atletas, fotos disponíveis e vínculos reais da organização autenticada; quando não há foto ou responsável, usa os estados vazios do produto.
- A lista não faz consultas individuais por atleta. Um RPC com escopo de organização entrega o resumo de vínculo ou convite de todos os atletas; o drawer busca os detalhes somente quando aberto.

final result: passed

## Fluxos modais e acessos familiares — 31/08/2026

- `Nova cobrança` abre um modal próprio e mantém `/coord/finance`.
- A aba `Planos` concentra planos e mensalidades sem reutilizar a ação de nova cobrança.
- `Configurar financeiro` abre um modal centralizado e permanece no módulo.
- Em Gestão, `Acessos familiares` abre como ação contextual; ao fechar ou voltar, permanece em `/coord/management`.
- A rota direta `/coord/family-access` retorna para `/coord/management`.
- Os contratos automatizados cobrem a permanência na rota, a separação entre cobrança e planos, o retorno para Gestão e o cabeçalho fixo.
- Uma nova inspeção autenticada dos três viewports permanece pendente após a arquitetura final em abas.

final result: passed with visual revalidation pending

---

# Design QA — Dropdown de relação familiar

## Evidências

- Fonte visual: comentário do Browser na tela `http://localhost:8081/coord/students`, estado do drawer de acessos familiares com `Relação` aberto.
- Implementação capturada localmente: `goatleta-family-relation-overlay.png`, viewport solicitado de 1360 × 914, tema escuro e drawer de um atleta da organização. A captura contém dados pessoais e não integra a publicação.
- Estado conferido: formulário `Adicionar responsável`, permissões expandidas e dropdown de relação aberto.

## Comparação e iteração

- P2 inicial: a lista de relações participava do fluxo vertical do formulário e empurrava permissões, ações e estado vazio para baixo.
- Correção: a lista passou para a camada flutuante compartilhada do produto, ancorada ao seletor e renderizada acima do drawer no web.
- Evidência pós-correção: `Ocultar opções` manteve exatamente `y = 362,83203125` antes e depois da abertura, comprovando ausência de reflow.
- Tipografia, cores, ícones, textos e opções permanecem iguais; a alteração é somente de empilhamento e posicionamento.
- A lista usa a largura medida do gatilho e altura limitada à viewport. Não há diferenças P0, P1 ou P2 restantes neste estado.

final result: passed

---

# Design QA — Balão de frequência e resumo financeiro do aluno — 03/09/2026

- Esta revalidação substitui a conclusão anterior sobre o balão de frequência: o print do usuário demonstrou que o overlay interno ainda ficava atrás de `Dados do aluno`.
- O aviso agora usa `AnchoredDropdown` em portal no `document.body`, na camada flutuante 50000. A inspeção com `elementFromPoint` confirmou o texto no topo; no celular, `Dados do aluno` permaneceu em y=383,544921875 antes e depois da abertura.
- Viewports CSS reais conferidos: 390×844, 834×1194 e 1440×1024; foi compensado o zoom de 80% do navegador. Não houve overflow horizontal do documento. O tema claro também foi conferido a 1600×900; a preferência escura foi restaurada ao terminar.
- P2 adicional corrigido: o limite do portal usava as dimensões visuais do React Native, divergentes dos pixels CSS sob zoom. Agora usa a área útil do documento na web e fecha ao redimensionar; o nativo conserva suas dimensões de janela.
- No tablet, os indicadores usam a largura disponível abaixo da foto. Os títulos não são comprimidos pelos badges; textos longos de estado podem quebrar dentro do badge.
- O clique em Financeiro abre um resumo de leitura sem navegar. Apenas `Abrir financeiro` mantém a ação de navegação já existente. Cadastro, financeiro e aviso de frequência abrem um overlay por vez; Escape fecha o overlay sem fechar o perfil.
- O aluno utilizado no smoke não tem cobrança vinculada e exibiu o estado vazio correto. Valores, saldo parcial, vencidos, exclusão de rascunhos/canceladas/estornadas e ausência de quitação inventada foram validados em testes isolados, sem criar dados na organização.
- O resumo reutiliza a consulta existente, com filtro de aluno, escopo de organização, permissão e proteção contra respostas atrasadas. Não libera edição financeira nem altera permissões de aluno ou responsável.
- Validação: 23 testes focados (5 suítes), typecheck do app, org-scope, perf-hygiene estrito, build web e diff check. Console da conferência final sem erros. O build mantém o aviso preexistente de resolução de `expo-font`.
- Limite: web autenticado e testes automatizados; não foi executado em dispositivo nativo. Alterações locais, sem commit, push ou deploy.

final result: passed for local web scope
