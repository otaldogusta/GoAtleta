# Benchmark do Engineer — prontidão local

Conferência de 01/10/2026: 24 commits-base e referências locais, sem rede, chaves ou chamadas à API. Skills usadas: goatleta-testing; validação focada nas ferramentas de engenharia, sem alterar o runtime do produto.

Os critérios abaixo são uma rubrica inicial de avaliação, não implementação sugerida. O JSON complementar registra dependências e comandos encontrados no package.json de cada commit-base; esses comandos foram lidos, não executados. Comandos de teste precisam de revisão antes de uso, pois podem gravar dados ou iniciar serviços.

| Caso | Critério de aceitação | Ambiente e evidência necessários |
| --- | --- | --- |
| GA-001 | Negar leitura e escrita entre organizações; preservar acesso autorizado aos ciclos. | PostgreSQL descartável + fixtures de duas organizações; testar grants e RPC diretamente. |
| GA-002 | Abrir lista, detalhe e criação de scouting com a turma e sessão corretas; tratar identificador inválido. | Expo/Jest do commit-base + smoke das rotas em backend isolado. |
| GA-003 | Exibir e abrir ação rápida de scouting sem perder contexto da turma ou demais ações. | Expo web/mobile; verificar navegação e alvo do botão. |
| GA-004 | Preservar campos, validação e persistência ao extrair relatório; evitar estado duplicado. | Jest de componentes + interação de relatório; confirmar mocks de persistência. |
| GA-005 | Preservar placar, entradas e navegação ao extrair scouting; manter contratos do componente. | Jest de sessão/componentes + smoke de scouting. |
| GA-006 | Ações inferiores continuam visíveis e clicáveis acima do CTA, inclusive viewport curto. | Expo com viewport móvel e desktop; evidência visual necessária. |
| GA-007 | Salvar, carregar e editar relatório mantém comportamento; erro não elimina conteúdo digitado. | Jest do hook + integração local de persistência sem backend remoto. |
| GA-008 | Conversão preserva blocos, duração e explicação pedagógica; lidar com campos opcionais ausentes. | Testes de função pura TypeScript + fixtures pedagógicas revisadas. |
| GA-009 | Rerender sem alteração preserva identidade das datas; mudança de entrada atualiza as datas. | Jest/React para contrato de memoização; calendário com valores limítrofes. |
| GA-010 | Troca de organização descarta requisição antiga; dashboard preserva sucesso, vazio e erro. | Jest dos loaders/hooks e isolamento de requisições com respostas fora de ordem. |
| GA-011 | Atleta altera somente a própria foto; outro usuário não escreve; avatar privado é atualizado. | SQL local de autorização + Storage isolado ou mock declarado; testes de cache da foto. |
| GA-012 | Convite válido conclui cadastro; convite expirado ou de outra identidade não concede acesso. | Jest + Deno dos contratos presentes + fluxo local de convite com backend descartável. |
| GA-013 | Chamada direta sem vínculo não libera perfil; convite mantém isolamento entre organizações. | SQL/Edge isolados + testes negativos Auth e smoke de onboarding; tarefa ampla. |
| GA-014 | Foco e digitação mantêm campo visível com teclado; rolagem não oculta ação de salvar. | Emulador/dispositivo e Expo da época; browser isolado não comprova teclado nativo. |
| GA-015 | Troca de conta elimina dados e papel anteriores; OAuth chega à organização correta. | Jest Auth/Organization + fluxo local com dois usuários fictícios; tarefa ampla. |
| GA-016 | Atleta abre e fecha menu no mobile; ação continua acessível com leitor e alvo de toque. | Jest do componente + smoke mobile sem credenciais de produção. |
| GA-017 | Jest deixa de descobrir teste Deno; teste continua descoberto e executável no Deno. | Jest --listTests + Deno; confirmar permissões e revisar script antes de executar. |
| GA-018 | Normalizar dígitos confirmados com sinal +; preservar telefone já normalizado e negar não confirmado. | Node 22 com strip-types, sem dependências; harness avaliador calibrado offline. |
| GA-019 | Destino do hook é extraído do payload correto; payload ausente/malformado falha sem enviar mensagem. | Deno com provedor de SMS mockado; nenhuma chamada de WhatsApp/SMS real. |
| GA-020 | Harness espera servidor final; warnings esperados são assertados sem esconder warnings inesperados. | Docker PostgreSQL descartável + harness revisado + Jest focado. |
| GA-021 | Reprodução/pausa e exportação preservam atores, posições e etapas; regras 5x1 permanecem coerentes. | Jest de quadra/exportação + browser/canvas; não sobrescrever desenhos reais. |
| GA-022 | Limites ACWR persistem por turma em plataformas existentes; turma vizinha não é alterada. | SQLite nativo/web e SQL local histórico; fixtures por turma. |
| GA-023 | Versões de migrations são aceitas pelo CLI; renomeação não muda SQL nem simula aplicação remota. | Supabase CLI somente inspeção/local; conferir histórico antes de qualquer aplicação. |
| GA-024 | Última edição salva reaparece na turma/data correta; falha de gravação não é exibida como sucesso. | Persistência SQLite histórica + telas de sessão/relatório com fixtures. |

## Lacunas verificadas

- 11 dos 24 patches não alteram arquivos de teste reconhecidos pelo catálogo. Isso não significa ausência de testes no repositório; exige localizar ou criar um avaliador focado antes do replay.
- GA-013 e GA-015 são tarefas amplas (39 e 48 arquivos de referência): não usar no primeiro piloto nem tratar quantidade de arquivos como allowlist automática.
- GA-017 contém renomeação de teste; GA-023 contém renomeações de migrations. A lista sem detecção de rename inclui origem e destino, portanto não representa apenas arquivos simultaneamente existentes.
- O snapshot deve usar as dependências da época. O perfil router do Engineer não contém Expo, Jest, Deno, SQLite ou PostgreSQL necessários à maioria destes casos.
- Critérios de segurança não podem ser aprovados apenas por grep ou por resultado visual. SQL/Storage/Auth exigem ambiente isolado e casos negativos específicos.
- Nenhuma nota de qualidade de modelo foi atribuída. Os 24 casos continuam sem replay pago.

## Calibração executada: GA-018

Fonte base: `666d6835ff618e781ba620e6866ce2f724dad7c3`; referência: `1f83fa5d70bd9eb9fc114566342c6dbd87e675fd`. Somente o módulo puro de telefone foi extraído por git show para `.tmp/benchmark-ga018`; não houve checkout, edição do app ou cópia de credenciais.

Imagem local imutável: `sha256:4290f6c7b74916aa606dd5419848543896c1f4afbc30fb4398806e0be0daf121` (Node 22). Container sem rede, não root, mounts somente leitura, sem chaves. Harness: `scripts/validation/engineer-phone-regression.mjs`.

| Variante | Asserções aprovadas | Falhas | Resultado da calibração |
| --- | --- | --- | --- |
| Código anterior | 7/10 | Normalização sem +, telefone formatado e comparação | PASS: regressão detectada |
| Correção histórica | 10/10 | Nenhuma | PASS: referência aceita |

Asserções também cobrem entrada normalizada, timestamp, ausência de confirmação, metadados editáveis, vazio, null e undefined. Fixtures fictícias. Isso testa o contrato histórico da função; não certifica todo o fluxo de autorização ou verificação telefônica atual.

Esta é calibração do avaliador com gabarito no lado avaliador, não uma solução produzida pelo Engineer. O harness e o patch histórico não devem ser enviados ao agente de implementação em um replay cego. Evidência privada: `.tmp/benchmark-ga018/calibration.json`.

## Restrição financeira

Gustavo reafirmou o bloqueio estrito. Run 005 segue preparada, sem sessão. Nenhum teto foi relaxado e nenhum piloto pago foi iniciado. Próximo trabalho possível sem cobrança: calibrar outros avaliadores com snapshots históricos locais e ambientes descartáveis; isso continua separado de avaliar respostas de modelos.
