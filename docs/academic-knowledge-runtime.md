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
- `academic-knowledge-retrieve`: recuperação contextual por workspace e
  usuário. Permanece como rota especializada de compatibilidade e diagnóstico;
  a geração normal usa `document-context-resolve`.

O aplicativo expõe `syncPersonalAcademicDrive` para uma sincronização iniciada
pelo professor. Assistente e geração de plano consomem o resolvedor documental
unificado; não há uma segunda IA ou um contexto acadêmico paralelo.

## Segredos

- `GOOGLE_DRIVE_API_KEY`: obrigatório para ler a pasta pública pelo Drive API.
- `OPENAI_API_KEY`: opcional; habilita embeddings `text-embedding-3-small`.
  Sem ele, a recuperação continua pelo fallback lexical.
- `ACADEMIC_DRIVE_ALLOWED_FOLDER_IDS`: opcional; IDs adicionais separados por
  vírgula. A pasta acadêmica inicial já está na lista interna permitida.

## Limites de segurança

- arquivos são tratados como conteúdo não confiável;
- instruções encontradas nos documentos são removidas antes do chunking;
- cada trecho mantém documento, revisão, hash e localização;
- o escopo pessoal exige o mesmo usuário autenticado e uma organização da qual
  ele seja membro;
- `class_id` permanece nulo para fontes e trechos acadêmicos pessoais;
- referências aplicadas são gravadas como snapshot no plano novo;
- indisponibilidade da base acadêmica não bloqueia a geração operacional.
