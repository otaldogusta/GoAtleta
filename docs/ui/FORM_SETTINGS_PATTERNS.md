# Formulários e configurações

## Referência e limites

O perfil do atleta (`app/profile.tsx`, rota `/student/profile`) reúne os
padrões aprovados para formulários e configurações. A Home do professor continua
como referência de densidade e hierarquia; não substituir dashboards e listas
operacionais por sanfonas de perfil.

Este documento define comportamento esperado, não certifica que toda a tela ou
todo o app já o cumpre. Reutilizar componentes após verificar suas limitações.
Não copiar o arquivo inteiro, estilos locais ou regras específicas do atleta.

## Organização e conteúdo

- Agrupar campos por assunto, com título direto e descrição curta quando útil.
  Dados pessoais, responsável, instituição, modalidades, saúde e segurança são
  assuntos distintos; preferências relacionadas podem usar separadores.
- Preferir hierarquia textual a cards dentro de cards: instituição > unidade >
  turmas vinculadas. Não listar dados de outras instituições nem todas as turmas.
- Estado vazio apresenta situação e próxima ação, sem blocos vazios redundantes.
- Perguntas de sim/não devem fazer sentido como perguntas. Revelar apenas os
  campos dependentes necessários, preservando os rascunhos ao recolher.
- Não expor termos de infraestrutura, nomes internos de provedores ou instruções
  administrativas em mensagens destinadas ao atleta.
- Usar tokens de tema e layout; o limite de 440 px de autenticação não é limite
  universal para a página de configurações.

## Rascunhos, salvar e navegação

- Comparar valores normalizados com o último estado confirmado pelo servidor.
  Alterar um campo deve atualizar imediatamente o estado de salvar; clicar em
  outro card não pode ser necessário para detectar mudanças.
- Um formulário com vários cards tem uma ação flutuante de salvar, não uma por
  card. Ocultar quando limpo; enquanto salva, mostrar progresso e bloquear
  repetição. Reservar espaço para não cobrir conteúdo, teclado ou navegação.
- Recolher/abrir cards não equivale a sair da tela: não confirmar, descartar,
  gravar automaticamente nem reinicializar campos nessa interação.
- Ao sair de verdade, oferecer continuar editando ou descartar. Aplicar a mesma
  proteção a voltar, sidebar e abas de rotas; proteger fechamento web também.
- Continuar editando sinaliza cada card com mudanças, inclusive recolhidos,
  com balão próximo ao card correto e resumo dos campos pendentes. Não avisar
  em cards sem mudanças. Evitar balões sobrepostos; limpar feedback ao editar.
- Descartar restaura os valores persistidos. Salvar limpa somente o que foi
  confirmado: falha parcial não pode apagar rascunhos ainda pendentes.
- Verificação de contato, vínculo OAuth, senha e exclusão são transações
  independentes. Não submetê-las silenciosamente pelo salvar geral.

## Campos e seleção

- Reusar os padrões de input: container com minHeight 50, radius 12 e padding
  horizontal 14; TextInput interno sem arredondamento para não cortar autofill.
- Evitar contorno nativo duplicado dentro do campo; preservar foco perceptível
  por teclado no container e contraste em ambos os temas.
- Máscara não é validação nem prova de identidade. Aplicar limites coerentes
  com o dado; não inventar uma máscara nacional única para documentos variáveis.
- Seleção pesquisável usa ícone de busca, lista ancorada e badges para valores
  selecionados. Remoção tem alvo acessível e nome específico.
- Valores derivados de planos/vínculos ficam identificados e protegidos contra
  remoção manual quando a regra do domínio exigir. Não tornar todos os badges
  bloqueados só porque o perfil tem essa possibilidade.
- Setas mudam a opção ativa e a rolagem acompanha; Enter confirma; Escape fecha.
  Tab avança sem prender o foco; autocomplete por Tab só com candidato claro e
  comportamento consistente. Shift+Tab mantém navegação reversa.
- Tratar vazio, busca sem resultado, limite de seleção e rótulos longos.

## Feedback e operações sensíveis

- Progresso imediato com spinner e verbo contextual: Salvando, Removendo,
  Desvinculando ou Conectando. Bloquear cliques duplicados até concluir.
- Confirmação aguarda o resultado. Erro permanece na ação e permite nova
  tentativa; sucesso usa feedback global discreto, sem mensagens duplicadas.
- Balões de preenchimento pertencem ao campo/card, não deslocam o layout,
  não são cortados pelo overflow e desaparecem ao corrigir o dado.
- Código de confirmação: células visuais com entrada acessível, colagem e
  autofill. Ao completar, permitir envio único automático, sem loops de
  tentativas; manter recuperação em caso de erro e reenvio com contador.
- Contato confirmado pode ter apresentação discreta, ícone com significado
  acessível e ação de remover. Nunca marcar confirmado apenas no cliente.
- Conectar provedor no perfil significa vincular à sessão atual, não iniciar
  login de outra conta. Desvincular exige preservar outro acesso utilizável.
- Disponibilidade depende do servidor: não habilitar provedores ou alterar
  configurações de produção apenas para adequar a aparência.

## Movimento e acessibilidade

- Transições curtas (140–200 ms), com opacidade/deslocamento discreto, sem
  bibliotecas adicionais ou medições contínuas só para revelar campos.
- A saída deve terminar antes de desmontar; alternância rápida não pode deixar
  conteúdo preso. Respeitar movimento reduzido e bloquear interação com
  conteúdo fechado, inclusive foco e leitores de tela.
- Cards informam expandido/recolhido; toggles informam seu estado. Ícones não
  substituem rótulos acessíveis e cor não é a única indicação de estado.

## Mapa de reutilização

| Necessidade | Fonte existente |
| --- | --- |
| Salvar flutuante | `src/ui/FloatingSaveBar.tsx` |
| Confirmação com progresso e erro | `src/ui/confirm-dialog.tsx`, `Button.tsx` |
| Listas ancoradas | `src/ui/AnchoredDropdown.tsx` |
| Busca, badges e teclado | `src/ui/PositionPicker.tsx` |
| Feedback de campos | `src/ui/form-validation-feedback.tsx` |
| Revelação de detalhes | `src/ui/AnimatedFieldDetails.tsx` |
| Proteção de saída | `src/navigation/pending-edits-navigation.ts` |
| Contato verificado e OTP | `src/screens/student/SecurityContactFields.tsx` |
| Agrupamento por unidade | `src/screens/student/useInstitutionClasses.ts` |

Os componentes do módulo student são exemplos de domínio, não imports
obrigatórios para telas não relacionadas. Extrair primitives somente quando
houver necessidade real; manter consultas fora dos componentes visuais.

## Checklist para aplicar em outra tela

1. Identificar quais padrões são pertinentes e preservar permissões e domínio.
2. Testar alteração/reversão de campo, troca de cards, salvar, erro, descarte e
   navegação por todas as entradas disponíveis.
3. Testar busca, remoção de badge, setas com scroll, Tab/Shift+Tab, Escape e
   colagem de código quando existirem.
4. Testar rede lenta, rejeição do servidor e cliques repetidos sem mutações reais
   de conta durante o smoke.
5. Conferir localhost em 390×844, 834×1194 e 1440×1024, claro/escuro, texto longo,
   teclado e movimento reduzido. Verificar barra flutuante e overlays.
6. Rodar testes pertinentes, typecheck, perf-hygiene e diff check; org-scope
   quando houver dados ou navegação. Informar o que não foi validado.

A adoção no restante do app deve ocorrer por fluxo, com verificação. Atualizar
esta documentação não significa que todas as telas já foram corrigidas.
