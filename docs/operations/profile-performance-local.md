# Perfil: desempenho local — 09/10/2026

Escopo: `/prof/profile` em localhost:8081, modo de desenvolvimento, sessão existente.
Sem envio de formulário, alteração de conta ou publicação. Não mede produção nem cold start.

## Achados e mudança

- Cards usavam animação JS na web e montagem em um commit adicional; expansão web agora é direta. Animação nativa permanece.
- Treze usos de MobileProfileSection preparavam JSX de conteúdo mesmo recolhidos. Conteúdo agora é uma função chamada somente quando o card está renderizado. Estado dos rascunhos continua no perfil.
- Conteúdo compartilhado de conta/segurança também é criado sob demanda.

## Medição via CDP Performance

Cinco ciclos de recolher/abrir Dados pessoais, com validação visível, mesma sessão e viewport. Tempos abaixo são trabalho acumulado de script no intervalo dos comandos, não latência de entrada/INP. Automação e React de desenvolvimento influenciam o resultado.

| Estado | Script por ciclo (ms) | Mediana |
| --- | --- | --- |
| Expansão direta, antes de adiar JSX | 151, 138, 145, 137, 144 | 144 |
| Conteúdo adiado | 125, 113, 122, 115, 129 | 122 |

Amostra de rede durante os cinco primeiros ciclos: zero requisições.
Após mudança: inserir/apagar um espaço no nome, cinco amostras: 63, 53, 55, 57, 83 ms de script; valor restaurado em cada ciclo, sem salvar.
Repouso observado por 28,4 s: 79 ms de script agregado, sem evidência de loop pesado nessa janela.
Rolagem abaixo/acima: 9,3 ms de script, 0 ms de layout na amostra.

## Conferência funcional

Dados pessoais, Preferências, Conta e segurança e Integrações abriram corretamente. Troca Visão geral/Configurações e recolher/abrir mantiveram o nome em edição. Nenhuma integração, senha, envio de código ou salvamento acionado.

Limites: sem benchmark de build release, dispositivo nativo ou avaliação de carregamento frio. As medições não certificam ausência de todo travamento.
