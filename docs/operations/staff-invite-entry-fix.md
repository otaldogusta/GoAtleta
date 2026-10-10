# Entrada pelo link de equipe

Correção preparada em 09/10/2026.

A tela apagava o fragmento sensível da URL e mantinha a prova apenas no próprio
estado. Uma remontagem durante os gates de sessão perdia o convite. O provider
acima do bootstrap mantém a prova em memória, sem storage, até sair ou concluir.
Nenhum aceite é feito no carregamento e as validações do servidor permanecem.

Quatro regressões cobrem remontagem após limpar URL, conclusão, saída/retorno e
código sem prova. Outras 23 verificações de parser e contrato Edge passaram no
checkout de desenvolvimento, além de tipos, org-scope, build e perf-hygiene.
Entrada no navegador conferida com link fictício, sem enviar aceite. A causa
exata na sessão relatada pelo usuário não foi reproduzida. Link real não aberto.

A publicação deve usar somente esta correção, separada dos ajustes de cadastro.
Status remoto e validação do checkout isolado constam no fechamento da entrega.
