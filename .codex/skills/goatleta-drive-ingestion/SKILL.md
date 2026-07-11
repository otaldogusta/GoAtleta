---
name: goatleta-drive-ingestion
description: Orienta a ingestão rastreável de documentos no GoAtleta por Google Drive, upload, URL permitida ou texto colado. Usar ao implementar OAuth, vínculo de pasta, leitura segura, revisão, hash, deduplicação, sincronização incremental, origem e detecção de alterações, sem decisões pedagógicas.
---

# Implementar ingestão documental

## Entradas e saídas

Receber identidade autenticada, `organizationId`, vínculo opcional de programa/modalidade/turma, provedor e referência da fonte. Produzir `DocumentSourceRecord` e conteúdo normalizado para interpretação. Usar o contrato canônico em `../goatleta-document-intelligence/references/contracts.md`.

## Procedimento

1. Aplicar `goatleta-document-security` antes de buscar ou abrir conteúdo.
2. Implementar OAuth com escopo mínimo e vínculo explícito da pasta ao contexto.
3. Permitir Google Docs, DOCX, PDF, texto e somente URLs aprovadas.
4. Verificar MIME por conteúdo; rejeitar macros, executáveis e extensões falsificadas.
5. Capturar ID externo, revisão do Google Docs, URL, nome, MIME e modificação.
6. Normalizar o conteúdo e calcular hash estável.
7. Deduplicar por organização, provedor, ID/revisão e hash.
8. Sincronizar incrementalmente e registrar documento criado, inalterado, alterado ou removido.
9. Persistir proveniência sem misturar workspaces.

## Proibições

- Não interpretar pedagogia, reconciliar nem escrever no planejamento.
- Não implementar o fluxo inteiro dentro da ingestão.
- Não buscar rede privada, localhost ou destino redirecionado não permitido.
- Não usar `classId` sem confirmar que pertence ao `organizationId`.
- Não registrar tokens ou dados pessoais desnecessários.

## Checklist

- [ ] OAuth e escopos mínimos
- [ ] MIME real e tamanho validados
- [ ] Revisão, hash e origem registrados
- [ ] Duplicação e alteração detectadas
- [ ] Sincronização incremental idempotente
- [ ] Isolamento por organização testado
