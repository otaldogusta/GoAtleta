# Quadra 3D

Esta superfície apresenta o documento canônico do editor. O componente React
envia quadros por `postMessage`; esta página devolve comandos transacionais.
Não há armazenamento, formação própria, simulação independente ou histórico.

O módulo Three.js mantém a licença MIT em `THREE-LICENSE.txt`. As silhuetas e a
textura da bola são os mesmos recursos de referência do mockup aprovado; suas
origens estão registradas em `reference/sources.json`. Não são apresentadas como
arte original do Go Atleta. O logotipo e a fonte do site de referência não são
utilizados nesta superfície.

Todos os jogadores usam corpos 3D locais em `actor-rig.mjs`, compartilhando
`actor-anatomy.mjs` com o bloqueador. As poses e suas transições vêm do host;
facing, elevação e salto preservam seus contratos. Seleção usa os meshes do
corpo. As silhuetas legadas permanecem como referência, sem carregamento pelo
renderer. [Contrato e validação](../../docs/ui/QUADRA_CORPOS_3D_2026-11-12.md).

`renderer-appearance.mjs` aplica luz aos objetos sólidos e fornece sombras de
contato suaves com textura radial compartilhada. Traços mantêm seus materiais
sem iluminação; sombras permanecem no piso, acompanham altura
e não participam do picking/hover. Sem passes de shadow map. Contrato e medição
local em [Materiais 3D](../../docs/ui/QUADRA_MATERIAIS_3D_2026-11-12.md).

`renderer-pointer-gestures.mjs` separa arraste, órbita e câmera com dois dedos;
`renderer-camera-framing.mjs` enquadra a geometria com espaço para os controles.
O picking de toque preserva profundidade e o ponto de pega elevado. A prévia
de movimento aguarda o quadro local confirmado, sem depender do autosave.
Testes dos helpers e `renderer-gesture-integration.test.mjs` cobrem transições
dos handlers reais. [Contrato e limites](../../docs/ui/QUADRA_CAMERA_GESTOS_3D_2026-11-12.md).

Setas e curvas autorais usam o mesmo traço XYZ para renderizar, selecionar e
posicionar as alças de início/meio/fim. O perfil `trajectoryHeights` vem do
documento canônico; o renderer mantém apenas a prévia do gesto, seguindo a
interação das alças de Ataque. O arraste lateral move X/Z na direção da câmera;
o vertical ajusta Y sem desvio lateral. `trajectory-point` confirma os eixos
em uma edição; início ligado move a bola, e o 2D conserva a mesma geometria.
[Contrato de trajetória autoral](../../docs/ui/QUADRA_TRAJETORIA_AUTORAL_3D_2026-11-12.md).

`renderer-net-warning.mjs` confere o contato do mesmo traço XYZ com a malha e
as fitas da rede. O aviso é informativo, acompanha prévias e câmera, respeita
ocultação e não participa do picking, histórico ou simulação física.

`renderer-geometry.test.mjs` verifica a transformação exata, o ajuste de grade,
os caminhos autorais e os limites de seleção com `node --test`.

`renderer-simulation-geometry.test.mjs` verifica alças e a prévia geométrica da
curva do ataque. A prévia deforma a intenção fornecida pelo host; o voo, os
contatos reais e a gravação continuam no motor/controlador compartilhados.

`renderer-camera-motion.mjs` amostra velocidade angular e integra uma inércia
exponencial curta para a câmera orbital, sem estado autoral. Seus testes puros
(`node --test public/visual-court-3d/renderer-camera-motion.test.mjs`) cobrem
taxas de quadros, pausa antes de soltar, reversão, limites e parada exata.
