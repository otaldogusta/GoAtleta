# Perfil da equipe — proposta visual

Mockup interativo: `equipe-profile.html`. Usa somente dados fictícios e estado em memória; nenhuma ação consulta ou grava no backend.

- A página pertence à pessoa: identidade, apresentação, contexto institucional, turmas e atividade. Não abre com um formulário de permissões.
- A própria pessoa vê **Editar perfil** e configurações de conta. A coordenação vê **Gerenciar acesso**, que abre um painel separado de turmas e permissões.
- O avatar abre o modelo de **Foto do perfil** de `app/profile.tsx`: Câmera, Galeria e Remover foto quando houver imagem. A galeria permite prévia local antes de aplicar; na coordenação, a foto de outra pessoa é somente visualizada. O botão Câmera usa o seletor nativo com `capture`; não substitui o componente de captura do aplicativo nem comprova captura por hardware.
- **Editar perfil** demonstra o agrupamento existente de Dados pessoais (nome, celular, nascimento, gênero, CPF, RG e endereço), seguido da apresentação. Cancelar preserva o estado original; dados privados não aparecem na visualização geral. Integração futura deve reutilizar a validação e persistência reais do perfil, sem duplicar essas regras no produto.
- O seletor Pessoa / Coordenação no topo pertence ao protótipo e demonstra a diferença de ações; não faz parte do produto final.
- Os números, a apresentação, a localização e o histórico são ilustrativos. Sua integração exige mapear disponibilidade e autorização dos dados existentes; não implicam funcionalidades entregues.
- Referências: três imagens fornecidas pelo usuário (perfil com avatar, resumo e histórico; configurações separadas). O link Figma Community 1351600592329154355 não pôde ser recuperado na consulta.

Estado: proposta local para revisão visual. O modal implementado anteriormente no aplicativo continua separado deste mockup. Não há nova rota de perfil integrada ao aplicativo.
