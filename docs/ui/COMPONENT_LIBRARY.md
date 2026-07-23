# Biblioteca de componentes web

## Fundação responsiva

### `ResponsivePage`

Controla largura máxima, gutter e centralização. No web, a largura inclui o
gutter (`border-box`) para não criar rolagem horizontal. Não aplica cor, card,
dados ou regra de domínio. Variantes: `content` e `dashboard`.

Filhos com conteúdo longo ou largura mínima não podem expandir a página:
`ResponsivePage` e as regiões do grid preservam `minWidth: 0`, e o conteúdo
deve truncar ou quebrar dentro da própria região.

### `ResponsiveGrid`

Organiza regiões em `1`, `8/4` ou `6/6`. Combina a capacidade global
`supportsSplitView` com a largura medida do próprio container e não cria
superfícies automaticamente.

```tsx
<ResponsivePage variant="dashboard">
  <ResponsiveGrid columns={{ split: "8/4", compact: "1" }}>
    <MainRegion />
    <SideRegion />
  </ResponsiveGrid>
</ResponsivePage>
```

## Componentes existentes

- `ScreenPageHeader`: título, retorno, descrição e ação contextual.
- `Button` e `Pressable`: ações e estados interativos.
- Controles web preservam um foco visível por teclado; nunca remova o contorno
  sem oferecer um anel ou mudança de borda equivalente.
- Ações que não existem para o nível de permissão atual são ocultadas; não são
  renderizadas apenas como controles desabilitados sem utilidade.
- `ModalSheet`: formulários e detalhes temporários.
- `ScreenLoadingState` e `SectionLoadingState`: carregamento consistente.
- `FormFieldValidationFeedback`: validação junto ao campo, com mensagem curta,
  borda de erro, foco no primeiro campo inválido e animação que respeita a
  preferência de movimento reduzido. A ação de salvar não deve falhar em silêncio
  por estar desabilitada quando ainda faltam dados obrigatórios.
- `AnchoredDropdown`: camada canônica para listas de seleção, autocomplete e menus
  ligados a um campo. No web, a lista é renderizada no portal do `body`, sempre
  acima de modais e campos, sem participar do layout, aumentar o modal ou mover o
  formulário. Não implementar listas flutuantes com `position: absolute` dentro
  do conteúdo rolável de um modal.

## Validação de formulários

- Ao salvar, abrir a seção que contém o primeiro erro e mover o foco até o campo.
- Exibir uma única mensagem operacional junto ao campo; não repetir o mesmo erro
  no rodapé, em alerta genérico e no topo da tela.
- Repetir a animação a cada nova tentativa, mesmo quando o erro não mudou.
- Erros de rede ou servidor permanecem na região da ação; erros de preenchimento
  pertencem ao campo que precisa ser corrigido.

## Formulários em modal

- A ação de salvar fica desabilitada enquanto não existir uma alteração real e
  volta a esse estado depois que os dados forem salvos.
- O `X`, `Esc` e o clique no backdrop usam a mesma solicitação de fechamento.
  Se houver alteração não salva, devem abrir `ConfirmCloseOverlay`; sem alteração,
  fecham imediatamente.
- Não renderizar `Cancelar` no rodapé quando o modal já possui `X`, `Esc` e backdrop.
  O rodapé mantém apenas a ação primária.

Antes de criar novo componente, verificar se a necessidade é estrutural e
reutilizável em pelo menos duas telas. Componentes de domínio ficam no módulo da tela.
