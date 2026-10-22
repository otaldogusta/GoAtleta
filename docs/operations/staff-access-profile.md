# Acesso no perfil da equipe — 22/10/2026

Implementação local: a gestão de funcionários abre a aba **Acesso** no próprio
perfil. `PersonProfilePage` aceita conteúdo opcional de acesso e de turmas;
perfis que não fornecem esse conteúdo mantêm as abas e ações anteriores.

As 13 permissões existentes aparecem uma vez, agrupadas em Ensino, Comunicação
e Administração, com suas descrições canônicas. Coordenação exibe acesso efetivo
completo; a proteção da própria gestão continua ativa. A dependência entre
criar turmas e acessar Turmas é explicada, sem concessões automáticas.

Turmas atribuídas são editadas na aba Turmas. A lista usa linhas compactas por unidade,
avatar com inicial (a turma ainda não tem foto canônica no modelo), dias/horários,
contagem paginada de alunos ativos (união de turma principal e matrículas ativas, sem duplicar alunos) e nomes da equipe atual por papel.
`class-assignment-details.ts` consulta somente identificadores dos alunos/matrículas, com filtro
de organização, e reutiliza o RPC de identidades de equipe. Falhas independentes
não viram zero alunos ou equipe vazia. Detalhes são relidos após salvar,
e respostas de editores anteriores são descartadas.
As duas abas compartilham o mesmo
rascunho e a mesma gravação administrativa por RPC, com idempotência. Uma única
`FloatingSaveBar` fica fora da rolagem e aparece quando o snapshot normalizado
difere do baseline. Trocar abas preserva o rascunho; sair pede confirmação.
Falhas mantêm as escolhas. Gravação bem-sucedida atualiza o baseline antes do
refresh; falha de refresh não repete a escrita. Controles bloqueiam durante envio.

Leituras antigas são invalidadas ao trocar usuário/instituição ou desmontar;
rascunhos de outra identidade/instituição não liberam salvamento. Guardas de
navegação, histórico web e recarregamento protegem alterações pendentes.

Validação local: quatro testes adicionais de contagem/equipe cobrem paginação,
união sem duplicação, filtro por organização, falta de contexto e indisponibilidade.
Testes de abas/rascunho, cobertura dos grupos, descrições,
dependência, acesso administrativo, proteção da própria gestão, snapshot e menu.
Tipos, lint, escopo organizacional e performance focada aprovados. Localhost
autenticado: aba integrada, rolagem única, barra fixa, troca de abas e proteção
de saída conferidas; falha de conexão simulada na aba preservou a alteração e
permitiu tentar novamente. A rede foi restaurada e o rascunho desfeito.

Nenhuma permissão real foi gravada no smoke. Sucesso real do RPC não foi
exercitado nesta etapa. A reorganização não cria permissões nem exige migration.
Publicação do pacote de perfil, acesso e presença autorizada pelo usuário em
22/10/2026; disponibilidade depende do resultado do deploy, além dos checks locais.
A ativação do backend de presença está registrada em [member-presence.md](member-presence.md).
