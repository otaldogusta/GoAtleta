-- Migration: 20260708162900_create_scientific_layer.sql
-- Description: Creates scientific_sources, scientific_concepts and updates kb_documents

-- 1. Fontes Científicas / Literatura
CREATE TABLE public.scientific_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author TEXT NOT NULL,
    title TEXT NOT NULL,
    year INTEGER NOT NULL,
    doi_url TEXT,
    quality_level TEXT NOT NULL CHECK (quality_level IN ('A_meta_analysis', 'B_consensus', 'C_cohort', 'D_expert_opinion')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.scientific_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY scientific_sources_select ON public.scientific_sources
    FOR SELECT USING (true); -- Read-only public references

-- 2. Conceitos Científicos
CREATE TABLE public.scientific_concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    area TEXT NOT NULL CHECK (area IN ('training', 'motor_development', 'pedagogy')),
    description TEXT NOT NULL,
    principles JSONB NOT NULL DEFAULT '[]'::jsonb,
    primary_source_id UUID REFERENCES public.scientific_sources(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.scientific_concepts ENABLE ROW LEVEL SECURITY;
CREATE POLICY scientific_concepts_select ON public.scientific_concepts
    FOR SELECT USING (true); -- Read-only public concepts

-- 3. Evoluir kb_documents (RAG Chunks) para se conectar às tabelas
-- Note: kb_documents.id is TEXT, so we keep text format for integration but map concepts and sources via standard UUID references.
ALTER TABLE public.kb_documents
ADD COLUMN concept_id UUID REFERENCES public.scientific_concepts(id) ON DELETE SET NULL,
ADD COLUMN source_id UUID REFERENCES public.scientific_sources(id) ON DELETE SET NULL;

-- Indexing for optimized joins
CREATE INDEX idx_kb_documents_concept ON public.kb_documents(concept_id);
CREATE INDEX idx_kb_documents_source ON public.kb_documents(source_id);
