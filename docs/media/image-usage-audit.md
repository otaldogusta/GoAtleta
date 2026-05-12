# Auditoria de uso de imagem

## MEDIA 1.1

Esta auditoria revisa pontos onde o app recebe, salva ou exibe imagens escolhidas pelo usuário.

## Fluxos protegidos

### Foto de aluno na turma

Arquivos:

- `app/class/[id]/students.tsx`

Classificacao: foto de perfil/avatar.

Status: protegido por `normalizeProfileImage`.

Observacoes:

- Galeria e camera normalizam antes do preview.
- Upload usa JPEG `512x512`, `image/jpeg`, extensao `.jpg` e compressao `0.82`.
- HEIC/HEIF nao e salvo diretamente.

### Fluxo global de alunos

Arquivos:

- `app/students/index.tsx`
- `src/screens/students/modals/StudentEditModal.tsx`

Classificacao: foto de perfil/avatar.

Status: protegido por `normalizeProfileImage`.

Observacoes:

- O modal mostra feedback de preparo e erro.
- Botoes de foto ficam bloqueados durante a preparacao.

### Foto do perfil

Arquivos:

- `app/profile.tsx`
- `src/api/profile-photo-storage.ts`

Classificacao: foto de perfil/avatar.

Status: protegido por `normalizeProfileImage`.

Observacoes:

- Perfil de professor e perfil de aluno passam pela normalizacao antes do upload.
- O storage de foto de perfil tambem usa o helper central para evitar gravar formatos inconsistentes.

## Fluxos que nao devem usar `normalizeProfileImage`

### Fotos do relatorio da Aula do Dia

Arquivo:

- `app/class/[id]/session.tsx`

Classificacao: imagem de relatorio/aula.

Status: precisa de pacote futuro.

Motivo:

- Essas imagens usam proporcao `4:3` e podem ir para PDF/relatorio.
- Nao devem receber crop quadrado `512x512`.
- Recomendacao futura: criar helper proprio, mantendo proporcao e reduzindo tamanho.

### Midia gerada

Arquivos:

- `src/media-generation/**`
- `src/screens/exercises/components/ExerciseMediaGenerationJobsSection.tsx`

Classificacao: midia gerada/Higgsfield.

Status: nao mexer neste pacote.

Motivo:

- Imagens sao geradas/remotas e seguem outro pipeline.

## Imagens remotas ou estaticas

Arquivos observados:

- listas de alunos
- aniversarios
- NFC/chamada
- PDF/renderizacao de relatorio

Classificacao: imagem ja remota/estatica.

Status: nao precisa normalizacao no ponto de exibicao.

Motivo:

- Apenas exibem `photoUrl` ja persistido.
- A protecao deve acontecer no momento de captura/upload.

## Proximos pacotes recomendados

1. `MEDIA 2` - normalizacao de fotos de relatorio/aula mantendo proporcao.
2. `MEDIA 3` - validacao de tamanho maximo de imagens antes de exportar PDF.
3. `MEDIA 4` - consolidar mensagens de erro de imagem em helper de UI.
