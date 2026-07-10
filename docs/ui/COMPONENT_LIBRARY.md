# Biblioteca de componentes web

## Fundação responsiva

### `ResponsivePage`

Controla largura máxima, gutter e centralização. Não aplica cor, card, dados ou
regra de domínio. Variantes: `content` e `dashboard`.

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
- `ModalSheet`: formulários e detalhes temporários.
- `ScreenLoadingState` e `SectionLoadingState`: carregamento consistente.

Antes de criar novo componente, verificar se a necessidade é estrutural e
reutilizável em pelo menos duas telas. Componentes de domínio ficam no módulo da tela.
