# Go Atleta — diagnóstico jurídico, LGPD, privacidade e acessibilidade

Data de corte: **21/10/2026**, America/Sao_Paulo. Fase 1: inventário e prioridades,
antes de correções. Base inspecionada: `a17c2401`, branch
`codex/auditoria-juridica-lgpd-2026-10`. Árvore inicialmente limpa.

## Resultado e limites

Há controles reais de autenticação, organização, CPF, fotos privadas e exclusão.
Existem também falhas materiais: anonimização incompleta, exportação com sucesso
indevido e envio automático de dados identificáveis à IA sem minimização adequada
no caminho examinado. Políticas publicadas não demonstram funcionamento dos direitos.

Esta entrega altera somente documentação, checklist e uma reprodução sintética.
Nenhuma correção do produto, migration aplicada, consulta a dados de usuários,
operação destrutiva, alteração de ambiente, deploy ou validação de produção ocorreu.
O inventário é inicial: não constitui cobertura de cada tela, policy, dependência,
ativo ou operação do produto. As fases 2–5 continuam pendentes.

Estados usados neste relatório:

- **Implementado:** encontrado no código/migrations desta base.
- **Testado localmente:** execução descrita em “Verificação”, com seu limite.
- **Validado em produção:** nenhum item recebeu esse estado nesta auditoria.
- **Pendente de verificação:** precisa de execução, configuração, contrato ou prova externa.
- **Não encontrado:** busca delimitada sem evidência; não prova inexistência fora dela.

Gravidade: crítico exige indício concreto de exposição ampla ou comprometimento
imediato; alto indica impacto relevante ou barreira significativa; médio indica
controle parcial ou risco dependente de condições; baixo indica impacto limitado.
Não foi demonstrado incidente crítico nem bypass entre organizações. O advisory
crítico do npm é separado da classificação de explorabilidade do aplicativo.

## Fontes e enquadramento

O [ctresb/leis](https://github.com/ctresb/leis) ajuda a localizar normas. Seu
[README](https://github.com/ctresb/leis/blob/main/README.md) informa que conversões
automáticas/OCR são informativas e requerem conferir a fonte. Nenhum script desse
repositório foi executado, nem seu conteúdo incorporado como autoridade jurídica.

Fontes oficiais consultadas nesta etapa:

| Fonte | Aplicação ao diagnóstico |
| --- | --- |
| [LGPD, Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm) | Arts. 6–11, 14–20, 33–39, 41 e 46–50: necessidade, transparência, bases, direitos e governança. |
| [Enunciado ANPD 1/2023](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes) | Bases dos arts. 7º e 11 podem ser utilizadas para menores, sempre com prevalência de seu melhor interesse. |
| [ECA, Lei 8.069/1990](https://www.planalto.gov.br/ccivil_03/leis/l8069.htm) | Arts. 2º, 17 e 18: faixas etárias e proteção de identidade, imagem e dignidade. |
| [ECA Digital, Lei 15.211/2025](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm) | Arts. 1º, 3º–8º, 10–16 e 41-A; acesso provável por menores e proteção proporcional. Vigência em 17/03/2026, conforme texto atualizado. |
| [Decreto 12.880/2026](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12880.htm), [página ANPD](https://www.gov.br/anpd/pt-br/assuntos/eca-digital/) e [atualização de setembro/2026](https://www.gov.br/anpd/pt-br/assuntos/noticias/eca-digital-completa-um-ano-e-e-marco-na-protecao-de-criancas-e-adolescentes-na-internet) | Regulamentação e implantação. Cronograma de monitoramento não suspende a lei. A publicação definitiva de guias e regras adicionais deve ser novamente conferida no fechamento jurídico. |
| [Guia ANPD de cookies](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf/@@display-file/file) | Inventário e escolhas conforme finalidade/base; não pressupõe banner universal. |
| [Resolução ANPD 19/2024](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024) | Mecanismo e transparência de transferências internacionais; contrato de fornecedor não foi verificado. |
| [Resolução ANPD 18/2024](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/encarregado-completo_ocultado.pdf) | Papel e designação do encarregado, conforme enquadramento aplicável. |
| [Resolução ANPD 15/2024 e orientações de incidentes](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis) | Avaliar risco/dano relevante e comunicação; regra geral de três dias úteis, observadas exceções aplicáveis. |
| [Marco Civil, Lei 12.965/2014](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm) | Art. 15: avaliar guarda de registros de acesso por seis meses quando houver enquadramento; não estender esse prazo a todo dado do produto. |
| [LBI, Lei 13.146/2015, art. 63](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm) e [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Obrigação de acessibilidade e referência técnica AA solicitada; critérios verificáveis por fluxo. |
| [CDC, Lei 8.078/1990](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm) | Arts. 6º, 30, 31, 37, 46, 49 e 51: informação, publicidade e contratação, conforme relação efetiva. |
| [Lei 9.610/1998](https://www.planalto.gov.br/ccivil_03/leis/l9610.htm) | Arts. 7º, 24, 28 e 29: autoria, licença e autorização dos recursos distribuídos. |

O enquadramento geral no ECA Digital é uma inferência forte pelo público descrito e
pelas contas de atletas/familiares existentes. Não foi presumido enquadramento como
rede social, nem aplicada automaticamente a todo cadastro a regra especial para
conteúdo proibido a menores. Aferição proporcional de idade não autoriza coleta
indiscriminada de documentos ou biometria. Normas locais, setoriais e jurisprudência
não foram exauridas nesta fase.

## Inventário inicial de operações

Papéis abaixo são **hipóteses para confirmação contratual**: I = instituição como
controladora de sua gestão esportiva; G = Go Atleta como controlador de suas contas,
segurança e serviço próprio; O = Go Atleta como operador sob instruções de I.
O papel real depende de quem decide finalidade e meios em cada operação.

Bases são candidatas por finalidade, não aprovações jurídicas. Contrato/interesse
legítimo do art. 7º não substituem hipótese específica do art. 11 para saúde.
Direitos comuns: confirmação/acesso, correção, informação e demais direitos cabíveis;
oposição, revogação, eliminação e portabilidade dependem da hipótese e dos limites
aplicáveis. Não há promessa de eliminação indiscriminada de registros legalmente retidos.

| Operação e evidência | Dados / finalidade / necessidade a decidir | Base candidata e papel | Destino | Retenção, controles e direitos observados |
| --- | --- | --- | --- | --- |
| Conta: `src/auth/auth.tsx`, `src/auth/session.ts` | Nome, e-mail, telefone, sessão; acesso. Justificar obrigatoriedade de cada contato. | Contrato e/ou hipótese aplicável à finalidade de segurança, a definir; G | Supabase Auth; armazenamento local | SecureStore nativo e sessão web conforme opção; logout. Prazo de conta e logs a formalizar; excluir conta difere de anonimizar atleta. |
| Cadastro/matrícula: `src/db/students.ts:1191–1236,1296–1320` | Nome, nascimento, RG/RA, CPF, endereço, gênero, contatos; operação esportiva. Necessidade de CPF/RG/endereço/gênero não demonstrada para toda matrícula. | Contrato/obrigação específica a identificar; I/O | Supabase PostgreSQL | Inativação e DSR existentes; abrangência incompleta (JUR-01). Não determinar remoção de campos sem verificar dependências. |
| Anamnese: `202603101700_create_athlete_intakes.sql:1–28` | Riscos, lesões, alergias, notas, identificação duplicada; adequação e segurança das atividades. | Hipótese art. 11 por finalidade; I/O | Supabase `athlete_intakes` | Sem prazo localizado nas três políticas examinadas; ausente da anonimização/exportação principal. Acesso a saúde requer revisão específica. |
| CPF: `useRevealCpf.ts:63–67`, migration `202603061030…:142–195` | Identificação e edição; documentar necessidade. | Base efetiva a comprovar; I/O | RPC Supabase, log de revelação | Máscara/HMAC/cifra, revelação administrativa; base fixa inadequadamente presumida (JUR-08). |
| Família: `relationship-presets.ts`, `claim-student-relationship-invite/index.ts` | Parentesco, e-mail, vínculo e capacidades; acesso delegado. | Hipótese dos arts. 7º/11 por finalidade, condicionada ao melhor interesse; I/O e G na conta | Supabase/Edges | Convite verificado e revogável; vínculo operacional não comprova representação legal. |
| Fotos de atletas: `src/api/student-photo-storage.ts:54–98` | Imagem para identificação; distinguir uso interno/publicidade. | Finalidade e hipótese a documentar; I/O | Bucket privado Supabase | URL assinada de 1 h, avatar canônico removido pelo worker; papel/turma do acesso interno precisa de matriz negativa. |
| Fotos de conta: `src/api/profile-photo-storage.ts:13–21` | Avatar do usuário; justificar exposição pública. | Finalidade/base e G ou I/O a confirmar | `profile-photos`, público por URL | Caminho por usuário/avatar; remover SELECT não torna o objeto privado. Revisar uso por menores. |
| Presença/aulas/avaliações: `src/db/row-types.ts`, `20261007112922_scouting_rallies.sql` | Histórico esportivo, desempenho, notas, possíveis dados de saúde; organização e acompanhamento. | Art. 7º e, quando sensível, art. 11; I/O | Supabase; cache local | Histórico retido; nomes em snapshots sobrevivem ao DSR. RLS precisa de teste real por ator/recurso. |
| Vídeo/anotação: `video/video-draft-storage.ts`, `src/api/scouting-video-sharing.ts` | Imagens/voz potencial, contatos, tracking, desempenho; análise e compartilhamento distintos. | Base e autorização por finalidade; I/O | Arquivo/dispositivo e Supabase Storage | Rascunhos/backups persistem; link revogável, padrão equipe, alternativa por portador sem prazo. JUR-04/11. |
| Vídeo YouTube: `video/youtube-player.web.ts:25` | Reprodução de fonte escolhida; requisições externas e metadados técnicos. | Avaliar por finalidade; papéis do terceiro pendentes | YouTube `iframe_api` | Cookies/storage e requisições efetivas não medidos; fonte local continua alternativa. |
| Insight IA: `assistant/index.ts:1045–1096` | Nomes, telefones e liberação médica no contexto; contato não demonstrado necessário ao insight. | Base por finalidade, inclusive art. 11; I/O/G a definir | OpenAI via Edge | `store:false` não prova retenção externa zero. Disparo automático ao abrir turma; JUR-03. |
| Transcrição: `assistant-transcribe/index.ts:24–52` | Áudio e dados pessoais eventualmente falados; transcrever solicitação. | Base específica e transparência; papéis a confirmar | OpenAI `/audio/transcriptions` | Função examinada não grava áudio/transcrição; contrato e retenção do fornecedor pendentes. |
| Telemetria: `app/_layout.tsx:93–118,1390`, `src/observability/` | URL, eventos técnicos, ID de usuário; diagnóstico/estatísticas. | Segurança ou interesse legítimo com avaliação; consentimento se exigível para a finalidade; G | Sentry/Vercel | Analytics com URL filtrada; Sentry com proteção parcial. Configuração, tráfego e prazos externos pendentes. |
| Comunicação: `app/privacy.tsx:34–38`, `src/utils/whatsapp-templates.ts` | Telefone, destinatário, conteúdo; avisos e convites. | Separar serviço de publicidade; I/O/G | Meta/WhatsApp e canais habilitados | Envio externo documentado genericamente; opt-in de canal, templates, retenção e contratos precisam de conferência. |
| Financeiro: `src/api/finance-provider.ts`, `_shared/asaas-sync.ts` | Contatos, pagador, recebíveis e mensalidade; gestão institucional. | Contrato/obrigação aplicável; I/O e fornecedor | Supabase/Asaas quando conectado | Permissão financeira e importação presentes. Não comprova venda SaaS/captura real; prazos fiscais dependem do enquadramento. |
| Exportação: `lgpd-export/index.ts`, `exportStudentsXlsx.ts:58–73` | Cópias ao dispositivo; acesso/gestão. XLSX inclui contatos, RG e nascimento, sem CPF/saúde nesse exportador. | Direito do titular ou finalidade administrativa; I/O/G | JSON/XLSX no dispositivo | RLS no JSON; cobertura incompleta. Arquivo baixado não é apagado pelo logout/DSR remoto. |
| Offline: `src/db/client.ts:293–327`, `video-draft-storage.ts:27–43` | Cache de dados e rascunhos; continuidade/recuperação. | Mesma finalidade do dado original; I/O/G | AsyncStorage/localStorage/armazenamento web | Cache por identidade e limpeza no logout; cópias de vídeo fora desse filtro. TTL/expurgo e backups pendentes. |

Os prazos nominais encontrados são **180 dias** para `assistant_memory_entries` e
**1.825 dias** para dois logs de acesso (`20260708142100…:28–31`). São configuração
de implementação, não comprovação de necessidade jurídica, agendamento ou execução.

## Registro de riscos e prioridades

Todos os itens abaixo continuam abertos. “Correção proposta” não significa aplicada.

### JUR-01 — alta — conclusão de anonimização mantendo dados pessoais

- **Evidência:** `20260905173939_recover_lgpd_deletion_processing.sql:97–120,137–148` limpa campos antigos e conclui DSR; `20260911162058_add_student_profile_details.sql:1–9` adicionou `address` e `gender_identity` não tratados. `athlete_intakes` mantém identificação e saúde com `student_id` (`202603101700…:1–28`; preenchimento em `src/db/students.ts:2034–2057`). `scouting_actions.athlete_name` guarda snapshot do nome (`20261007112922…:104–115,218–219`).
- **Impacto:** o backend pode registrar conclusão sem tratar todas as cópias e informar incorretamente o atendimento. Retenção legítima de histórico exige fundamento, acesso limitado e informação; não chamar dado identificável de anônimo.
- **Fundamento:** [LGPD, arts. 6º, 12, 16 e 18](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).
- **Proposta:** ampliar inventário por titular e tratamento de cópias; separar exclusão, anonimização e retenção justificada; concluir apenas após etapas verificáveis. Preservar lease/retry e integridade institucional.
- **Verificação:** confirmado estaticamente, sem processamento real. Harness SQL atual cria `students` sem os campos novos (`scripts/validation/lgpd-deletion-sql.mjs:20–28`). Adicionar fixtures de endereço, intake e snapshots; avaliar associação/reidentificação por meios técnicos razoáveis e disponíveis, sem prometer impossibilidade absoluta. Produção pendente.

### JUR-02 — alta — exportação incompleta registrada como concluída

- **Evidência:** `lgpd-export/index.ts:84–96` consulta `session_logs.student_id` inexistente e `student_scouting_logs.student_id`, cujo campo é `studentid` (`2026010601_create_scouting_logs.sql:124–142`; `src/db/row-types.ts`). Descarta erros, retorna `[]`, registra `completed` e responde 200 (`:103–125`). Não cobre intakes nem todas as novas tabelas do atleta.
- **Impacto:** titular recebe arquivo aparentemente completo; organização perde evidência confiável de atendimento.
- **Fundamento:** [LGPD, arts. 6º, 18 e 19](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).
- **Proposta:** corrigir joins/campos, inventariar conjuntos e titularidade, tratar falhas explicitamente e registrar resultado somente após exportação íntegra, preservando RLS e dados de terceiros.
- **Verificação:** **reproduzido localmente com mocks sintéticos** no [reprodutor](evidence/2026-10-21-reproduce-export.mjs): dois erros de consulta resultam em HTTP 200, seções vazias e recibo concluído. Não executa PostgREST/RLS nem prova schema remoto. A assinatura JWT não é validada pelo helper, mas o token é enviado ao PostgREST; não foi demonstrado bypass de autorização.

### JUR-03 — alta — dados de contato e indicador médico enviados automaticamente à IA

- **Evidência:** `app/class/[id].tsx:545` usa `useContextualInsight`; hook `:151–165` dispara após 1,5 s. `assistant/index.ts:1045–1096` inclui nomes, telefone do atleta/responsável e `needs_medical_clearance` na chamada OpenAI. `model-policy.ts:27–44` usa `store:false`. Não há minimização desses campos nem vínculo de finalidade/consentimento nesse caminho.
- **Impacto:** transferência de dados de atletas, inclusive possíveis menores, sem necessidade de contato demonstrada para produzir o insight.
- **Fundamento:** [LGPD, arts. 6º, 9º, 11, 14 e 33](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm); [Enunciado ANPD 1/2023](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes).
- **Proposta:** remover contatos do contexto, preferir agregação/pseudônimos, justificar necessidade residual, mapear base por finalidade e contrato/transferência. Não impor consentimento universal nem trocar o modelo automaticamente.
- **Verificação:** cadeia UI → API → Edge → fornecedor rastreada estaticamente. Vínculo organizacional e JWT/RLS protegem acesso à turma; não há checagem explícita de estado ativo nesse trecho. Este achado não é leitura anônima. Payload real, ativação, configuração de retenção e contratos pendentes; não foi feita chamada de IA.

### JUR-04 — alta — publicação externa de vídeo sem verificação de finalidade/autoridade no código

- **Evidência:** `VideoShareDialog.web.tsx:17,33–47,85–86` oferece equipe como padrão e alternativa por link. `20261014162412_scouting_video_share_no_expiry.sql:3–62` admite prazo nulo; `src/api/scouting-video-sharing.ts:31–32` o usa por padrão. Resolver exige login/vínculo apenas para audiência equipe; não consulta autorização de imagem/finalidade/menoridade na publicação.
- **Impacto:** reencaminhamento permite acesso a filmagens de atletas/menores fora da equipe. Segredo de portador não torna a pessoa filmada anônima.
- **Fundamento:** [ECA, arts. 17–18](https://www.planalto.gov.br/ccivil_03/leis/l8069.htm), [ECA Digital, arts. 3º–8º](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm) e LGPD art. 14.
- **Proposta:** distinguir uso interno, compartilhamento externo e publicidade; vincular decisão de publicação a finalidade e autoridade comprovável, revisar prazo/revogação e exclusão de mídia. Não reutilizar uma autorização genérica como licença irrestrita de imagem.
- **Verificação:** implementação confirmada; nenhum vídeo real acessado ou publicado. Há segredo forte de 32 bytes/hash, revogação, projeção sem `studentId`, Storage privado e URL de mídia curta. Ausência de gate no código não prova ausência de autorização externa; confirmar procedimento institucional.

### JUR-05 — alta, prioridade de governança — proteção de menores e autoridade legal sem comprovação completa

- **Evidência:** cadastro em `SignupScreen.tsx:253–319,954–1000` não demonstra aferição etária. Convite familiar exige identidade verificada (`claim-student-relationship-invite/index.ts:91–106`), mas parentesco declarado/aprovação administrativa não comprovam poder legal. `relationship-presets.ts:28–38,68–75` mantém saúde/assinatura falsas para responsáveis.
- **Impacto:** experiência etária, representação e escolhas de dados/imagem podem depender de processo externo não registrado. Não ativar capacidades de saúde/assinatura para contornar esse bloqueio.
- **Fundamento:** [ECA Digital, arts. 1º, 3º, 10–16](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm), [Decreto 12.880/2026](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12880.htm) e [orientações ANPD](https://www.gov.br/anpd/pt-br/assuntos/eca-digital/).
- **Proposta:** avaliação de risco por público/funcionalidade, mecanismos etários proporcionais, evidência de autoridade e supervisão pertinente. Diferenciar consentimento de dados, imagem interna e divulgação. Avaliar RIPD com advogado/encarregado.
- **Verificação:** lacuna de comprovação no escopo examinado; prioridade alta de governança, sem falha comprovada de representação. Não houve teste de representação, parentalidade ou idade. Validar obrigações por funcionalidade e normas complementares antes de escolher mecanismo.

### JUR-06 — média — infraestrutura de consentimentos/direitos sem jornada integrada encontrada

- **Evidência:** `20260708141800_create_lgpd_consents.sql:70–118` e `20260708142000_create_data_subject_requests.sql:25–48` usam aluno/staff e, para DSR, também `students.owner_id`, sem incorporar relação familiar nova. Isso não é bloqueio universal de responsáveis. `20260831005113_family_access_foundation.sql:209–239` conhece `can_sign_consents`, sem habilitação nos presets atuais. Busca de consumidores dessas tabelas e `lgpd-export` em `app/`/`src/` não encontrou fluxo de produto. Página de exclusão oferece canal por e-mail.
- **Impacto:** titular/representante pode depender de atendimento manual sem evidência operacional de verificação e conclusão. Falta de autosserviço não é, por si, ilegalidade.
- **Fundamento:** [LGPD, arts. 8º, 14 e 18–19](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).
- **Proposta:** validar primeiro atendimento manual, identidade, representação, prazos e recibos; integrar jornada existente quando pertinente, sem abrir RLS genericamente.
- **Verificação:** canais/código encontrados; atendimento, correção, oposição, revogação e portabilidade não exercitados. Remoção de conta é fluxo diferente.

### JUR-07 — média — retenção pode falhar e anunciar sucesso

- **Evidência:** `lgpd-retention-cron/index.ts:44–66` trata apenas três tabelas/ação delete, ignora erros e usa `accessed_at` também em `sensitive_data_access_logs`, cujo schema usa `created_at` (`202603061030…:46–56`). Não foi localizado agendamento LGPD na configuração versionada. `anonymize` é permitido pelo schema de políticas, sem implementação nessa Edge.
- **Impacto:** cópias/logs podem sobreviver além do prazo configurado, sem sinalização ao operador.
- **Fundamento:** [LGPD, arts. 6º, 15–16, 37 e 46](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).
- **Proposta:** corrigir coluna/erros, explicitar tabelas/ações suportadas, estabelecer prazos fundamentados e monitorar execução/pendências. Incluir backups e restauração, respeitando retenções legais.
- **Verificação:** incompatibilidade estática; cron não executado. Schema, scheduler, contagens e recibos remotos pendentes.

### JUR-08 — média — base jurídica presumida no log de revelação de CPF

- **Evidência:** `useRevealCpf.ts:63–67` sempre envia `legalBasis: "consentimento_app"`; RPC registra texto sem vincular recibo/finalidade (`202603061030…:178–192`).
- **Impacto:** trilha de auditoria pode atribuir consentimento não comprovado. Autorização técnica administrativa não determina base jurídica.
- **Fundamento:** [LGPD, arts. 6º–8º e 37](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).
- **Proposta:** base por finalidade e contexto comprovável; não substituir por outra string universal. Manter máscara, cifra, HMAC e controle de revelação.
- **Verificação:** confirmado no código; não houve revelação de CPF nem consulta a logs reais.

### JUR-09 — alta — aviso de privacidade não descreve tratamentos materiais existentes

- **Evidência:** `app/privacy.tsx:20–44` é genérico e não detalha saúde, menores, imagens/vídeos, IA, telemetria, transferências e critérios de retenção por operação. `terms.tsx`/`data-deletion.tsx` existem; busca de links às três rotas em `app/`/`src/` encontrou somente rotas e allowlists, sem ingresso por login/signup/welcome.
- **Impacto:** titulares podem não conhecer destinos, finalidades, riscos e meios de exercício antes de usar o serviço.
- **Fundamento:** [LGPD, arts. 6º, 9º, 14 e 18](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).
- **Proposta:** revisar sobre inventário confirmado, indicar papéis/fornecedores e informações verificáveis; disponibilizar no ingresso e canais permanentes. Versionar ciência/aceite quando pertinente, separando contrato de consentimentos específicos.
- **Verificação:** documentos e lacunas textuais confirmados. Nome do operador, CNPJ e e-mail já constam no código; titularidade, atualidade, endereço e designação/dispensa de encarregado precisam de confirmação documental. Não foram inventados dados empresariais nem reescritas políticas nesta fase.

### JUR-10 — média — rastreamento e sanitização ainda sem prova de cobertura integral

- **Evidência:** Analytics global em `app/_layout.tsx:1390` usa `beforeSend` e filtra URL. Sentry `:97–111` bloqueia eventos/breadcrumbs de `/staff-invite`, devolvendo objetos completos nos outros casos; `sentry.ts:37–39` define ID de usuário e `breadcrumbs.ts:15–22,45–68` admite dados adicionais. PII padrão/logs ficam desabilitados fora de desenvolvimento.
- **Impacto:** exceções, campos livres, URLs e terceiros podem carregar identificadores ou conteúdo. Exposição efetiva não foi demonstrada.
- **Fundamento:** [LGPD, arts. 6º, 9º e 46](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm) e [guia ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf/@@display-file/file).
- **Proposta:** inventário real de requests/cookies/storage e allowlist de eventos; filtrar segredos antes do envio. Se finalidade/base exigir consentimento, bloquear antes da coleta e oferecer aceitar/rejeitar/configurar e revisão equivalentes. Não adicionar banner por mera presença de SDK.
- **Verificação:** cinco casos sintéticos do módulo real `navigation-privacy.ts` passaram para tokens/query/hash/URL inválida. Sem captura de tráfego. A [Vercel descreve Web Analytics sem cookies de terceiros](https://vercel.com/docs/analytics/privacy-policy); isso não decide sozinho o enquadramento LGPD. Speed Insights consta na dependência, sem uso encontrado; Google Analytics/pixels não foram encontrados na busca dirigida, sem certificar ausência em tags/configuração remota.

### JUR-11 — média — cópias locais e fotos públicas fora do mesmo ciclo de privacidade

- **Evidência:** cache contém dados de saúde/endereço (`students.ts:245–256,951–970`), sem TTL encontrado no leitor. Logout limpa caches de leitura (`auth.tsx:809–814`, `client.ts:323–327`), enquanto rascunhos/backups/miniaturas usam outros prefixos (`video-draft-storage.ts:27–43`, `use-video-draft.ts:207–209`, `VideoGallery.web.tsx:29–40`). `profile-photos` é público por URL (`2026021604…:10–21`; `profile-photo-storage.ts:13–21`).
- **Impacto:** dados persistem no aparelho compartilhado ou em URL conhecida. Isso não demonstra acesso de outra conta pela UI, nem torna toda foto pública indevida.
- **Fundamento:** [LGPD, arts. 6º, 14–16 e 46](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).
- **Proposta:** ciclo de vida por tipo de cópia, controles de limpeza/retenção e informação sobre downloads; revisar público-alvo das fotos. Preservar recuperação de rascunhos e filas pendentes sem apagar trabalho indiscriminadamente.
- **Verificação:** leitura estática, sem acesso a storage real ou troca de contas. Fotos de atletas são privadas e recebem URL assinada; não confundir identificador `/public/student-photos/` persistido com exposição efetiva.

### JUR-12 — alta — recursos de terceiro distribuídos sem prova de licença localizada

- **Evidência:** `public/visual-court-3d/reference/sources.json:3–7` registra recursos de `app.setoptics.com`; `renderer.mjs:78–79` carrega textura/silhuetas. `README.md:7–10` registra origem, sem autorização de redistribuição localizada no pacote examinado.
- **Impacto:** risco autoral/comercial e de retirada do recurso. A ausência de comprovante no repositório não prova inexistência de licença externa.
- **Fundamento:** [Lei 9.610/1998, arts. 7º, 24, 28–29](https://www.planalto.gov.br/ccivil_03/leis/l9610.htm).
- **Proposta:** obter autorização aplicável ou substituir por arte própria/licenciada com comprovantes; crédito de origem não substitui autorização. Alternativa segura: modelo e textura produzidos para o projeto ou recurso com licença compatível verificada.
- **Verificação:** origem e uso runtime confirmados; prova contratual pendente. MIT de Three.js/ONNX foi localizada, sem auditoria completa de fontes, fotografias, ícones e modelos de toda a aplicação. Nenhum recurso foi removido nesta fase.

### JUR-13 — alta — primitive de modal sem gestão de foco demonstrada

- **Evidência:** `src/ui/ModalSheet.tsx:167–180,270–271` usa Escape/portal; leitura da implementação não encontrou foco inicial, contenção/restauração, `role=dialog`, nome acessível, `aria-modal` ou isolamento do restante da página.
- **Impacto:** teclado/leitor de tela pode percorrer conteúdo atrás do modal e perder contexto em múltiplos fluxos.
- **Fundamento:** [LBI art. 63](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm); [WCAG 2.2, 2.4.3, 2.4.7, 2.4.11 e 4.1.2](https://www.w3.org/TR/WCAG22/).
- **Proposta:** corrigir na primitive, com foco inicial e retorno, anúncio, teclado e tratamento de sobreposição; reutilizar composição existente.
- **Verificação:** risco estrutural confirmado por código; falha concreta de cada consumidor ainda depende de browser/tecnologia assistiva. Nenhuma conformidade WCAG foi certificada.

### JUR-14 — alta — contraste nominal insuficiente no botão de cadastro

- **Evidência:** `app/welcome.tsx:123–124,269,277–279` usa branco sobre `#3DDC84`/`#27B86A`, fonte 16 px/peso 800.
- **Impacto:** leitura da ação principal prejudicada em baixa visão.
- **Fundamento:** [WCAG 2.2, 1.4.3](https://www.w3.org/TR/WCAG22/), [LBI art. 63](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm).
- **Proposta:** aplicar token textual apropriado ao fundo e conferir estados renderizados claro/escuro, sem criar nova variante visual.
- **Verificação:** cálculo sRGB local: **1,784:1** e **2,577:1**, inferiores inclusive a 3:1. É contraste nominal do código; renderização e estados de hover/foco/disabled pendentes.

### JUR-15 — média — controles sem nome e cobertura de movimento reduzido parcial

- **Evidência:** botão Google em `SignupScreen.tsx:985–1000` não tem label/role explícito; login equivalente já tem (`app/login.tsx:993–994`). Indicadores de `welcome.tsx:326–345` não têm nome/estado. Animações de auth/ModalSheet não consultam preferência, enquanto outras primitives já o fazem.
- **Impacto:** leitor de tela pode não identificar ações/seleção; movimento pode gerar desconforto.
- **Fundamento:** [WCAG 2.2, 1.1.1 e 4.1.2](https://www.w3.org/TR/WCAG22/); avaliar critérios de movimento conforme duração/efeito. Nem toda animação curta viola AA; 2.3.3 é AAA.
- **Proposta:** reutilizar nomes/roles do login, identificar slides e respeitar preferência de movimento. Inventariar cada imagem relevante com função, origem/licença e texto alternativo contextual; decorativas sem ruído.
- **Verificação:** leitura de código; anúncio real, conteúdo alternativo de todas as imagens, autoplay, leitores de tela e nativo não exercitados.

### JUR-16 — alta — advisories de dependências exigem triagem de alcance

- **Evidência:** [snapshot npm](evidence/2026-10-21-npm-audit.json), lock SHA-256 registrado: 56 entradas afetadas, 1 crítica, 53 altas e 2 moderadas no grafo consultado. `shell-quote` 1.9.0 é abrangido pelo [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv); correção indicada no advisory: 1.11.0. Também há `node-forge` 1.4.0 e `source-map-js` 1.2.1.
- **Impacto:** risco potencial em ferramentas/build/runtime depende de entrada controlável e versão executada. Contagem de pacotes propagados não é contagem de exploits independentes.
- **Fundamento:** [LGPD, arts. 46 e 49](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm); advisory técnico citado.
- **Proposta:** rastrear alcance e atualizar compativelmente em pacote separado com testes Expo/nativo/web. Não aplicar `audit fix --force` nem aceitar downgrades incompatíveis sugeridos pelo grafo.
- **Verificação:** `npm audit --package-lock-only --omit=dev --ignore-scripts --json` executado, saída 1 por achados. Inclui ferramentas/testes alcançáveis pela árvore de dependências de produção; não comprova pacote no bundle publicado ou execução vulnerável. Consulta preliminar reportou 57; captura final e repetição reportaram 56. O snapshot preserva a consulta final, pois o registro é mutável.

## Pendências de governança, contratação e produção

Estas questões precisam de prova externa ou aprofundamento; não foram convertidas
em afirmações de descumprimento ou em condições comerciais inventadas.

| Tema / risco residual | Evidência e próximo passo | Estado |
| --- | --- | --- |
| Controlador, operador, encarregado, ROPA/RIPD e fornecedores — alto | Identificação e e-mail existem em `privacy.tsx:16`, mas contratos de instituição/fornecedores, registro completo de operações e avaliação de risco não foram apresentados. Confirmar destinatários, países, subprocessadores, mecanismo internacional, instruções e responsabilidades. Resoluções ANPD 18/19 e arts. 37–41 LGPD são referências. | Pendente documental; busca em `docs/security` e documentos operacionais examinados não comprovou pacote completo. |
| Incidentes e backups — alto | Formalizar detecção, responsável, triagem, comunicação, preservação de evidência e teste de restauração; confrontar políticas de retenção/reaplicação de exclusões. Não confundir cinco anos de log de acesso com registro de incidente exigido pela Resolução 15. | Não houve simulação, consulta a backups ou comprovação de runbook operacional completo. |
| Isolamento/RLS e Storage — alto até testes negativos | Controles de organização encontrados; nenhum bypass demonstrado. Matriz mínima: sem sessão, outra organização, staff sem turma, familiar de outro atleta, vínculo revogado, URL assinada expirada. `student_photos` usa helper amplo por organização (`2026021605…:55–61`, movido a `private` em `20260713150232…:40`); confirmar se isso corresponde à permissão institucional pretendida. | Estático parcial; sem prova de schema/grants/Policies/Auth remotos ou acesso por ator real. |
| Comercial SaaS versus mensalidade — médio | `src/core/payments/types.ts:1,21` mantém pagamentos reais desabilitados e separa `platform_saas`/`institution_tuition`; conector Asaas importa recebíveis e não comprova venda SaaS. `terms.tsx` não define oferta/preço/renovação/reembolso. Levantar comercialização efetiva e contratos antes de redigir política; avaliar CDC/arrependimento por canal e relação. | Canal, oferta, cobrança, cancelamento e suporte não validados. |
| Publicidade e alegações — médio | Não foi feita varredura completa de site publicado, campanhas, depoimentos e métricas. Nenhuma avaliação foi classificada como inventada sem evidência. Criar registro de alegação → origem/prova → responsável; suspender o que não puder ser comprovado após revisão. | Pendente; referência CDC arts. 30–37. |
| Licenças e acessibilidade de todos os ativos — médio | O achado SetOptics não certifica os demais ativos. Inventariar imagem a imagem, fonte, ícone, vídeo, modelo IA e biblioteca; comprovar licença/atribuição/uso de imagem e função acessível. | Parcial; revisão completa pendente. |
| Configuração ativa — alto até comprovação | Deploys de Edge/migrations, scheduler, RLS, políticas dos buckets, proteção de senha, regiões, retenções, contrato DPA, SMTP, WhatsApp e configuração de analytics podem divergir do checkout. | Nenhuma ativação remota foi confirmada nesta etapa. |

## Verificação executada e cobertura restante

| Comando / inspeção | Resultado | Limite |
| --- | --- | --- |
| Git status + diffs staged/unstaged | Árvore inicialmente limpa, HEAD `a17c2401`; branch de auditoria criada | Sem mudança de produto. |
| `node scripts/check-org-scope.js` | PASS | Guardrail textual, não exercício completo de autorização/RLS. |
| `node scripts/check-edge-jwt.js` | PASS | Configuração/contratos estáticos; não auditoria de toda Edge nem produção. |
| `node docs/audits/evidence/2026-10-21-reproduce-export.mjs` | **Defeito JUR-02 reproduzido** | Executa handler real com imports substituídos por mocks, erro sintético de consulta e dados fictícios; nenhuma rede. Não é teste de sucesso do produto. |
| Módulo real `navigation-privacy.ts` com Node strip-types e cinco assertions sintéticas | PASS | Convite, família, turma/scouting, recovery/query/hash e URL inválida; não executa SDK nem testa todos os caminhos. |
| Luminância relativa sRGB das duas cores do CTA, script Node | 1,784:1 / 2,577:1 | Cor nominal; sem screenshot/estados renderizados. |
| npm audit, lock somente e sem scripts | Achados, exit 1; snapshot anexado | Não instalou dependências nem alterou lock; advisories não demonstram explorabilidade. |
| Referências locais, IDs e geração do checklist | PASS: 69 links locais; 16 IDs de risco; IDs anteriores e contrato de revisão pessoal preservados | Somente o item legal existente e dois itens novos da auditoria mudaram; snapshot gerado com 29 módulos, 376 itens e 121 rotas. |
| `git diff --check` | PASS | Formato do pacote documental; não substitui testes do produto. |

`node_modules` não existe neste checkout. Jest, PGlite, typecheck, build, browser
autenticado e testes nativos **não foram executados**. Esta é entrega documental;
não foi iniciada a aplicação nem usada uma Vercel preview para decidir UI.

Testes existentes a reutilizar na fase de correções: `lgpd-deletion-worker.test.ts`,
`account-deletion-contract.test.ts`, `scripts/validation/lgpd-deletion-sql.mjs`,
`src/observability/__tests__/vercel-analytics.test.ts`, `breadcrumbs.test.ts`,
`signup-screen.test.ts` e testes de identidade/offline. Existência não significa
execução. O harness LGPD precisa das novas cópias/campos. Não usar automaticamente
`scripts/test-e2e.js`: ele executa `supabase db reset` por padrão e o workflow
contém expectativas antigas; exigir backend local comprovadamente descartável.

Matriz manual ainda pendente: cadastro/login/recovery e documentos por teclado;
foco e leitor de tela em modais; turmas/aulas/relatórios/admin com capacidades;
zoom/reflow/contraste em ambos os temas; imagens/textos alternativos; reduced motion;
direitos de titular/representante; fluxos negativos de RLS; cache/rascunho após logout;
VoiceOver/TalkBack e permissões do dispositivo. Dados sintéticos e ambiente controlado
devem preceder qualquer verificação remota autorizada.

## Sequência proposta para as próximas fases

1. **Fase 2, pacote de dados:** JUR-01/02/07, com fixtures de cópias, falhas de consulta e conclusão segura. Alterar migrations por nova migration, sem reescrever histórico; testar rollback, leases, RLS e preservação institucional.
2. **Fase 2, exposição/minores:** minimizar IA (JUR-03), revisar vídeo/imagem e representação (04/05); comprovar finalidade e autoridade antes de habilitar novas capacidades. Triar dependências (16) e licença (12) em paralelo sem mudança forçada de stack.
3. **Fase 3:** confirmar dados empresariais, papéis, fornecedores, retenção e operação comercial; revisar documentos existentes e acesso a eles (06/08/09/10), com revisão jurídica especializada.
4. **Fase 4:** modais, contraste, nomes acessíveis e imagens (13–15), paridade visual com primitives aprovadas e testes reais no localhost. Escolha de cookies somente após medição/inventário.
5. **Fase 5:** gates proporcionais da [escada](../operations/validation-ladder.md), casos negativos, smoke controlado/autenticado e revisão dos riscos residuais. Publicação de produto, aplicação remota e produção têm evidências/autorização separadas.

Critério de fechamento de cada risco: código/decisão rastreável, teste pertinente,
limites registrados, documentação correspondente e evidência remota quando exigida.
O status desta entrega é **diagnóstico inicial documentado**. Não há declaração de
conformidade integral, imunidade jurídica ou conclusão das demais fases.
