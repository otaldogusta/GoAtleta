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

Organiza regiões em `1`, `8/4` ou `6/6`. Empilha abaixo de 1200 px e não cria
superfícies automaticamente.

```tsx
<ResponsivePage variant="dashboard">
  <ResponsiveGrid columns={{ desktop: "8/4", compact: "1" }}>
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

Antes de criar novo componente, verificar se a necessidade é estrutural e
reutilizável em pelo menos duas telas. Componentes de domínio ficam no módulo da tela.
