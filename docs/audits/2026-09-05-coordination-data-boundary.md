# Coordenação: fronteira de carregamento

Continuação estrutural da auditoria sobre `0ab14944`. A rota da coordenação passou de 1.927 para 1.714 linhas físicas, retirando dela a consulta de dez fontes, a combinação dos horários, a montagem do radar e o gerenciamento das respostas concorrentes.

## Responsabilidades

- `application/load-coordination-dashboard.ts`: carrega o conjunto operacional completo. Erros em membros, convites, solicitações ou chamada continuam sendo falhas; não viram listas vazias com aparência de sucesso. Mantém o fallback existente de atribuições para responsáveis, sempre na organização solicitada.
- `application/load-coordination-insights.ts`: consulta atividade, relatórios dos últimos sete dias e sinais. É carregado sob demanda, depois do conjunto operacional, e sua falha não bloqueia a gestão de pessoas.
- `application/coordination-radar.ts`: agrupa os relatórios por turma e seleciona os seis menores indicadores pelo motor pedagógico existente. Usa `Map`, evitando colisões de identificadores com propriedades de objetos.
- `hooks/useCoordinationDashboard.ts`: publica dados e estados de carregamento apenas para a identidade, organização, autorização e requisição atuais. O retorno visual fica vazio imediatamente ao trocar de contexto. Respostas antigas, falhas atrasadas e conclusões após desmontagem são descartadas.
- `app/coordination.tsx`: compõe a tela e dispara atualização. O conteúdo também recebe uma chave de identidade, organização e acesso para encerrar os estados visuais e de IA anteriores na troca de contexto.

O acesso continua derivado das associações reais da conta; uma prévia de papel não concede autorização. Não foram alterados layout, textos, permissões remotas, credenciais, SQL ou regras financeiras.

## Validação

- 20 suítes / 101 testes relacionados à coordenação passaram, incluindo 21 novos cenários de carregamento, concorrência, escopo e radar.
- Na conferência final do pacote, a suíte completa passou: 416 suítes / 2.363 testes. A etapa SQL do comando `validate:app` encontrou timeout local na inicialização da suíte LGPD, após chamada e finanças passarem. A repetição de `npm run test:sql`, sem alterar código ou limite de tempo, aprovou as três suítes PostgreSQL isoladas, incluindo LGPD.
- `typecheck:app`, lint global com zero erros e zero avisos, arquitetura strict e escopo organizacional passaram.
- Arquitetura: 916 módulos, 3.612 imports internos e zero violações. Performance strict passou usando `0ab14944` como base.
- Build web exportado com dois workers em `C:/Users/gusta/AppData/Local/Temp/goatleta-coordination-extraction-20260905-web-build`.
- Smoke autenticado em `localhost:8081/coord/management`: dados operacionais, pessoas, turmas e abertura/fechamento do convite pelo botão e por Esc. Nenhum convite, aviso ou cobrança foi enviado.
- Larguras CSS medidas em 390×844, 834×1194 e 1440×1024, sem overflow horizontal. A automação usa escala de navegador diferente de 100%; as dimensões foram conferidas no documento, não inferidas do tamanho da captura.
- Temas escuro e claro conferidos. Tema original e tamanho padrão do navegador restaurados ao final.

## Publicação anterior e continuidade

O commit `0ab149441beeb6cbb0432eeb04a64a68e71fb2d9` foi confirmado `READY` no Vercel, associado a `goatleta.com`. O workflow EAS `34003560775` terminou com sucesso: validação completa, build, concorrência PostgreSQL e publicação OTA. Essa confirmação pertence ao commit anterior, não à extração descrita neste documento.

O pacote completo segue a publicação Git de `main`: o mesmo commit aciona Vercel e EAS, com os respectivos gates. Não exige migração SQL, deploy de Edge Functions ou alteração de configuração. O estado remoto desta nova publicação deve ser conferido no commit correspondente.

Próximo recorte estrutural da coordenação: envio de lembretes (há dois fluxos com cooldown e payload equivalentes) e exportações de IA. Outras rotas extensas e as entregas de produto financeiro/familiar continuam sendo frentes separadas; este pacote não encerra toda a redução estrutural do app.
