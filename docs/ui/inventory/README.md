# Inventário Visual em outra máquina

A `main` guarda o [template do inventário](hub-template.html) e o
[gerador](../../../scripts/build-ui-inventory-hub.py). O HTML gerado, o
catálogo e as capturas ficam no pacote privado de evidências. Transfira o
ZIP por um canal privado e mantenha seus caminhos relativos ao extrair.

Na pasta extraída, sirva o inventário em loopback:

```sh
python -m http.server 8096 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8096/inventario.html`. As capturas funcionam com
o servidor de arquivos local. A prévia interativa usa o Go Atleta em
`127.0.0.1:8082`, conectado ao Supabase local de QA e autenticado com dados
fictícios. Prepare esse ambiente no novo computador antes de abrir a
prévia. A instalação do app e o contexto da máquina estão no
[guia de estações](../../operations/workstations.md).

Para regenerar o hub a partir de um pacote que inclui `catalogo.json`,
execute na raiz do checkout, substituindo o caminho da pasta:

```sh
python scripts/build-ui-inventory-hub.py --root <pasta-extraida> --catalog <pasta-extraida>/catalogo.json
```

O pacote preserva os recortes indicados no HTML. Guarde as evidências
históricas em seu local de origem.
