# Provider Higgsfield

Higgsfield pode ser usado como ferramenta externa para produzir assets visuais do Catalogo GoAtleta. Ele nao e dependencia do app, do runtime, do build ou do CI.

## Regra principal

```txt
GoAtleta conhece mediaKey, asset local e fallback local.
Higgsfield produz PNGs que obedecem esse contrato.
```

## Fluxo recomendado

1. Escolher ou criar um `mediaKey` no contrato do catalogo.
2. Criar ou atualizar o prompt em `docs/catalog-pedagogico/media/prompts/`.
3. Gerar a imagem fora do runtime do app.
4. Exportar PNG em `1280x720`.
5. Salvar em `assets/activity-catalog/thumbnails/`.
6. Atualizar `activity-catalog-media-manifest.v2.json`.
7. Rodar `npm run check:activity-catalog-media`.
8. Commitar apenas o PNG final, o prompt, o manifest e o mapeamento local necessario.

## Proibido

- Chamar Higgsfield dentro do app.
- Baixar asset em runtime.
- Salvar URL externa no catalogo.
- Guardar token no repo.
- Tornar Higgsfield obrigatorio no CI.
- Expor provider, prompt bruto ou score visual na UI do professor.

## Aceite de asset

Um asset gerado so pode entrar no catalogo quando:

- existe como arquivo local versionado;
- passa em `npm run check:activity-catalog-media`;
- nao tem texto, logo, marca, watermark ou rosto reconhecivel;
- representa uma intencao pedagogica do catalogo, nao uma copia de referencia externa.
