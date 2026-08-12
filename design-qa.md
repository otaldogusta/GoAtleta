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
