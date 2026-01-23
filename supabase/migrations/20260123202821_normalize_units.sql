-- Normalize unit names to canonical casing
UPDATE public.units
SET name = 'Rede Esperança'
WHERE lower(name) = 'rede esperanca';

UPDATE public.units
SET name = 'Rede Esportes Pinhais'
WHERE lower(name) IN ('rede esportes pinhais', 'rede esportes pinhas');

UPDATE public.classes
SET unit = 'Rede Esperança'
WHERE lower(unit) = 'rede esperanca';

UPDATE public.classes
SET unit = 'Rede Esportes Pinhais'
WHERE lower(unit) IN ('rede esportes pinhais', 'rede esportes pinhas');
