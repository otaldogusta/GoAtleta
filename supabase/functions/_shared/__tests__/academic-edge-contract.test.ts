import { readFileSync } from "node:fs";
import path from "node:path";

const functionsRoot = path.resolve(__dirname, "..", "..");
const syncSource = readFileSync(
  path.join(functionsRoot, "academic-drive-sync", "index.ts"),
  "utf8",
);
const retrieveSource = readFileSync(
  path.join(functionsRoot, "academic-knowledge-retrieve", "index.ts"),
  "utf8",
);
const oauthSource = readFileSync(
  path.join(functionsRoot, "document-drive-oauth", "index.ts"),
  "utf8",
);
const driveAuthSource = readFileSync(
  path.join(functionsRoot, "_shared", "google-drive-auth.ts"),
  "utf8",
);
const structuredExtractionSource = readFileSync(
  path.join(functionsRoot, "_shared", "document-structured-extraction.ts"),
  "utf8",
);
const migrationSource = readFileSync(
  path.resolve(
    functionsRoot,
    "..",
    "migrations",
    "20260716120000_add_personal_academic_document_foundation.sql",
  ),
  "utf8",
);
const duplicateReviewSource = readFileSync(
  path.resolve(
    functionsRoot,
    "..",
    "scripts",
    "check-document-interpretation-duplicates.sql",
  ),
  "utf8",
);
const replacementCandidateMigrationSource = readFileSync(
  path.resolve(
    functionsRoot,
    "..",
    "migrations",
    "20260719221351_add_global_academic_replacement_candidates.sql",
  ),
  "utf8",
);

describe("academic Edge runtime contract", () => {
  test("mantém conexões e fontes idempotentes dentro do escopo correto", () => {
    expect(syncSource).toMatch(
      /onConflict:\s*"organization_id,user_id,connection_scope,sync_root_folder_id,source_profile"/,
    );
    expect(syncSource).toMatch(
      /onConflict:\s*"organization_id,connection_id,provider,external_id"/,
    );
    expect(syncSource).not.toContain("organization_id,provider,external_id");
  });

  test("autoriza pelo JWT/RLS antes de criar o cliente administrativo", () => {
    const membershipCheck = syncSource.indexOf('.from("organization_members")');
    const adminClientCreation = syncSource.indexOf(
      "const admin = createAdminClient();",
    );

    expect(membershipCheck).toBeGreaterThan(-1);
    expect(adminClientCreation).toBeGreaterThan(membershipCheck);
    expect(retrieveSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(syncSource).toContain('redirect: "manual"');
    expect(syncSource).toContain("resolveSafeGoogleDriveRedirect");
    expect(syncSource).not.toContain('redirect: "follow"');
  });

  test("limita download, expansão e tempo de extração dos documentos", () => {
    expect(syncSource).toContain("AbortSignal.timeout(DRIVE_FETCH_TIMEOUT_MS)");
    expect(syncSource).toContain("capabilities(canDownload)");
    expect(syncSource).toContain("download_not_allowed");
    expect(syncSource).toContain("pdf_signature_mismatch");
    expect(syncSource).toContain("docx_signature_mismatch");
    expect(syncSource).toContain("inspectZipExpansion");
    expect(syncSource).toContain("docx_expansion_limit");
    expect(syncSource).toContain("pdf_page_limit");
    expect(syncSource).toContain("DOCUMENT_EXTRACTION_TIMEOUT_MS");
    expect(syncSource).toContain("MAX_COMPLEX_DOCUMENT_BYTES");
    expect(syncSource).toContain('errorCode: "complex_document_too_large"');
    expect(syncSource).toContain("const revisionByteSize =");
    expect(syncSource).toContain("byte_size: revisionByteSize");
  });

  test("não encaminha credenciais OAuth para o host assinado do download", () => {
    expect(syncSource).toContain("const isGoogleDriveApiHost =");
    expect(syncSource).toContain('headers.delete("Authorization")');
    expect(syncSource).toContain(
      'headers.delete("X-Goog-Drive-Resource-Keys")',
    );
  });

  test("divide a ingestão em lotes retomáveis e recupera execução interrompida", () => {
    expect(syncSource).toContain("planDocumentSyncBatch");
    expect(syncSource).toContain('status: "in_progress"');
    expect(syncSource).toContain("nextCursor: syncBatch.nextCursor");
    expect(syncSource).toContain('body?.action === "recover"');
    expect(syncSource).toContain('sync_error_code: "worker_resource_limit"');
    expect(syncSource).toContain("for (const item of syncBatch.items)");
    expect(syncSource).not.toContain("for (const item of driveItems)");
    expect(syncSource).toContain('body?.continuationMode === "server"');
    expect(syncSource).toContain("edgeRuntime.waitUntil");
    expect(syncSource).toContain('sync_error_code: "continuation_failed"');
  });

  test("suporta OAuth, service account, API key e resource key sem expor tokens", () => {
    expect(syncSource).toContain("resolveGoogleDriveCredential");
    expect(syncSource).toContain("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON");
    expect(driveAuthSource).toContain("X-Goog-Drive-Resource-Keys");
    expect(oauthSource).toContain("createPkceChallenge");
    expect(oauthSource).toContain("encryptDriveRefreshToken");
    expect(oauthSource).toContain("hasOAuthCredential");
    expect(oauthSource).toContain("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON");
    expect(oauthSource).toContain("GOOGLE_DRIVE_API_KEY");
    expect(oauthSource).toContain('action === "disconnect"');
    expect(oauthSource).toContain("revokeGoogleDriveToken");
    expect(oauthSource).toContain("preservedDocuments: true");
    expect(oauthSource).toContain('prompt: "consent"');
    expect(oauthSource).toContain('access_type: "offline"');
    expect(oauthSource).not.toContain("console.log");
    expect(driveAuthSource).toContain('"AES-GCM"');
    expect(driveAuthSource).toContain('"RSASSA-PKCS1-v1_5"');
  });

  test("preserva tabelas de Docs, DOCX e Sheets antes da interpretação", () => {
    expect(syncSource).toContain("mammoth.convertToHtml({ buffer: bytes })");
    expect(syncSource).not.toContain("mammoth.convertToHtml({ arrayBuffer:");
    expect(syncSource).toContain("convertDocumentHtmlToStructuredText");
    expect(syncSource).toContain("convertWorkbookToStructuredText");
    expect(syncSource).toContain("xlsx_structured_rows");
    expect(syncSource).toContain("docx_structured_html");
    expect(structuredExtractionSource).toContain("[TABELA ");
    expect(structuredExtractionSource).toContain("[PLANILHA:");
    expect(structuredExtractionSource).toContain("Coluna ${cellIndex + 1}");
  });

  test("mantém IDs pessoais estáveis por organização e usuário", () => {
    expect(syncSource).toContain(
      "id: `academic_personal_v1_${organizationPart}_${ownerPart}`",
    );
    expect(syncSource).toContain(
      "label: `base-academica-pessoal-v1-${ownerPart}`",
    );
    expect(syncSource).toContain(
      "? `academic_${stableIdPart(organizationId)}_${stableIdPart(",
    );
    expect(syncSource).toContain(")}_${stableIdPart(item.id)}`");
  });

  test("normaliza campos obrigatórios e registra somente o estágio da falha", () => {
    expect(syncSource).toContain('authors: author || ""');
    expect(syncSource).toContain('source_url: sourceUrl || ""');
    expect(syncSource).toContain("const markSourceFailure = async (");
    expect(syncSource).toContain('"knowledge_source_upsert",');
    expect(syncSource).toContain('"content_extraction",');
    expect(syncSource).toContain("lastSyncFailure: {");
    expect(syncSource).not.toContain("knowledgeSourceError.message");
    expect(syncSource).not.toContain("knowledgeSourceError.details");
  });

  test("não inventa período, instituição ou vínculo com turma", () => {
    expect(syncSource).not.toContain("2026.1");
    expect(syncSource).not.toContain("Instituição de ensino não identificada");
    expect(syncSource).toMatch(/academic_period:\s*academicPeriod \|\| null/);
    expect(syncSource).toMatch(/institution:\s*institution \|\| null/);
    expect(syncSource).toContain('sourceScope === "user_academic" ||');
    expect(syncSource).toContain('sourceScope === "workspace_academic"');
    expect(syncSource).toContain("resolveExplicitClassBinding");
  });

  test("aceita múltiplas pastas somente por perfil permitido e confirmação de turma", () => {
    expect(syncSource).toContain("DOCUMENT_DRIVE_SOURCE_PROFILES");
    expect(syncSource).toContain("requestedSourceProfile: body?.sourceProfile");
    expect(syncSource).toContain("requestedAcademicScope: body?.academicScope");
    expect(syncSource).toContain('.eq("sync_root_folder_id", folderId)');
    expect(syncSource).toContain('.eq("source_profile", policy.sourceProfile)');
    expect(syncSource).toContain('"CLASS_BINDING_CONFLICT"');
    expect(syncSource).toContain('"CLASS_OUT_OF_SCOPE"');
    expect(syncSource).toContain('"class_binding_unresolved"');
    expect(syncSource).toContain('"source_role_unresolved"');
    expect(syncSource).toContain('"month_unresolved"');
    expect(syncSource).toContain('"document_date_unresolved"');
    expect(syncSource).toContain(
      'classBindingStatus: effectiveClassId ? "confirmed" : "unresolved"',
    );
  });

  test("persiste papel, mês e binding confirmado no runtime documental existente", () => {
    expect(syncSource).toContain("classifyDriveFolderRole");
    expect(syncSource).toContain("resolveDriveMonth");
    expect(syncSource).toContain("resolveDriveDocumentDate");
    expect(syncSource).toContain("documentTypeForFolderRole");
    expect(syncSource).toContain("source_profile: policy.sourceProfile");
    expect(syncSource).toContain("folder_role: folderRole");
    expect(syncSource).toContain("month_key: month?.monthKey ?? null");
    expect(syncSource).toContain("documentDate: documentDate?.dateKey ?? null");
    expect(syncSource).toContain("const classificationKey = await sha256(");
    expect(syncSource).toContain(")?.classificationKey === classificationKey");
    expect(syncSource).toContain('.from("document_context_bindings")');
    expect(syncSource).toContain('{ onConflict: "binding_key" }');
    expect(migrationSource).toContain(
      "unique (\n      organization_id,\n      user_id,\n      connection_scope,\n      sync_root_folder_id,\n      source_profile",
    );
    expect(migrationSource).toContain(
      "document source class binding was not explicitly confirmed",
    );
    expect(migrationSource).toContain(
      "document_context_bindings_binding_key_key unique (binding_key)",
    );
    expect(migrationSource).toContain("new.class_id := source_row.class_id");
  });

  test("preserva o escopo legado e restringe documentos e memórias à turma/usuário", () => {
    expect(migrationSource).toContain("with latest_interpretation as (");
    expect(migrationSource).toContain(
      "when source_id is not null or lower(level) = 'evidence' then 'scientific_reference'",
    );
    expect(migrationSource).toContain(
      "where source_document_id is null\n  and source_revision_id is null",
    );
    expect(migrationSource).toContain("or public.is_class_staff(class_id)");
    expect(migrationSource).toContain(
      "user_id = (select auth.uid())\n    and (select public.is_org_member(organization_id))",
    );
  });

  test("preserva duplicatas históricas e escolhe um canônico para novas sincronizações", () => {
    expect(migrationSource).toContain("canonical_revision_id uuid");
    expect(migrationSource).toContain("ranked_interpretations as (");
    expect(migrationSource).toContain("partition by revision_id");
    expect(migrationSource).toContain(
      "create unique index if not exists document_interpretations_canonical_revision_unique",
    );
    expect(migrationSource).not.toMatch(
      /delete\s+from\s+public\.document_interpretations/i,
    );
    expect(syncSource).toContain("canonical_revision_id: revision.id");
    expect(syncSource).toContain('{ onConflict: "canonical_revision_id" }');
    expect(duplicateReviewSource).toContain(
      "group by interpretation.revision_id",
    );
    expect(duplicateReviewSource).toContain("having count(*) > 1");
    expect(duplicateReviewSource).not.toMatch(
      /\b(delete|update|insert|alter|drop)\b/i,
    );
  });

  test("usa a assinatura canônica da RPC e não eleva o filtro de material", () => {
    for (const parameter of [
      "_organization_id",
      "_owner_user_id",
      "_query_embedding",
      "_query_text",
      "_academic_areas",
      "_evidence_kinds",
      "_match_count",
    ]) {
      expect(retrieveSource).toContain(`${parameter}:`);
    }
    expect(retrieveSource).not.toContain("_material_types:");
    expect(retrieveSource).toContain('.eq("source_scope", "user_academic")');
    expect(retrieveSource).toContain('.is("class_id", null)');
  });

  test("versiona correções globais sem mutar publicações imutáveis", () => {
    expect(replacementCandidateMigrationSource).toContain(
      "next_publication_version := coalesce(item.publication_version, 0) + 1",
    );
    expect(replacementCandidateMigrationSource).toContain(
      "item.publication_status = 'awaiting_review'",
    );
    expect(replacementCandidateMigrationSource).toContain(
      "audit.idempotency_key = p_idempotency_key",
    );
    expect(replacementCandidateMigrationSource).toContain(
      "for update",
    );
    expect(replacementCandidateMigrationSource).not.toMatch(
      /delete\s+from\s+public\.global_academic_interpretations/i,
    );
  });
});
