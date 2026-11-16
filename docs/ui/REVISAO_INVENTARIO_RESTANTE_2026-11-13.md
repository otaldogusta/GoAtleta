# Restante do inventário · revisão local de 13/11/2026

Continuidade dos lotes anteriores, preservando as composições aprovadas pelo
usuário. [Galeria por aba e cobertura completa](http://127.0.0.1:8096/inventario-revisado.html).
Os prints e roteiros ficam no acervo local ignorado
`.tmp/auditoria-go-atleta-2026-11-13/lote-6/`; não são artefatos de produção.

## Cobertura e método

O mapa reconciliou os 29 módulos e 381 itens do checklist com 124 arquivos de
rota, 123 padrões de URL e 66 grupos de interface. Foram identificados 228
estados, dos quais 49 já tinham composição aprovada a preservar. Aliases,
redirecionamentos e variantes nativas não foram contados como novas telas.

Designer UI inspecionou as capturas e proporções. Designer UX abriu as abas e
verificou teclado, foco, vínculos, falha e recuperação. Implementação integrou
correções delimitadas; Revisão fez leitura independente do diff incremental.
A coordenação manteve o mapa, a galeria, o checklist e as verificações técnicas.

QA autenticado no mesmo checkout em `127.0.0.1:8082`, com Supabase local em
`127.0.0.1:54321`, preservando a sessão existente em `localhost:8081`. Chromium
por Playwright, contas fictícias e contextos separados por papel. Base principal
390 × 844; temas claro/escuro nos fluxos principais e tablet 834 × 1194 quando
o reflow exigiu. Cada imagem informa o alcance efetivamente observado.

O mapa de rotas é leitura de código; uma captura de entrada não valida todos
os estados daquele fluxo. A galeria diferencia aceites anteriores, estados
observados agora, redirecionamentos e ramos sem nova captura. Os cenários
preenchidos por replay de leitura são identificados, sem simular autorização.

## Correções realizadas

| Área | Comportamento e composição |
| --- | --- |
| Atletas | Nome, turma e horários na mesma região em telas estreitas; cadastro com espaço para Nascimento e Telefone; busca vazia com recuperação e retorno ao campo. Erro de leitura possui nova tentativa e não aparece como lista vazia; respostas de escopo anterior não são apresentadas. |
| Alunos da turma | Aviso de cadastro incompleto permite duas linhas no mobile. Filtros têm nome de diálogo e ações anunciadas como botões; composição e gestão de matrícula preservadas. |
| Financeiro | Abas sublinhadas canônicas antes dos controles de contexto; competência junto à busca, indicadores sem taxa duplicada e filtro Exibir no seletor compacto. Planos embutido sem dupla rolagem/altura vazia; Pagadores em linhas. |
| Recebíveis | Saldo, situação e Registrar alinhados no celular; alvo da ação com 44 px. A ficha foi aberta sem registrar pagamento. |
| Agenda e Scouting | Busca/Histórico distinguem lista vazia de filtro sem resultado; limpar preserva o contexto e devolve foco. Calendário mensal e abas existentes permanecem; seletor de mês anuncia diálogo e seleção. |
| Plano do aluno | Leitura pela organização da matrícula; erro e ausência de plano distintos. Planos finais e planos legados sem status continuam elegíveis pelo resolvedor compartilhado; rascunhos não. |
| Scouting individual | Turma lida pelo vínculo e organização do atleta; falha tem nova tentativa; contadores antigos não sobrevivem à troca de vínculo. A janela de quatro horas permanece. Falha ao salvar preserva os contadores. |
| Família | Seletor com nome de diálogo, contenção de teclado e retorno ao acionador. O controle de atualização permanece montado e fica desabilitado sem permissão; a troca de vínculo não remonta o seletor. Dados e restrições continuam ligados ao atleta selecionado, sem alterar a composição aprovada. |
| Perfil, Evidências e Log | O Assistente usa ação no cabeçalho das rotas delimitadas, liberando campos e ações. Financeiro também usa cabeçalho abaixo do breakpoint desktop de 1100 px. Demais hosts mantêm seus controles. |
| Aula e relatório | Nome acessível e retorno de foco no relatório da ficha; correção de “Observações finais da aula” no Log legado. Chamada e ficha aprovadas preservadas. |
| Consultoria do aluno | Escalas de esforço e dor expõem o valor selecionado via `aria-pressed`, mantendo apresentação, valores e envio. |
| Consultoria · Evolução | Indicadores distribuídos pela largura disponível com quebra real de linha, sem a coluna estreita que deixava metade da região vazia. Abas, Perfil aprovado e regras de cálculo preservados. |
| Notificações | Um único cabeçalho com retorno e vazio compartilhado. Preferências, permissões e controles DEV preservados; nenhuma configuração alterada. |

As demais entradas e abas foram registradas sem redesenho quando já coerentes
com o padrão: Consultoria da equipe, Relatórios, perfis de equipe, Agenda da
Família, Hoje do atleta, Conquistas, gestão de vínculos, Plataforma, convites,
Assistente dedicado, páginas legais e utilidades. O registro por estado
distingue visualização natural, estado restrito e resposta fictícia.

## Preservação e revisão

O baseline SHA-256 de 2.040 fontes em `app/` e `src/` permite distinguir esta
rodada do trabalho anterior já existente no checkout. O manifesto local
`preservacao.json` lista alterações incrementais e arquivos aprovados intactos.
Autenticação, Quadra Visual, Planejamento, cartões de mês da Periodização,
Equipe como entrada da Gestão, Biblioteca, Avisos e Regulamentos permanecem.

`ClassContextHeader.headerAction` e `PersonProfilePage.headerAction` são opções
locais: sem ação, conservam a estrutura anterior. As primitives de abas,
seletor, vazio e modal foram reutilizadas. A alteração em `app/class/[id].tsx`
é de semântica/foco do relatório, sem modificar a Chamada aprovada.

Revisão independente encontrou dois problemas corrigidos antes do fechamento:
filtrar plano legado por status no transporte excluiria registros válidos;
uma largura mínima de busca no Financeiro causaria overflow abaixo de 380 px.
A revisão do terceiro recorte não encontrou novo achado acionável. Revisão
por leitura não substitui as execuções de UI/UX.

## Validação

Nível 2 para interações e componentes; nível 3 para leituras escopadas do aluno
e diretório, conforme a escada canônica. Testes focados cobrem leitura, falha,
recuperação, descarte de resposta antiga, compatibilidade de planos legados,
foco de modal, composição opcional e rotas exatas do Assistente. Também foram
conferidos contrato de pagamento manual e componentes do diretório.

Resultados finais, quantidades de capturas e verificações estão registrados
na seção de fechamento abaixo. Não houve build de release ou publicação.

## Limites e pendências explícitas

- O QA do diretório retornou erro por ausência de `students.guardian_name`.
  A interface de erro/repetição foi conferida; a lista preenchida usa replay
  fictício no navegador. Nenhuma migration foi aplicada para mascarar a falha.
- A primeira captura da busca vazia de Atletas foi sobrescrita durante a
  execução. Foi retirada dos pares; diretório e cadastro têm baselines íntegros.
- Evidências/síntese, consulta publicada de Consultoria e detalhes específicos
  de convites/Acessos usam respostas fictícias identificadas. O plano do aluno
  e as mensalidades foram lidos da base QA. Nenhuma publicação foi acionada.
- Curadoria foi conferida com a capacidade real da conta QA; estado restrito
  não certifica o painel privado. Onboarding legado redireciona pela guarda
  atual; captura do destino não valida etapas que deixaram de ser navegáveis.
- `class/[id]/session` é redirecionamento na web. O relatório atual é aberto
  pela ficha da turma; o Log direto foi registrado separadamente.
- NFC/QR físicos, câmera, vídeo preenchido/transferência, exportações completas,
  serviços externos e confirmações operacionais não foram certificados por
  screenshots. Os ramos sem execução permanecem identificados no mapa.
- Troca de ano/retorno ao ciclo da Periodização conserva a pendência anterior
  de foco registrada no lote 5; essa composição aprovada não foi reaberta.

Sem commits, push, deploy, mudanças em produção, cobrança, decisão de acesso,
aceitação de convite ou envio de mensagens nesta rodada.

## Fechamento registrado

- **42 comparativos**, **82 estados com capturas nesta rodada** e **49 estados aprovados preservados**. As contagens de UI e UX se sobrepõem; não foram somadas como telas distintas. Estados preservados com novas capturas continuam identificados como preservados.
- **120 testes distintos em 14 suítes focadas passaram**: 105 no recorte principal, 7 de foco familiar, 1 de identidade do shell, 4 de respostas familiares e 3 de navegação segura. Retestes não aumentam a contagem. Dois casos de Scouting inicialmente excederam o timeout; a espera do teste serializava uma árvore React inteira em falha. A correção usa estado habilitado e operações assíncronas do renderer, sem alterar o app nem elevar timeout.
- Tipos do app, ESLint do recorte, escopo de organização, perf-hygiene strict de 11 telas e diff-check passaram. Build/publicação não executados.
- UI confirmou Financeiro em 375 px e Planos em 834 px sem sobreposição; Evolução usa duas colunas em 390 px e quatro indicadores na mesma linha em 834 px. Notificações retorna à home; cadastro incompleto não fica cortado.
- UX confirmou Enter/Tab/Escape, recuperação de leitura, compatibilidade do plano publicado e seleção acessível de esforço. No último reteste familiar claro, a troca de vínculo preservou o mesmo nó/ID, devolveu foco ao botão, ocultou a cobrança anterior e exibiu a restrição correta. O teste de corridas também passou.
- Galeria conferida em 1311 e 390 px: filtros e vazio funcionam, imagens existem, sem erro de script nem overflow horizontal. Prints pareados mantêm a mesma dimensão; 375/834 ficam como complementos.
- O mapa cobre o app inteiro, mas nem todos os 228 estados foram executados no navegador. Chamada nativa exige app/aparelho; Evento direto não obteve fixture válida para abrir o editor. Ramos e confirmações não exercitados continuam explicitados, sem selo de aprovação total.
- Dezoito notas do checklist atualizadas, com 29 módulos/381 itens/124 rotas e os mesmos títulos, IDs e status. Conferidos 22 arquivos centrais aprovados intactos em relação ao baseline; extensões semânticas locais estão listadas no manifesto.

Evidência local: `cobertura-consolidada.json`, `validacao-final.json`,
`preservacao.json`, `ui-cobertura.json`, `ux-cobertura.json` e
`ux-depois-light/observacoes-familia-selecao.json` no acervo do lote 6.

## Correção posterior da apresentação das jornadas

O usuário apontou que a galeria dava destaque ao Log e a Notificações legados como se representassem os percursos atuais. A existência dessas rotas e sua abertura direta não comprovavam acesso pelos menus. Essa classificação foi corrigida no lote 7: o relatório atual é o modal da ficha; a central de Avisos usa rotas próprias; `/evidence` fica identificada como auxiliar restrita sem entrada visível encontrada. Os números acima são o registro histórico do lote 6, não uma certificação de todas as jornadas. A galeria anterior foi preservada em `inventario-revisado-lote6.html`.

[Ajustes de jornadas, cabeçalho e compositor do Assistente](AJUSTES_JORNADAS_ASSISTENTE_2026-11-13.md) registra a correção, as capturas e a validação específica, preservando as composições aprovadas.
