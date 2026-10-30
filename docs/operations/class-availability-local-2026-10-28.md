# Disponibilidade da turma — 28/10/2026

Implementação local, sem publicação ou alteração de dados/permissões.

O detalhe mostrava apenas “Turma não encontrada” tanto para consulta vazia
quanto para erro de leitura ou instituição ainda carregando. O fallback offline
também convertia ausência de cache em ausência da turma.

A rota agora aguarda autenticação/instituição e mantém as guardas de identidade,
geração do cache e desmontagem. Falha de leitura oferece nova tentativa;
consulta vazia identifica a instituição atual e permite voltar à lista do mesmo
perfil. Não procura dados em outras instituições nem muda o contexto sozinho.
Sem instituição ativa, orienta a seleção de um contexto autorizado.

O estado visual reutiliza cabeçalho e botões existentes, em bloco de até 440px,
com rolagem para telas menores. Retorno substitui o detalhe pela lista correta;
nenhuma gravação ocorre ao repetir a consulta.

`getClassById` conserva o fallback offline somente quando a turma existe no
cache da instituição consultada; cache vazio relança o erro original. Um 200
com lista vazia continua indicando indisponibilidade no escopo autorizado,
sem afirmar exclusão ou consultar outra organização.

24 testes focados aprovados cobrem prontidão, resposta vazia, falha seguida de
recuperação, resposta obsoleta, cache offline, negação e ações da interface.
Tipos e escopo aprovados. Smoke autenticado local confirmou uma consulta 200
vazia sob instituição diferente daquela em que o link havia sido aberto antes.
Essa evidência não determina se o recurso permanece disponível em outro contexto.
Capturas e diagnóstico privados em `.tmp/class-unavailable/`.
