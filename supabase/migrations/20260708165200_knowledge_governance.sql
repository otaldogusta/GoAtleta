-- Migration: 20260708165200_knowledge_governance.sql
-- Description: Creates domains, versions, and constraints tables for scientific layer governance

-- 1. Domínios Científicos
CREATE TABLE public.scientific_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    parent_domain_id UUID REFERENCES public.scientific_domains(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scientific_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY scientific_domains_select ON public.scientific_domains
    FOR SELECT USING (true); -- Read-only public reference

-- 2. Versionamento de Conceitos
CREATE TABLE public.scientific_concept_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id UUID NOT NULL REFERENCES public.scientific_concepts(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    changes TEXT[] NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scientific_concept_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY scientific_concept_versions_select ON public.scientific_concept_versions
    FOR SELECT USING (true); -- Read-only public reference

-- 3. Restrições e Regras Proibitivas
CREATE TABLE public.scientific_constraints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    condition_schema JSONB NOT NULL, -- Logical matching config
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scientific_constraints ENABLE ROW LEVEL SECURITY;
CREATE POLICY scientific_constraints_select ON public.scientific_constraints
    FOR SELECT USING (true); -- Read-only public reference

-- 4. Evolução das Tabelas Anteriores
ALTER TABLE public.scientific_concepts
ADD COLUMN domain_id UUID REFERENCES public.scientific_domains(id) ON DELETE SET NULL;

ALTER TABLE public.scientific_sources
ADD COLUMN reviewed_at TIMESTAMPTZ;

-- Indices
CREATE INDEX idx_scientific_concepts_domain ON public.scientific_concepts(domain_id);
CREATE INDEX idx_concept_versions_concept ON public.scientific_concept_versions(concept_id);
