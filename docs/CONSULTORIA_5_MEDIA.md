# CONSULTORIA 5 - Midia demonstrativa minima

Este pacote adiciona apoio visual por exercicio para reduzir ambiguidade na execucao remota.

## Escopo entregue

- Cada exercicio prescrito pode receber uma URL de demonstracao.
- A URL pode apontar para video curto, GIF, imagem ou pagina externa segura.
- A tela da aluna mostra o botao `Ver demonstracao` apenas quando o exercicio possui link.
- O link e aberto fora do app pelo sistema operacional.
- O treino continua valido quando nao ha midia.

## Como preencher

Na prescricao do professor, cada linha de exercicio ganhou o campo:

`Demonstração opcional: link de vídeo, GIF ou imagem`

O campo fica fora das colunas principais da ficha para preservar a leitura:

`Atividade | Séries | Repet. | Interv. | Obs.`

## Regras de seguranca

- Midia e apoio, nao substitui orientacao profissional.
- O app nao baixa video pesado por padrao.
- O app nao embute arquivos no binario.
- Links devem ser remotos.
- Se o link nao puder abrir, a aluna recebe mensagem amigavel.

## Persistencia

O contrato ja possuia `PrescribedExercise.mediaUrl`.

A migration de CONSULTORIA 2 ja possuia `prescribed_exercises.media_url`.

Por isso este pacote nao cria nova migration.

## O que fica para CONSULTORIA 5.2

- Catalogo de exercicios.
- Musculos principais.
- Equipamento.
- Nivel de dificuldade.
- Thumbnail dedicada.
- Busca/filtros.
- Sugerir exercicio da biblioteca durante a prescricao.
