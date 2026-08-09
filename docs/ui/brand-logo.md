# Marca Go Atleta

## Conceito

O símbolo combina atleta em movimento, trajetória circular e continuidade. A abertura do círculo evita uma leitura estática e permite que o gesto do corpo ultrapasse a moldura visual.

## Arquivos mestres

- `assets/brand/goatleta-mark.svg`: símbolo oficial em azul de marca.
- `assets/brand/goatleta-wordmark.svg`: logotipo oficial `Go Atleta`.
- `assets/brand/goatleta-mark-light.svg`: símbolo para fundos escuros.
- `assets/brand/goatleta-wordmark-light.svg`: logotipo para fundos escuros.
- `src/ui/GoAtletaBrand.tsx`: componentes compartilhados de símbolo, logotipo e assinatura.

Os vetores foram traçados a partir da referência aprovada e normalizados para cor plana. Sombras, textura e desfoque da prancha de apresentação não fazem parte da marca.

## Cores

- Azul de marca: `#102A72`.
- Versão clara: `#F8FAFC`.
- Fundo areia dos ícones: `#F5F0E8`.
- Superfície clara do splash e favicon: `#FFFDF8`.

O verde operacional do produto não deve ser aplicado dentro do símbolo ou do logotipo. Ele continua reservado a ação, sucesso e estados ativos.

## Construção e uso

- Preserve a proporção original; nunca comprima ou estique.
- Use a versão clara sobre o shell azul-escuro e a versão azul sobre fundos claros.
- Mantenha área livre mínima equivalente ao diâmetro da cabeça do atleta ao redor da assinatura.
- Tamanho mínimo digital do símbolo: `24 px`. Abaixo disso, use somente o símbolo e não a assinatura completa.
- Não adicione contorno, gradiente, sombra, brilho, moldura ou cor de destaque ao desenho principal.
- O nome oficial visível é `Go Atleta`, com espaço.

## Ícones derivados

`scripts/generate-brand-assets.js` gera `icon.png`, favicon, splash e camadas do ícone adaptativo Android a partir do vetor mestre. Sempre regenere esses arquivos depois de alterar o desenho oficial para evitar versões divergentes.
