# Agenda — anotações e anexos

Refino local de 29/10/2026, com referência física do Samsung Calendar via ADB.
A tipografia do Go Atleta permanece; não se incorpora a fonte da Samsung.

## Anotações

O campo começa como uma linha sem caixa preenchida, com ícone alinhado à
primeira linha. Cresce com quebras e texto envolvido e recolhe ao apagar.
O valor continua em `draft.description`, com a proteção de descarte e o envio
existentes. Não há gravação ao digitar nem um segundo buffer fora da guarda.
No web, a medição usa o textarea real; no nativo, `onContentSizeChange`.

O smoke local conferiu altura 24px vazia/curta e 72px para três linhas; o texto
longo passou de 360px no desktop a 432px em 390px, sem rolagem interna do campo.
A primeira tentativa com `setNativeProps` foi rejeitada no smoke RNW e corrigida
antes do fechamento. O preset nativo de testes não reproduz esse host DOM;
o comportamento web foi conferido no navegador real.

## Arquivos e interface

Anexo aceita seleção múltipla de imagens raster, PDF, Word, Excel, PowerPoint,
OpenDocument, TXT e CSV. SVG, HTML e executáveis não entram na lista permitida.
São até dez intenções ativas por evento, com até 20 MiB por arquivo.
O nome, a extensão, o MIME e o tamanho real são verificados; isso não equivale
a antivírus ou certificação do conteúdo.

Os arquivos ficam no rascunho até Salvar. A disponibilidade do backend é
verificada antes de criar/atualizar o evento quando existem alterações em anexos.
Salvar fica bloqueado durante a escolha; progresso indica arquivos concluídos,
sem inventar porcentagem de transferência. IDs estáveis permitem retomar falhas
sem duplicar evento ou sobrescrever arquivos. Administradores veem e removem
intenções pendentes para liberar a cota; leitores veem somente arquivos prontos.

A linha usa Adicionar azul e remoção vermelha. Imagens têm miniatura; documentos
usam identificação de formato, sem simular uma primeira página de Word/PDF.
O formulário mantém sua rolagem e a fonte do Go Atleta. A barra web tem regra
local fina e espaço constante, sem mudar a largura ao começar a rolar; hovers
dos seletores e anexos dispensam caixas pesadas e escala.

## Persistência e autorização

A migration [20261029144812](../../supabase/migrations/20261029144812_event_attachments.sql)
cria `event_attachments`, bucket privado `event-attachments`, RPCs e policies.
A leitura depende da visibilidade existente de `events` e do vínculo com a
instituição; mutações exigem o administrador já usado por eventos. Metadados não
aceitam escrita direta pelo papel autenticado. Organização/evento/ID compõem o
caminho imutável; a FK composta impede reassociar arquivos a outra instituição.

O fluxo é preparar intenção → Storage sem upsert → finalizar após conferir
tamanho/MIME do objeto. Remover marca a intenção antes de apagar pela API Storage;
repetir uma remoção ausente é seguro. Downloads usam URL assinada de 60 segundos,
origem/caminho validados e nome de download. Troca de sessão, organização ou
geração invalida respostas pendentes. O leitor nativo usa FileSystem; o web usa
Blob e não importa FileSystem/Buffer no caminho de leitura de arquivos.

O cascade de evento/instituição revoga novas leituras e remove os metadados,
mas não apaga os objetos físicos do Storage. Arquivos órfãos de cascade ou upload
abandonado exigem reconciliação separadamente autorizada pela API Storage.
Não se cria cron nem se apagam arquivos históricos. URLs já emitidas podem valer
até sua expiração curta. No teste, os anexos devem ser removidos antes do evento.

## Ativação registrada

O usuário autorizou explicitamente ativar o Supabase e testar imagem, PDF e
documento pelo localhost. A migration foi aplicada com sucesso no projeto
`hgmdpetpwclucvquoklv`, versão remota `20261029144812`, nome `event_attachments`.
SHA256 do SQL: `0C69E6B5886152EAB059C7BC55FF3808A4334E372CC851205D522C04570BE783`.

O preflight encontrou dois eventos existentes e nenhuma tabela/bucket de anexos.
Após aplicar: bucket privado 20 MiB, RLS ativa, SELECT autenticado, sem INSERT
direto autenticado e sem leitura anônima. Os dois eventos existentes permaneceram.
O frontend continua em ajuste local; isso não registra commit, push ou deploy web.

## Evidências

O teste SQL [isolado](../../scripts/validation/event-attachments-sql.mjs) cobre
admin/membro/externo/anônimo, audiência adicional do evento, revogação, limites,
idempotência, uploads incompletos, imutabilidade, remoção e cascade. PGlite não
substitui Auth/PostgREST/Storage hospedados.

Artefatos privados e fixtures sintéticas ficam em `.tmp/agenda-notes-20261029/`.
As capturas do telefone servem como referência visual; não comprovam um novo
APK do Go Atleta. Ver também [agenda integrada](AGENDA_EVENTOS_INTEGRADOS.md).

### Fechamento validado

Passaram 103 testes focados em sete suítes, tipos, lint, org-scope e higiene
strict das três telas/hooks, além do teste SQL isolado. O aviso de timer Sentry
na unit do editor foi rastreado à importação real de db/client pelo componente
novo; o mock de leitores dessa unit evita carregar esse runtime. A execução
final das sete suítes terminou com exit 0, sem o aviso.

O smoke autenticado usou o frontend localhost com o Supabase ativado: criou um
único evento temporário, salvou PNG, PDF e DOCX, reabriu seus anexos e comparou
os downloads byte a byte com as fixtures (68, 609 e 814 bytes). Substituiu a imagem
por uma PNG 640×360 de 7.249 bytes; a miniatura privada terminou com naturalWidth 640
/naturalHeight 360 e o download também conferiu. A edição conservou o mesmo evento
com três arquivos ativos e preservou as três linhas de anotações.

O download web foi conferido por evento de download do navegador e comparação de
bytes. A implementação usa Blob/anchor após a assinatura, evitando depender de
uma nova janela aberta depois da espera de rede. PDF e DOCX são baixados para
abertura pelo aplicativo do usuário; não se apresenta conversão ou visualizador
Office interno. As miniaturas de documentos identificam somente seu formato.

Depois, os três anexos ativos foram removidos pela UI e Salvar. A consulta remota
confirmou quatro intenções tombstonadas (incluindo a imagem substituída), zero
anexos ativos e zero objetos físicos. O evento temporário foi excluído somente
após essa limpeza; consulta final mostrou zero evento/metadado/objeto de teste e
os dois eventos anteriores preservados.

No desktop e em 390×844, Adicionar usa azul, remover usa dangerText e a imagem
mostra sua miniatura. O hover de Turmas vinculadas manteve fundo transparente e
transform:none. Com o dropdown aberto, a barra permaneceu 4px e a largura útil de 394px
(offset de 398px), igual ao estado fechado. A família tipográfica do texto permaneceu
no padrão do Go Atleta; não se importou tipografia da Samsung.

Capturas finais: localhost-final-attachments.png e localhost-final-mobile.png;
amostras e hashes em hover-scroll-check.json e download-hashes.json, todos no
diretório privado indicado acima. O registro mobile inicial de shimmer durante
redimensionamento foi substituído pela captura do modal reaberto e carregado;
não comprova retenção do modal durante resize. As evidências nativas são do
Samsung Calendar; não houve validação de novo APK do Go Atleta.
