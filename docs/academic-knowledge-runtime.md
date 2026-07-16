# Base acadêmica contextual

O runtime acadêmico amplia a inteligência documental e a base `kb_documents`
existentes. Ele não cria vínculo automático com turma, não promove materiais
para `scientific_sources` e não altera planos confirmados.

O desenho unificado, incluindo fontes operacionais, Assistente e geração
automática, está em [`document-context-runtime.md`](./document-context-runtime.md).

## Funções

- `academic-drive-sync`: sincronização explícita e somente leitura da pasta
  acadêmica autorizada. Persiste origem, revisão, hash, classificação,
  proveniência, trechos e embeddings no escopo `user_academic`.
- `document-drive-oauth`: inicia OAuth com PKCE, recebe o callback do Google e
  armazena somente o refresh token cifrado. O callback é público por necessidade
  do provedor, mas exige estado de uso único, expiração e destino validado.
- `academic-knowledge-retrieve`: recuperação contextual por workspace e
  usuário. Permanece como rota especializada de compatibilidade e diagnóstico;
  a geração normal usa `document-context-resolve`.

O aplicativo expõe `syncPersonalAcademicDrive` para uma sincronização iniciada
pelo professor. Assistente e geração de plano consomem o resolvedor documental
unificado; não há uma segunda IA ou um contexto acadêmico paralelo.

## Autenticação e segredos

- `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET` e
  `GOOGLE_DRIVE_REDIRECT_URI`: habilitam a conexão OAuth do professor para
  pastas privadas. O redirect autorizado no Google Cloud é
  `https://go-atleta.vercel.app/oauth/google-drive/callback`; o Vercel encaminha
  essa rota, antes do fallback SPA, para `/functions/v1/document-drive-oauth`.
- `DOCUMENT_TOKEN_ENCRYPTION_KEY`: cifra refresh tokens com AES-GCM antes da
  persistência.
- `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`: alternativa opcional. As pastas devem
  ser compartilhadas explicitamente com a conta de serviço.
- `GOOGLE_DRIVE_API_KEY`: fallback opcional para pastas realmente públicas.
- `OPENAI_API_KEY`: opcional; habilita embeddings `text-embedding-3-small`.
  Sem ele, a recuperação continua pelo fallback lexical.
- `ACADEMIC_DRIVE_ALLOWED_FOLDER_IDS`: opcional; IDs adicionais separados por
  vírgula. A pasta acadêmica inicial já está na lista interna permitida.
- `DOCUMENT_DRIVE_SOURCE_PROFILES`: configura fontes adicionais e pode declarar
  `authStrategy` (`auto`, `oauth_user`, `service_account` ou `api_key`) e
  `resourceKey`.

Em `auto`, a ordem é OAuth do usuário, conta de serviço e API key. Nenhum token,
segredo ou `resourceKey` é incluído nos trechos, logs ou proveniência.

Ao desconectar, o runtime tenta revogar o refresh token no Google e sempre
remove a cópia cifrada local. Fontes, revisões, trechos já sincronizados e
planos confirmados são preservados; apenas novas leituras do Drive deixam de ser
possíveis até uma nova autorização.

Google Docs são exportados em DOCX e convertidos em texto estruturado, mantendo
linhas e colunas de tabelas. Google Sheets são exportados em XLSX e preservam
planilha, linha e coluna. Slides e arquivos de texto permanecem em texto
simples. A primeira sincronização real ainda deve comparar o original com a
interpretação persistida antes de usar a fonte em produção.

## Limites de segurança

- arquivos são tratados como conteúdo não confiável;
- instruções encontradas nos documentos são removidas antes do chunking;
- cada trecho mantém documento, revisão, hash e localização;
- o escopo pessoal exige o mesmo usuário autenticado e uma organização da qual
  ele seja membro;
- `class_id` permanece nulo para fontes e trechos acadêmicos pessoais;
- referências aplicadas são gravadas como snapshot no plano novo;
- indisponibilidade da base acadêmica não bloqueia a geração operacional.
