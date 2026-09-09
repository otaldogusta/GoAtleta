# Quadra Visual — proposta de evolução

Data: 08/09/2026. Estado: direção visual aprovada pelo usuário; implementação local autorizada e aplicada. Sem publicação ou migração.

## Objetivo

Transformar a tela em um ambiente completo de criação, apresentação e reutilização de jogadas e exercícios de voleibol. A quadra ocupa a maior área útil; ferramentas e propriedades aparecem conforme a ação. Manter a identidade navy/verde do GoAtleta, tema claro e escuro, autenticação e isolamento por organização.

## Referência e evidências

- Coach Tactic Board: Volley, descrição oficial Android: https://play.google.com/store/apps/details?hl=en_AU&id=com.bluelinden.coachboardvolleyball
- A descrição anuncia ferramentas de desenho com 16 tipos de linha, materiais de treino, quadra inteira/meia quadra/treino/lousa, equipes, substituições por arraste, personalização de jogadores, pastas e exportação. Não houve instalação nem teste prático do app concorrente; formatos e limites de exportação Android precisam de confirmação.
- GoAtleta: inspeção autenticada da Quadra Visual no localhost e leitura de `app/class/[id]/visual-tech.tsx`, `src/components/visual-court/VisualCourtCanvas.tsx`, `VisualCourtTimelineControls.tsx` e `src/core/visual-court.ts`.

## Estado anterior à implementação

| Recurso | Evidência e situação |
| --- | --- |
| Sistemas táticos | 5×1 recepção, 5×1 saque, defesa base 6 fundo e grade didática disponíveis na tela. |
| Jogadores | Adicionar por função, selecionar, arrastar, duplicar e remover no código da rota. |
| Animação | Trajetórias, fases/rodízios, reprodução e velocidades 0,75× a 2×. |
| Histórico | Desfazer/refazer e atalhos no código. |
| Documentos | Salvamento por turma e organização, com caminhos de fallback local; sincronização remota não foi testada com escrita. |
| Objetos e camadas | Modelo já representa cones, bolas, alvos, setas, trajetórias e camadas. Isso não equivale a uma ferramenta completa de criação exposta na interface. |
| Quadra | Modelo prevê inteira/meia quadra; orientação persistida é vertical. |

## Organização visual proposta

- Cabeçalho de 56–64px: voltar, título editável da jogada, contexto da turma, estado de salvamento, salvar e menu de exportação.
- Área central: quadra que se ajusta ao espaço disponível, sem rolagem vertical obrigatória para alcançar a reprodução. Modo foco para apresentação.
- Barra de ferramentas: selecionar/mover, jogador, bola/material, seta, desenho, texto e apagar. Rótulos acessíveis e atalhos; propriedades em painel contextual.
- Painel lateral único e recolhível: propriedades do objeto selecionado; biblioteca abre sob demanda. Evitar biblioteca, elenco, cores e ajuda competindo simultaneamente com a quadra.
- Sequência inferior: miniaturas de etapas, adicionar/duplicar/reordenar, duração, reproduzir, velocidade e repetição. Rodízio e etapa têm controles distintos.
- Celular: quadra vertical, barra curta de ferramentas e propriedades em painel inferior; modo paisagem favorece apresentação. Alvos de toque de pelo menos 44px e ações essenciais visíveis em 328px.
- Desktop/tablet: quadra inteira horizontal opcional. A orientação é transformação de visualização, sem corromper coordenadas nem rodízios existentes.

## Pacote de implementação

### Etapa 1 — Estrutura e confiabilidade

Extrair controlador do documento e comandos de edição da rota. Criar shell responsivo, toolbar e inspector. Preservar modelos e presets atuais. Mostrar estados distintos: salvo localmente, sincronizando, salvo e falha. Proteger saída com alterações e troca de documentos. Histórico consistente para toda edição. Modo foco, zoom, pan, ajustar à tela e suporte a teclado.

Aceite: abrir documento existente, editar/desfazer/refazer/salvar/reabrir sem perda; redimensionar e mudar orientação sem alterar coordenadas; painéis não bloqueiam a quadra.

### Etapa 2 — Editor tático completo

Jogadores de duas equipes com número, função, cor e rótulo; vínculo opcional ao elenco, preservando atores genéricos. Banco e substituição explícita por etapa. Bola, cone, alvo e escada; rotação e tamanho dos materiais. Setas retas/curvas/tracejadas, traço livre, texto e áreas de destaque. Seleção múltipla, duplicar, bloquear, ocultar camadas e alinhamento opcional. Começar com os estilos de linha pedagogicamente úteis, sem copiar mecanicamente 16 variações.

Aceite: todos os objetos podem ser editados por toque e ponteiro; apagar afeta apenas seleção; desfazer restaura propriedades e ordem; contraste e identificação não dependem somente de cor.

### Etapa 3 — Sequências e biblioteca

Criar, duplicar, excluir e reordenar etapas com duração, notas e movimentos de jogadores/bola. Separar alinhamento inicial de trajetória animada. Biblioteca com título, busca, tags, favoritos e pastas; duplicar um preset antes de personalizar. Vincular jogada a bloco de aula e permitir reutilização entre turmas autorizadas. Uma alteração na biblioteca não modifica silenciosamente planos já aplicados.

Aceite: editar qualquer etapa depois de animar; cancelar reprodução volta a estado definido; versões antigas continuam abrindo; referências a aulas usam versão explícita.

### Etapa 4 — Apresentação e exportação

PNG do quadro e PDF com sequência/notas como primeira entrega; validar fidelidade dos mesmos objetos do canvas. Formato editável versionado para reimportar. Compartilhamento interno autenticado por organização. Vídeo/GIF como incremento posterior, condicionado a prova técnica de desempenho, codecs e equivalência web/nativo; não prometer MP4 antes dessa verificação.

Aceite: fontes, setas e posições equivalentes ao editor; exportação sem dados pessoais por padrão; nenhuma URL pública criada implicitamente.

### Etapa 5 — Refinamento e integrações

Templates de recepção, saque, defesa e exercícios; apresentação em aula; rascunho local com recuperação e conflitos de sincronização explícitos. Assistente pode propor jogadas para revisão, sem sobrescrever documento. Validações pedagógicas de rodízio entram separadamente, com regras e versão documentadas; o editor não deve afirmar automaticamente que toda formação é regulamentar.

## Engenharia e dados

- Reutilizar `VisualCourtCanvas` e motor de trajetórias; evitar dois renderizadores independentes para editar e exportar.
- Evoluir payload com versão explícita, conversor puro v1 → próxima versão e fixtures reais sanitizadas. Tipar desenhos, transformações, equipes, banco e metadados sem quebrar presets.
- Separar documento persistente de seleção, zoom, painéis, cursor e progresso de playback.
- Histórico transacional por gesto; não criar centenas de entradas em um arraste. Preferências de interface locais por dispositivo.
- Supabase permanece fonte de autorização e dados. Verificar esquema e RLS existentes antes de propor migrações; nenhuma migração faz parte desta proposta.
- Preservar as alterações locais anteriores dos botões arrastáveis.

## Verificação para entrega

Testes de comandos, conversão de payload, histórico, animação e serialização; testes de escopo e leitura/escrita autorizada quando aplicável. Typecheck, lint, perf-hygiene, org-scope, diff check e build. Smoke autenticado no localhost em 328×912, 390×844, 834×1194 e 1440×1024, temas claro/escuro, teclado, toque, recarga, falha de rede e exportação. Teste nativo em aparelho separado da validação web.

## Decisão visual aprovada

O usuário aprovou a aplicação do pacote após revisar os mockups. Ajustes aprovados: piso externo azul; cabeçalho e timeline recolhíveis por toque/clique/hover; ferramentas flutuantes discretas; propriedades fechadas até clique; quadra prioritária e horizontal no celular deitado; extensões tracejadas das linhas de ataque e limites da zona de saque.

## Implementação local — 08/09/2026

- Rota reduzida a adaptador; controlador isolado, histórico de até 80 operações por gesto e recuperação de rascunhos por usuário/organização/turma.
- Documento v1 compatível com extensão `editor.version = 1` e coordenadas regulamentares. Conversão pura dos modelos antigos, inclusive desenhos e materiais; o serializer/parser do banco preserva os metadados novos.
- Canvas de tela inteira, orientação automática/manual, zoom, pan, ajuste à tela, meia quadra e lousa. Renderizador geométrico compartilhado por edição, miniaturas e PNG/PDF.
- Duas equipes, identificação/função/cor, banco por etapa, substituição explícita, vínculo opcional ao elenco. Seleção múltipla, duplicação, bloqueio, alinhamento horizontal/vertical e camadas.
- Bola, cone, alvo, escada, seta reta/curva/tracejada, desenho livre, área e texto. Movimento estático separado da animação de jogadores e bola.
- Etapas criáveis/duplicáveis/reordenáveis, duração/notas, miniaturas, reprodução com pausa e velocidade/repetição. Modelos existentes disponíveis como cópias editáveis.
- Biblioteca com título/pasta/tags/favorito/busca. Associação de versão à data e ao bloco de aula, recebendo a aula selecionada na navegação da turma; o plano aplicado não é modificado. Reutilização entre turmas pelo arquivo editável importado na turma autorizada de destino.
- Salvamento cria uma revisão imutável; retorno local é informado como sincronização pendente. Troca de documento preserva trabalho anterior em backup local. Sair com rascunho aguarda a gravação local terminar.
- PNG da etapa e PDF da sequência no navegador; JSON editável versionado no web/nativo. JSON remove IDs de alunos e vínculo com aula, preservando rótulos/notas visíveis. Compartilhamento por link interno mantém autorização existente; não cria URL pública.

### Limites explícitos

- Vídeo/GIF, geração de jogadas pelo assistente e validação automática de regras de rodízio continuam como incrementos separados. Não há afirmação automática de legalidade das formações.
- Não houve migração, alteração de RLS, envio ao GitHub, deploy ou teste com escrita remota em dados reais.
- Associação à aula é uma referência na biblioteca; não reescreve o conteúdo do plano aplicado. Reutilização entre turmas usa exportação/importação, sem catálogo global entre organizações.
- PNG/PDF são web nesta entrega; nativo mantém JSON e requer teste em aparelho. Responsividade no navegador não equivale a validação nativa.
- Revisões imutáveis evitam sobrescrita concorrente. Não foi criado um novo sincronizador offline automático; versões locais pendentes continuam explicitamente identificadas.
### Evidência de validação

65 testes focados passaram; `typecheck:app`, lint dos arquivos novos, `check:org-scope`, `check:perf-hygiene:strict -- --worktree --base HEAD` e `git diff --check` passaram. A primeira invocação de perf-hygiene sem `--worktree` não cobria mudanças locais; a verificação efetiva incluiu as duas rotas alteradas.

Smoke autenticado no localhost verificou layout em 328×912, 390×844, 844×390, 834×1194 e 1440×1024, sem rolagem horizontal; seleção de jogador, deslocamento por teclado e desfazer; fechamento/abertura de painéis; preservação de rascunho ao sair e retorno direto à turma. PNG, PDF e JSON concluíram a geração pelo painel real de exportação. Não houve erro de console na última verificação da aba após reiniciar o Metro.

Build web exportou as 111 rotas. Avisos do bundler sobre subpaths de expo-font/react-dom são distintos dos testes funcionais. Tema escuro foi inspecionado; variação clara e aparelho nativo ainda precisam de revisão visual específica.
