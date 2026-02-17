# 🧠 Scientific Intelligence Stack (Curated Evidence Engine)

## 🎯 Objetivo Estratégico

Adicionar ao GoAtleta uma camada de **inteligência científica curada**, permitindo:

- Busca automatizada em fontes confiáveis (PubMed inicialmente)
- Síntese estruturada para aplicação prática
- Curadoria humana obrigatória (70% humano / 30% IA)
- Ingestão controlada na KB da organização
- Uso via RAG com citações verificáveis

Princípio fundamental:

> IA pode buscar e organizar.
> Apenas humano pode validar e institucionalizar.

---

# 📦 PR12 — Scientific Evidence Ingest (PubMed First)

## 🎯 Objetivo

Criar pipeline de busca científica + curadoria + ingestão para `kb_documents`.

---

## 🧩 Escopo Técnico

### 1️⃣ Nova Edge Function

```text
supabase/functions/kb_ingest/index.ts
```

### Endpoints

---

### POST /kb_ingest/search

Busca estudos no PubMed via E-utilities.

#### Request

```json
{
  "organizationId": "uuid",
  "sport": "volleyball",
  "query": "volleyball reception decision making training youth",
  "years": { "from": 2018, "to": 2026 },
  "studyTypes": ["systematic_review", "rct", "consensus"],
  "maxResults": 20
}
```

#### Response

```json
{
  "results": [
    {
      "provider": "pubmed",
      "pmid": "12345678",
      "title": "...",
      "authors": ["Sobrenome A"],
      "year": 2022,
      "journal": "Journal Name",
      "doi": "10.xxxx/yyy",
      "url": "https://pubmed.ncbi.nlm.nih.gov/12345678/",
      "abstract": "...",
      "autoTags": ["volleyball", "aprendizagem_motora"],
      "qualityHint": {
        "tier": "high|medium|low",
        "reasons": ["systematic_review"]
      }
    }
  ]
}
```

⚠️ Não grava nada no banco.

---

### POST /kb_ingest/summarize (opcional)

Gera card estruturado baseado no abstract.

#### Response

```json
{
  "evidenceCardDraft": "EVIDENCE_CARD\nTítulo:\n...",
  "suggestedTags": ["volleyball", "aprendizagem_motora"]
}
```

---

### POST /kb_ingest/approve

Salva evidência na KB da org.

#### Request

```json
{
  "organizationId": "uuid",
  "sport": "volleyball",
  "level": "evidence",
  "items": [
    {
      "provider": "pubmed",
      "pmid": "12345678",
      "title": "...",
      "evidenceCard": "EVIDENCE_CARD\n...",
      "tags": ["volleyball", "aprendizagem_motora", "kb:curated"],
      "sourceMeta": {
        "doi": "...",
        "year": 2022,
        "journal": "..."
      }
    }
  ]
}
```

---

## 🗄️ Persistência em `kb_documents`

### id

```text
pmid_<PMID>
```

### source

```text
pubmed:PMID=12345678|DOI=...|URL=...|YEAR=2022|JOURNAL=...
```

### chunk

Formato obrigatório:

```text
EVIDENCE_CARD
Título:
Autores/Ano:
População:
Desenho:
Principais achados:
Aplicação prática:
Limitações:
Link:
```

---

## 🔐 Segurança

- Apenas `org_admin` pode aprovar
- Deduplicação por `id`
- RLS já existente protege leitura por membro

---

## ✅ Critérios de Aceite

- Buscar termo retorna estudos reais
- Aprovar 1 evidência grava em `kb_documents`
- Smoke do assistant retorna `citations_count > 0`

---

# 📦 PR13 — Evidence UI (Curadoria Visível)

## 🎯 Objetivo

Criar tela visual para busca e aprovação.

---

## 🧩 Nova Tela

```text
app/evidence/index.tsx
```

### Componentes

- Campo de busca
- Filtros (esporte, eixo, população, ano)
- Lista de estudos
- Botão "Pré-visualizar"
- Botão "Gerar card"
- Botão "Aprovar e salvar"

---

## 🎨 Experiência

Professor:

1. Busca termo
2. Lê resumo
3. Ajusta tags
4. Aprova

---

## ✅ Critérios de Aceite

- Usuário comum não vê botão aprovar
- Admin salva com sucesso
- Documento aparece no RAG

---

# 📦 PR14 — Evidence Tag Taxonomy

## 🎯 Objetivo

Padronizar tags científicas.

---

## 🏷 Taxonomia

### Modalidade

- volleyball
- beach_volleyball
- soccer
- functional

### Eixo

- biomecanica
- fisiologia
- cinesiologia
- aprendizagem_motora
- periodizacao
- prevencao_lesao

### População

- criancas
- adolescentes
- adultos
- idosos

### Tipo

- rct
- systematic_review
- consensus
- cohort

---

## 🧠 Uso no RAG

Permite filtro por:

- esporte
- eixo
- população
- tipo

---

# 📦 PR15 — Scientific Context Injection no Assistant

## 🎯 Objetivo

Fazer assistant usar evidência aprovada como contexto prioritário.

---

## 🧩 Alteração

No `supabase/functions/assistant/index.ts`:

1. Priorizar `level = 'evidence'`
2. Ordenar por `created_at desc`
3. Incluir no prompt:

```text
Evidências científicas aprovadas pela organização:
...
```

---

## ✅ Critérios de Aceite

- Prompt contém bloco de evidência
- `citations_count` reflete artigos científicos
- Respostas citam título/ano

---

# 📦 PR16 — Scheduled Scientific Digest (Opcional Futuro)

## 🎯 Objetivo

Gerar relatório semanal de novas evidências (sem auto-publicar).

---

## Funcionamento

Job:

- Busca termos pré-configurados
- Gera lista
- Notifica admin
- Admin aprova manualmente

---

# 🧠 Resultado Final

Após PR12–PR15:

- App pesquisa ciência real
- IA resume e organiza
- Humano valida
- KB cresce com evidência curada
- RAG fica inteligente
- Respostas deixam de dizer “não há dados”
- Produto ganha credibilidade profissional

---

# 🧭 Próximo Passo Recomendado

Implementar apenas:

PR12 + PR13 primeiro.

Depois evoluir.
