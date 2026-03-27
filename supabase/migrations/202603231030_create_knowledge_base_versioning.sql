-- Evidence-backed knowledge base versioning.
-- Adds versioned sources, rules, and citations on top of the existing kb_documents RAG store.

CREATE TABLE IF NOT EXISTS public.knowledge_base_versions (
  id text PRIMARY KEY NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain text NOT NULL DEFAULT 'general',
  version_label text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_base_versions_status_check CHECK (status IN ('draft', 'review', 'active', 'archived')),
  CONSTRAINT knowledge_base_versions_domain_check CHECK (domain IN ('general', 'youth_training', 'general_fitness', 'clinical', 'performance')),
  CONSTRAINT knowledge_base_versions_unique UNIQUE (organization_id, domain, version_label)
);

CREATE TABLE IF NOT EXISTS public.knowledge_sources (
  id text PRIMARY KEY NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  knowledge_base_version_id text NOT NULL REFERENCES public.knowledge_base_versions(id) ON DELETE CASCADE,
  domain text NOT NULL DEFAULT 'general',
  title text NOT NULL DEFAULT '',
  authors text NOT NULL DEFAULT '',
  source_year integer,
  edition text NOT NULL DEFAULT '',
  source_type text NOT NULL DEFAULT 'other',
  source_url text NOT NULL DEFAULT '',
  citation_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_sources_source_type_check CHECK (source_type IN ('guideline', 'book', 'paper', 'web', 'policy', 'other')),
  CONSTRAINT knowledge_sources_domain_check CHECK (domain IN ('general', 'youth_training', 'general_fitness', 'clinical', 'performance')),
  CONSTRAINT knowledge_sources_unique UNIQUE (knowledge_base_version_id, title, source_url)
);

CREATE TABLE IF NOT EXISTS public.knowledge_rules (
  id text PRIMARY KEY NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  knowledge_base_version_id text NOT NULL REFERENCES public.knowledge_base_versions(id) ON DELETE CASCADE,
  domain text NOT NULL DEFAULT 'general',
  rule_key text NOT NULL,
  rule_label text NOT NULL DEFAULT '',
  rule_kind text NOT NULL DEFAULT 'recommendation',
  status text NOT NULL DEFAULT 'draft',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_rules_status_check CHECK (status IN ('draft', 'review', 'active', 'archived')),
  CONSTRAINT knowledge_rules_kind_check CHECK (rule_kind IN ('recommendation', 'progression', 'safety', 'assessment', 'recovery', 'reference')),
  CONSTRAINT knowledge_rules_domain_check CHECK (domain IN ('general', 'youth_training', 'general_fitness', 'clinical', 'performance')),
  CONSTRAINT knowledge_rules_unique UNIQUE (knowledge_base_version_id, rule_key)
);

CREATE TABLE IF NOT EXISTS public.knowledge_rule_citations (
  id text PRIMARY KEY NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  knowledge_rule_id text NOT NULL REFERENCES public.knowledge_rules(id) ON DELETE CASCADE,
  knowledge_source_id text REFERENCES public.knowledge_sources(id) ON DELETE SET NULL,
  kb_document_id text REFERENCES public.kb_documents(id) ON DELETE SET NULL,
  pages text NOT NULL DEFAULT '',
  evidence text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_rule_citations_unique UNIQUE (knowledge_rule_id, knowledge_source_id, kb_document_id, pages)
);

CREATE INDEX IF NOT EXISTS knowledge_base_versions_org_domain_updated
  ON public.knowledge_base_versions (organization_id, domain, updated_at DESC);

CREATE INDEX IF NOT EXISTS knowledge_base_versions_org_status
  ON public.knowledge_base_versions (organization_id, status);

CREATE INDEX IF NOT EXISTS knowledge_sources_version_idx
  ON public.knowledge_sources (knowledge_base_version_id);

CREATE INDEX IF NOT EXISTS knowledge_sources_org_domain_idx
  ON public.knowledge_sources (organization_id, domain);

CREATE INDEX IF NOT EXISTS knowledge_rules_version_idx
  ON public.knowledge_rules (knowledge_base_version_id);

CREATE INDEX IF NOT EXISTS knowledge_rules_org_domain_idx
  ON public.knowledge_rules (organization_id, domain);

CREATE INDEX IF NOT EXISTS knowledge_rule_citations_rule_idx
  ON public.knowledge_rule_citations (knowledge_rule_id);

CREATE INDEX IF NOT EXISTS knowledge_rule_citations_source_idx
  ON public.knowledge_rule_citations (knowledge_source_id);

CREATE INDEX IF NOT EXISTS knowledge_rule_citations_document_idx
  ON public.knowledge_rule_citations (kb_document_id);

ALTER TABLE public.kb_documents
  ADD COLUMN IF NOT EXISTS knowledge_base_version_id text REFERENCES public.knowledge_base_versions(id) ON DELETE SET NULL;

ALTER TABLE public.kb_documents
  ADD COLUMN IF NOT EXISTS knowledge_source_id text REFERENCES public.knowledge_sources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS kb_documents_org_version
  ON public.kb_documents (organization_id, knowledge_base_version_id);

CREATE INDEX IF NOT EXISTS kb_documents_source_idx
  ON public.kb_documents (knowledge_source_id);

ALTER TABLE public.knowledge_base_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge_base_versions select member" ON public.knowledge_base_versions;
CREATE POLICY "knowledge_base_versions select member" ON public.knowledge_base_versions
  FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "knowledge_base_versions insert admin" ON public.knowledge_base_versions;
CREATE POLICY "knowledge_base_versions insert admin" ON public.knowledge_base_versions
  FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "knowledge_base_versions update admin" ON public.knowledge_base_versions;
CREATE POLICY "knowledge_base_versions update admin" ON public.knowledge_base_versions
  FOR UPDATE
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "knowledge_base_versions delete admin" ON public.knowledge_base_versions;
CREATE POLICY "knowledge_base_versions delete admin" ON public.knowledge_base_versions
  FOR DELETE
  USING (public.is_org_admin(organization_id));

ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge_sources select member" ON public.knowledge_sources;
CREATE POLICY "knowledge_sources select member" ON public.knowledge_sources
  FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "knowledge_sources insert admin" ON public.knowledge_sources;
CREATE POLICY "knowledge_sources insert admin" ON public.knowledge_sources
  FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "knowledge_sources update admin" ON public.knowledge_sources;
CREATE POLICY "knowledge_sources update admin" ON public.knowledge_sources
  FOR UPDATE
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "knowledge_sources delete admin" ON public.knowledge_sources;
CREATE POLICY "knowledge_sources delete admin" ON public.knowledge_sources
  FOR DELETE
  USING (public.is_org_admin(organization_id));

ALTER TABLE public.knowledge_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge_rules select member" ON public.knowledge_rules;
CREATE POLICY "knowledge_rules select member" ON public.knowledge_rules
  FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "knowledge_rules insert admin" ON public.knowledge_rules;
CREATE POLICY "knowledge_rules insert admin" ON public.knowledge_rules
  FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "knowledge_rules update admin" ON public.knowledge_rules;
CREATE POLICY "knowledge_rules update admin" ON public.knowledge_rules
  FOR UPDATE
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "knowledge_rules delete admin" ON public.knowledge_rules;
CREATE POLICY "knowledge_rules delete admin" ON public.knowledge_rules
  FOR DELETE
  USING (public.is_org_admin(organization_id));

ALTER TABLE public.knowledge_rule_citations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge_rule_citations select member" ON public.knowledge_rule_citations;
CREATE POLICY "knowledge_rule_citations select member" ON public.knowledge_rule_citations
  FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "knowledge_rule_citations insert admin" ON public.knowledge_rule_citations;
CREATE POLICY "knowledge_rule_citations insert admin" ON public.knowledge_rule_citations
  FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "knowledge_rule_citations update admin" ON public.knowledge_rule_citations;
CREATE POLICY "knowledge_rule_citations update admin" ON public.knowledge_rule_citations
  FOR UPDATE
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "knowledge_rule_citations delete admin" ON public.knowledge_rule_citations;
CREATE POLICY "knowledge_rule_citations delete admin" ON public.knowledge_rule_citations
  FOR DELETE
  USING (public.is_org_admin(organization_id));
