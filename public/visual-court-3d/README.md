# Quadra 3D

Esta superfície apresenta o documento canônico do editor. O componente React
envia quadros por `postMessage`; esta página devolve comandos transacionais.
Não há armazenamento, formação própria, simulação independente ou histórico.

O módulo Three.js mantém a licença MIT em `THREE-LICENSE.txt`. As silhuetas e a
textura da bola são os mesmos recursos de referência do mockup aprovado; suas
origens estão registradas em `reference/sources.json`. Não são apresentadas como
arte original do Go Atleta. O logotipo e a fonte do site de referência não são
utilizados nesta superfície.

`renderer-geometry.test.mjs` verifica a transformação exata, o ajuste de grade,
os caminhos autorais e os limites de seleção com `node --test`.

`renderer-simulation-geometry.test.mjs` verifica alças e a prévia geométrica da
curva do ataque. A prévia deforma a intenção fornecida pelo host; o voo, os
contatos reais e a gravação continuam no motor/controlador compartilhados.

`renderer-camera-motion.mjs` amostra velocidade angular e integra uma inércia
exponencial curta para a câmera orbital, sem estado autoral. Seus testes puros
(`node --test public/visual-court-3d/renderer-camera-motion.test.mjs`) cobrem
taxas de quadros, pausa antes de soltar, reversão, limites e parada exata.
