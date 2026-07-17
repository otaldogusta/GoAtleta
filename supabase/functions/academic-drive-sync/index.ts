// eslint-disable-next-line import/no-unresolved
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createEdgeFunction,
  createError,
  createSuccess,
} from "../_shared/framework.ts";
import {
  DEFAULT_ACADEMIC_DRIVE_FOLDER_ID,
  chunkAcademicContent,
  classifyAcademicDriveItem,
  normalizeAcademicContentForHash,
  parseGoogleDriveFolderId,
  sanitizeUntrustedAcademicContent,
} from "../_shared/academic-knowledge.ts";
import {
  assertSafeGoogleDriveFetchUrl,
  classifyDriveFolderRole,
  documentTypeForFolderRole,
  parseConfiguredDriveSourceProfiles,
  resolveAllowedDriveSource,
  resolveDriveDocumentDate,
  resolveDriveMonth,
  resolveDriveSourceProfile,
  resolveExplicitClassBinding,
  resolveSafeGoogleDriveRedirect,
  type DriveAcademicScope,
  type DriveAuthStrategy,
  type DriveFolderRole,
  type DriveSourceProfile,
  type DriveSourceProfilePolicy,
} from "../_shared/document-drive-source.ts";
import {
  buildGoogleDriveHeaders,
  resolveGoogleDriveCredential,
  type GoogleDriveCredential,
} from "../_shared/google-drive-auth.ts";
import {
  convertDocumentHtmlToStructuredText,
  convertWorkbookToStructuredText,
} from "../_shared/document-structured-extraction.ts";
import { planDocumentSyncBatch } from "../_shared/document-sync-batch.ts";

type SyncRequest = {
  action?: "sync" | "recover";
  continuationMode?: "server";
  organizationId?: string;
  folderUrl?: string;
  sourceProfile?: DriveSourceProfile;
  academicScope?: DriveAcademicScope;
  classId?: string;
  classBindingConfirmed?: boolean;
  maxFiles?: number;
  cursor?: number;
  batchSize?: number;
  priorFailed?: number;
  priorReviewRequired?: number;
  dryRun?: boolean;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  createdTime?: string;
  size?: string;
  md5Checksum?: string;
  version?: string;
  webViewLink?: string;
  description?: string;
  resourceKey?: string;
  capabilities?: {
    canDownload?: boolean;
  };
};

type DriveItem = DriveFile & {
  path: string[];
};

type ExtractedContent = {
  status: "ready" | "review_required" | "failed";
  content: string;
  byteSize: number | null;
  pageCount: number | null;
  errorCode: string | null;
  extractionFormat?: string | null;
};

const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SLIDES_MIME = "application/vnd.google-apps.presentation";
const GOOGLE_SHEETS_MIME = "application/vnd.google-apps.spreadsheet";
const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_COMPLEX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const MAX_EXPANDED_DOCUMENT_BYTES = 50 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 1_000_000;
const MAX_PDF_PAGES = 250;
const MAX_ARCHIVE_ENTRIES = 5_000;
const DRIVE_FETCH_TIMEOUT_MS = 15_000;
const DOCUMENT_EXTRACTION_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_FILES = 60;
const MAX_FILES = 120;
const MAX_CHUNKS_PER_FILE = 28;
const MAX_DRIVE_LIST_PAGES = 10;
const MAX_FOLDER_DEPTH = 12;
const MAX_FOLDER_VISITS = 240;
const DOCUMENT_DRIVE_PARSER_VERSION = "4";

const createAdminClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
};

const textValue = (value: unknown) => String(value ?? "").trim();

const clampMaxFiles = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_FILES;
  return Math.max(1, Math.min(Math.floor(parsed), MAX_FILES));
};

const safeCount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(0, Math.min(Math.floor(parsed), MAX_FILES))
    : 0;
};

const configuredAcademicFolderIds = () =>
  textValue(Deno.env.get("ACADEMIC_DRIVE_ALLOWED_FOLDER_IDS"))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const resolveAllowedSource = (params: {
  folderId: string;
  requestedSourceProfile?: unknown;
  requestedAcademicScope?: unknown;
}) =>
  resolveAllowedDriveSource({
    ...params,
    defaultAcademicFolderId: DEFAULT_ACADEMIC_DRIVE_FOLDER_ID,
    configuredAcademicFolderIds: configuredAcademicFolderIds(),
    configuredProfiles: parseConfiguredDriveSourceProfiles(
      Deno.env.get("DOCUMENT_DRIVE_SOURCE_PROFILES"),
    ),
  });

const escapeDriveQueryValue = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const driveApiUrl = (
  path: string,
  credential: GoogleDriveCredential,
  params: URLSearchParams,
) => {
  const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
  if (credential.apiKey) params.set("key", credential.apiKey);
  url.search = params.toString();
  return url.toString();
};

const isGoogleDriveApiHost = (value: string) => {
  const hostname = new URL(value).hostname.toLowerCase();
  return (
    hostname === "www.googleapis.com" || hostname.endsWith(".googleapis.com")
  );
};

const fetchDriveResponse = async (
  url: string,
  credential: GoogleDriveCredential,
  resourceKeys: { fileId: string; resourceKey?: string | null }[] = [],
) => {
  let currentUrl = assertSafeGoogleDriveFetchUrl(url).toString();
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const headers = buildGoogleDriveHeaders({ credential, resourceKeys });
    if (!isGoogleDriveApiHost(currentUrl)) {
      headers.delete("Authorization");
      headers.delete("X-Goog-Drive-Resource-Keys");
    }
    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(DRIVE_FETCH_TIMEOUT_MS),
      headers,
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount >= 3) {
        throw new Error("google_drive_unsafe_redirect");
      }
      currentUrl = resolveSafeGoogleDriveRedirect(currentUrl, location);
      continue;
    }
    if (!response.ok) {
      throw new Error(`google_drive_${response.status}`);
    }
    return response;
  }
  throw new Error("google_drive_redirect_limit");
};

const getDriveFolder = async (
  folderId: string,
  credential: GoogleDriveCredential,
  resourceKey?: string | null,
) => {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,resourceKey",
    supportsAllDrives: "true",
  });
  const response = await fetchDriveResponse(
    driveApiUrl(`files/${encodeURIComponent(folderId)}`, credential, params),
    credential,
    [{ fileId: folderId, resourceKey }],
  );
  const folder = (await response.json()) as DriveFile;
  if (folder.mimeType !== GOOGLE_FOLDER_MIME) {
    throw new Error("google_drive_root_not_folder");
  }
  return folder;
};

const listDriveChildren = async (
  parentId: string,
  credential: GoogleDriveCredential,
  parentResourceKey?: string | null,
): Promise<DriveFile[]> => {
  const files: DriveFile[] = [];
  let pageToken = "";
  let pageCount = 0;

  do {
    const params = new URLSearchParams({
      q: `'${escapeDriveQueryValue(parentId)}' in parents and trashed = false`,
      fields:
        "nextPageToken,files(id,name,mimeType,modifiedTime,createdTime,size,md5Checksum,version,webViewLink,description,resourceKey,capabilities(canDownload))",
      pageSize: "1000",
      orderBy: "folder,name",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetchDriveResponse(
      driveApiUrl("files", credential, params),
      credential,
      [{ fileId: parentId, resourceKey: parentResourceKey }],
    );
    const payload = (await response.json()) as {
      files?: DriveFile[];
      nextPageToken?: string;
    };
    files.push(...(Array.isArray(payload.files) ? payload.files : []));
    pageToken = textValue(payload.nextPageToken);
    pageCount += 1;
  } while (pageToken && pageCount < MAX_DRIVE_LIST_PAGES);

  return files;
};

const walkDriveFolder = async (
  folderId: string,
  credential: GoogleDriveCredential,
  maxFiles: number,
  rootResourceKey?: string | null,
) => {
  const files: DriveItem[] = [];
  const rootFolder = await getDriveFolder(
    folderId,
    credential,
    rootResourceKey,
  );
  const queue: {
    id: string;
    path: string[];
    resourceKey?: string | null;
  }[] = [
    {
      id: folderId,
      path: rootFolder.name ? [rootFolder.name] : [],
      resourceKey: rootFolder.resourceKey || rootResourceKey,
    },
  ];
  const visited = new Set<string>();

  while (
    queue.length &&
    files.length < maxFiles &&
    visited.size < MAX_FOLDER_VISITS
  ) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    const children = await listDriveChildren(
      current.id,
      credential,
      current.resourceKey,
    );
    for (const child of children) {
      if (child.mimeType === GOOGLE_FOLDER_MIME) {
        if (current.path.length < MAX_FOLDER_DEPTH) {
          queue.push({
            id: child.id,
            path: [...current.path, child.name],
            resourceKey: child.resourceKey,
          });
        }
        continue;
      }
      files.push({ ...child, path: current.path });
      if (files.length >= maxFiles) break;
    }
  }

  return files;
};

const downloadDriveBytes = async (
  file: DriveFile,
  credential: GoogleDriveCredential,
) => {
  const params = new URLSearchParams();
  let path = `files/${encodeURIComponent(file.id)}`;

  if (file.mimeType === GOOGLE_DOC_MIME) {
    path += "/export";
    params.set("mimeType", DOCX_MIME);
  } else if (file.mimeType === GOOGLE_SHEETS_MIME) {
    path += "/export";
    params.set(
      "mimeType",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  } else if (file.mimeType === GOOGLE_SLIDES_MIME) {
    path += "/export";
    params.set("mimeType", "text/plain");
  } else {
    params.set("alt", "media");
  }

  return fetchDriveResponse(driveApiUrl(path, credential, params), credential, [
    { fileId: file.id, resourceKey: file.resourceKey },
  ]);
};

const withTimeout = <T>(
  operation: Promise<T>,
  timeoutMs: number,
  errorCode: string,
) =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(errorCode)), timeoutMs);
    operation.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });

const inspectZipExpansion = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let entryCount = 0;
  let expandedBytes = 0;

  for (let index = 0; index <= bytes.length - 46; index += 1) {
    if (view.getUint32(index, true) !== 0x02014b50) continue;
    const compressedSize = view.getUint32(index + 20, true);
    const uncompressedSize = view.getUint32(index + 24, true);
    const fileNameLength = view.getUint16(index + 28, true);
    const extraLength = view.getUint16(index + 30, true);
    const commentLength = view.getUint16(index + 32, true);
    const recordLength = 46 + fileNameLength + extraLength + commentLength;
    if (recordLength <= 46 || index + recordLength > bytes.length) {
      return { safe: false, errorCode: "docx_directory_invalid" };
    }

    entryCount += 1;
    expandedBytes += uncompressedSize;
    if (
      entryCount > MAX_ARCHIVE_ENTRIES ||
      expandedBytes > MAX_EXPANDED_DOCUMENT_BYTES ||
      (compressedSize > 0 && uncompressedSize / compressedSize > 200)
    ) {
      return { safe: false, errorCode: "docx_expansion_limit" };
    }
    index += recordLength - 1;
  }

  return {
    safe: entryCount > 0,
    errorCode: entryCount > 0 ? null : "docx_directory_missing",
  };
};

const extractFileContent = async (
  file: DriveFile,
  credential: GoogleDriveCredential,
): Promise<ExtractedContent> => {
  if (file.capabilities?.canDownload === false) {
    return {
      status: "review_required",
      content: "",
      byteSize: Number(file.size ?? 0) || null,
      pageCount: null,
      errorCode: "download_not_allowed",
    };
  }
  const advertisedSize = Number(file.size ?? 0);
  if (advertisedSize > MAX_FILE_BYTES) {
    return {
      status: "review_required",
      content: "",
      byteSize: advertisedSize,
      pageCount: null,
      errorCode: "file_too_large",
    };
  }

  const supportedText =
    file.mimeType === GOOGLE_SLIDES_MIME || file.mimeType.startsWith("text/");
  const supportedBinary =
    file.mimeType === PDF_MIME ||
    file.mimeType === DOCX_MIME ||
    file.mimeType === GOOGLE_DOC_MIME ||
    file.mimeType === GOOGLE_SHEETS_MIME;
  if (!supportedText && !supportedBinary) {
    return {
      status: "review_required",
      content: "",
      byteSize: advertisedSize || null,
      pageCount: null,
      errorCode: "unsupported_mime",
    };
  }

  try {
    const response = await downloadDriveBytes(file, credential);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_FILE_BYTES) {
      return {
        status: "review_required",
        content: "",
        byteSize: buffer.byteLength,
        pageCount: null,
        errorCode: "file_too_large",
      };
    }
    if (supportedBinary && buffer.byteLength > MAX_COMPLEX_DOCUMENT_BYTES) {
      return {
        status: "review_required",
        content: "",
        byteSize: buffer.byteLength,
        pageCount: null,
        errorCode: "complex_document_too_large",
      };
    }

    const bytes = new Uint8Array(buffer);
    if (supportedText) {
      const content = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
      const controlCharacters = [...content].filter((character) => {
        const code = character.charCodeAt(0);
        return code < 32 && ![9, 10, 13].includes(code);
      }).length;
      if (content.length && controlCharacters / content.length > 0.01) {
        return {
          status: "review_required",
          content: "",
          byteSize: buffer.byteLength,
          pageCount: null,
          errorCode: "text_signature_mismatch",
        };
      }
      return {
        status: "ready",
        content,
        byteSize: buffer.byteLength,
        pageCount: null,
        errorCode: null,
        extractionFormat: "plain_text",
      };
    }

    if (file.mimeType === PDF_MIME) {
      const hasPdfSignature =
        bytes.length >= 5 &&
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46 &&
        bytes[4] === 0x2d;
      if (!hasPdfSignature) {
        return {
          status: "review_required",
          content: "",
          byteSize: buffer.byteLength,
          pageCount: null,
          errorCode: "pdf_signature_mismatch",
        };
      }
      // eslint-disable-next-line import/no-unresolved
      const { extractText, getDocumentProxy } = await import("npm:unpdf@1.4.0");
      const pdf = await withTimeout(
        getDocumentProxy(bytes),
        DOCUMENT_EXTRACTION_TIMEOUT_MS,
        "pdf_extraction_timeout",
      );
      if (pdf.numPages > MAX_PDF_PAGES) {
        return {
          status: "review_required",
          content: "",
          byteSize: buffer.byteLength,
          pageCount: pdf.numPages,
          errorCode: "pdf_page_limit",
        };
      }
      const result = await withTimeout(
        extractText(pdf, { mergePages: true }),
        DOCUMENT_EXTRACTION_TIMEOUT_MS,
        "pdf_extraction_timeout",
      );
      const content = textValue(result.text);
      if (content.length > MAX_EXTRACTED_CHARACTERS) {
        return {
          status: "review_required",
          content: "",
          byteSize: buffer.byteLength,
          pageCount: result.totalPages,
          errorCode: "extracted_content_too_large",
        };
      }
      return {
        status: content ? "ready" : "review_required",
        content,
        byteSize: buffer.byteLength,
        pageCount: result.totalPages,
        errorCode: content ? null : "pdf_without_extractable_text",
        extractionFormat: "pdf_text",
      };
    }

    const hasZipSignature =
      bytes.length >= 4 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
        (bytes[2] === 0x05 && bytes[3] === 0x06) ||
        (bytes[2] === 0x07 && bytes[3] === 0x08));
    if (!hasZipSignature) {
      return {
        status: "review_required",
        content: "",
        byteSize: buffer.byteLength,
        pageCount: null,
        errorCode:
          file.mimeType === GOOGLE_SHEETS_MIME
            ? "spreadsheet_signature_mismatch"
            : "docx_signature_mismatch",
      };
    }
    const zipInspection = inspectZipExpansion(bytes);
    if (!zipInspection.safe) {
      return {
        status: "review_required",
        content: "",
        byteSize: buffer.byteLength,
        pageCount: null,
        errorCode: zipInspection.errorCode,
      };
    }
    let content = "";
    let extractionFormat = "";
    if (file.mimeType === GOOGLE_SHEETS_MIME) {
      content = await withTimeout(
        convertWorkbookToStructuredText(buffer),
        DOCUMENT_EXTRACTION_TIMEOUT_MS,
        "spreadsheet_extraction_timeout",
      );
      extractionFormat = "xlsx_structured_rows";
    } else {
      // eslint-disable-next-line import/no-unresolved
      const mammothModule = await import("npm:mammoth@1.10.0");
      const mammoth = mammothModule.default ?? mammothModule;
      const result = await withTimeout(
        mammoth.convertToHtml({ buffer: bytes }),
        DOCUMENT_EXTRACTION_TIMEOUT_MS,
        "docx_extraction_timeout",
      );
      content = convertDocumentHtmlToStructuredText(textValue(result.value));
      extractionFormat = "docx_structured_html";
    }
    if (content.length > MAX_EXTRACTED_CHARACTERS) {
      return {
        status: "review_required",
        content: "",
        byteSize: buffer.byteLength,
        pageCount: null,
        errorCode: "extracted_content_too_large",
      };
    }
    return {
      status: content ? "ready" : "review_required",
      content,
      byteSize: buffer.byteLength,
      pageCount: null,
      errorCode: content
        ? null
        : file.mimeType === GOOGLE_SHEETS_MIME
          ? "spreadsheet_without_extractable_cells"
          : "docx_without_extractable_text",
      extractionFormat,
    };
  } catch (error) {
    return {
      status: "failed",
      content: "",
      byteSize: advertisedSize || null,
      pageCount: null,
      errorCode:
        error instanceof Error
          ? error.message.slice(0, 160)
          : "extraction_failed",
    };
  }
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const stableIdPart = (value: string) =>
  value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 110);

const inferAuthor = (content: string) => {
  const firstLines = content.split("\n").slice(0, 40).join("\n");
  const match = firstLines.match(
    /(?:autor(?:a|es)?|acad[eê]mic[oa]|alun[oa])\s*[:\-]\s*([^\n]{3,120})/i,
  );
  return textValue(match?.[1]).slice(0, 160);
};

const inferInstitution = (content: string, path: string[]) => {
  const candidates = [...path, ...content.split("\n").slice(0, 60)];
  const institutionalLine = candidates.find((line) =>
    /\b(universidade|faculdade|centro universit[aá]rio|instituto federal)\b/i.test(
      line,
    ),
  );
  return textValue(institutionalLine).replace(/\s+/g, " ").slice(0, 180);
};

const inferAcademicPeriod = (path: string[]) => {
  const match = path.join(" ").match(/\b(\d{1,2})\s*[ºo]\s*per[ií]odo\b/i);
  const periodNumber = Number(match?.[1]);
  return Number.isInteger(periodNumber) && periodNumber > 0
    ? `${periodNumber}º PERÍODO`
    : "";
};

const sourceTypeFromEvidence = (evidenceKind: string) => {
  if (evidenceKind === "official_norm") return "policy";
  if (evidenceKind === "scientific_research") return "paper";
  if (evidenceKind === "published_book") return "book";
  return "other";
};

const sourceScopeForFolderRole = (
  folderRole: DriveFolderRole,
  policy: DriveSourceProfilePolicy,
) =>
  folderRole === "academic"
    ? policy.sourceScope
    : resolveDriveSourceProfile({ sourceProfile: folderRole }).sourceScope;

const knowledgeVersionForSource = (params: {
  organizationId: string;
  userId: string;
  connectionId: string;
  policy: DriveSourceProfilePolicy;
}) => {
  const organizationPart = stableIdPart(params.organizationId);
  if (params.policy.sourceScope === "user_academic") {
    const ownerPart = stableIdPart(params.userId);
    return {
      id: `academic_personal_v1_${organizationPart}_${ownerPart}`,
      label: `base-academica-pessoal-v1-${ownerPart}`,
      description:
        "Materiais acadêmicos pessoais usados somente como apoio contextual.",
    };
  }
  const profilePart = stableIdPart(params.policy.sourceProfile);
  const connectionPart = stableIdPart(params.connectionId);
  return {
    id: `document_drive_v1_${organizationPart}_${connectionPart}`,
    label: `documentos-drive-v1-${profilePart}-${connectionPart}`,
    description:
      "Documentos do Drive ingeridos como evidências rastreáveis do runtime documental.",
  };
};

const createEmbeddings = async (texts: string[]) => {
  const apiKey = textValue(Deno.env.get("OPENAI_API_KEY"));
  if (!apiKey || !texts.length) return texts.map(() => null);

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
      dimensions: 1536,
    }),
  });
  if (!response.ok) return texts.map(() => null);
  const payload = (await response.json()) as {
    data?: { index: number; embedding: number[] }[];
  };
  const byIndex = new Map(
    (payload.data ?? [])
      .filter(
        (item) =>
          Array.isArray(item.embedding) &&
          item.embedding.length === 1536 &&
          item.embedding.every(Number.isFinite),
      )
      .map((item) => [item.index, item.embedding]),
  );
  return texts.map((_, index) => byIndex.get(index) ?? null);
};

const buildEmbeddingBatches = async (texts: string[]) => {
  const result: (number[] | null)[] = [];
  for (let index = 0; index < texts.length; index += 32) {
    result.push(...(await createEmbeddings(texts.slice(index, index + 32))));
  }
  return result;
};

Deno.serve(
  createEdgeFunction<SyncRequest>({
    name: "academic-drive-sync",
    requireAuth: true,
    parseJson: true,
    handler: async ({ user, body, supabase, token }) => {
      if (!user) return createError(401, "UNAUTHORIZED", "Sessão inválida.");
      const organizationId = textValue(body?.organizationId);
      if (!organizationId) {
        return createError(400, "BAD_REQUEST", "organizationId é obrigatório.");
      }

      let folderId: string;
      try {
        folderId = parseGoogleDriveFolderId(
          textValue(body?.folderUrl) || DEFAULT_ACADEMIC_DRIVE_FOLDER_ID,
        );
      } catch (error) {
        return createError(
          400,
          "BAD_REQUEST",
          error instanceof Error ? error.message : "Pasta inválida.",
        );
      }
      const allowedSource = resolveAllowedSource({
        folderId,
        requestedSourceProfile: body?.sourceProfile,
        requestedAcademicScope: body?.academicScope,
      });
      if (!allowedSource) {
        return createError(
          403,
          "FOLDER_NOT_ALLOWED",
          "A pasta e o perfil informados não estão autorizados para ingestão.",
        );
      }

      let policy: DriveSourceProfilePolicy;
      let requestedClassBinding: ReturnType<typeof resolveExplicitClassBinding>;
      try {
        policy = resolveDriveSourceProfile({
          sourceProfile: allowedSource.sourceProfile,
          academicScope: allowedSource.academicScope ?? undefined,
        });
        requestedClassBinding = resolveExplicitClassBinding({
          policy,
          classId: body?.classId,
          classBindingConfirmed: body?.classBindingConfirmed,
        });
      } catch (error) {
        return createError(
          400,
          "BAD_REQUEST",
          error instanceof Error
            ? error.message
            : "Perfil documental inválido.",
        );
      }

      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("role_level")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (
        membershipError ||
        !membership ||
        Number(membership.role_level ?? 0) < policy.minimumRoleLevel
      ) {
        return createError(
          403,
          "FORBIDDEN",
          policy.minimumRoleLevel >= 40
            ? "Somente gestores do workspace podem sincronizar esta fonte."
            : "Usuário sem perfil de professor neste workspace.",
        );
      }

      const admin = createAdminClient();
      if (!admin) {
        return createError(
          503,
          "UNAVAILABLE",
          "Sincronização documental indisponível.",
        );
      }

      const { data: existingConnection, error: existingConnectionError } =
        await admin
          .from("google_drive_connections")
          .select(
            "id,bound_class_id,class_binding_confirmed_at,class_binding_confirmed_by,refresh_token_ciphertext,refresh_token_iv,auth_strategy,token_updated_at",
          )
          .eq("organization_id", organizationId)
          .eq("user_id", user.id)
          .eq("connection_scope", policy.connectionScope)
          .eq("sync_root_folder_id", folderId)
          .eq("source_profile", policy.sourceProfile)
          .maybeSingle();
      if (existingConnectionError) {
        return createError(
          500,
          "PERSISTENCE_ERROR",
          "Não foi possível consultar o vínculo da fonte.",
        );
      }
      if (body?.action === "recover") {
        if (existingConnection?.id) {
          const completedAt = new Date().toISOString();
          const { error: recoveryError } = await admin
            .from("google_drive_connections")
            .update({
              sync_status: "failed",
              sync_completed_at: completedAt,
              sync_error_code: "worker_resource_limit",
              sync_error_message:
                "A execução foi interrompida e pode ser retomada com segurança.",
              updated_at: completedAt,
            })
            .eq("id", existingConnection.id);
          if (recoveryError) {
            return createError(
              500,
              "PERSISTENCE_ERROR",
              "Não foi possível recuperar o estado da sincronização.",
            );
          }
        }
        return createSuccess({ status: "failed", recovered: true });
      }
      const existingClassId = textValue(existingConnection?.bound_class_id);
      if (
        existingClassId &&
        requestedClassBinding.classId &&
        existingClassId !== requestedClassBinding.classId
      ) {
        return createError(
          409,
          "CLASS_BINDING_CONFLICT",
          "A pasta já possui vínculo confirmado com outra turma.",
        );
      }
      const effectiveClassId =
        requestedClassBinding.classId || existingClassId || null;
      if (effectiveClassId) {
        const { data: sourceClass, error: sourceClassError } = await admin
          .from("classes")
          .select("id")
          .eq("id", effectiveClassId)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (sourceClassError || !sourceClass?.id) {
          return createError(
            400,
            "CLASS_OUT_OF_SCOPE",
            "A turma confirmada não pertence ao workspace informado.",
          );
        }
      }

      let driveCredential: GoogleDriveCredential;
      try {
        driveCredential = await resolveGoogleDriveCredential({
          requestedStrategy: (allowedSource.authStrategy ??
            "auto") as DriveAuthStrategy,
          storedOAuth: existingConnection
            ? {
                refreshTokenCiphertext:
                  existingConnection.refresh_token_ciphertext,
                refreshTokenIv: existingConnection.refresh_token_iv,
              }
            : null,
          encryptionSecret: Deno.env.get("DOCUMENT_TOKEN_ENCRYPTION_KEY"),
          oauthClientId: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID"),
          oauthClientSecret: Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET"),
          serviceAccountJson: Deno.env.get("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON"),
          apiKey: Deno.env.get("GOOGLE_DRIVE_API_KEY"),
        });
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "drive_not_configured";
        return createError(
          503,
          reason === "google_oauth_required"
            ? "DRIVE_OAUTH_REQUIRED"
            : "DRIVE_NOT_CONFIGURED",
          reason === "google_oauth_required"
            ? "Conecte sua conta Google para ler esta pasta privada."
            : "A integração com o Google Drive ainda não possui credenciais válidas.",
        );
      }

      const maxFiles = clampMaxFiles(body?.maxFiles);
      const dryRun = body?.dryRun === true;
      let driveItems: DriveItem[];
      try {
        driveItems = await walkDriveFolder(
          folderId,
          driveCredential,
          maxFiles,
          allowedSource.resourceKey,
        );
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "google_drive_unavailable";
        return createError(
          502,
          /google_drive_(401|403|404)/.test(reason)
            ? "DRIVE_AUTHORIZATION_FAILED"
            : "DRIVE_UNAVAILABLE",
          /google_drive_(401|403|404)/.test(reason)
            ? "A credencial atual não conseguiu acessar a pasta. Conecte uma conta autorizada ou compartilhe a pasta com a service account."
            : "Não foi possível ler a pasta documental agora.",
        );
      }

      if (dryRun) {
        return createSuccess({
          status: "preview",
          folderId,
          sourceProfile: policy.sourceProfile,
          sourceScope: policy.sourceScope,
          ownerUserId: policy.ownerUserRequired ? user.id : null,
          classId: effectiveClassId,
          classBindingStatus: effectiveClassId ? "confirmed" : "unresolved",
          authStrategy: driveCredential.strategy,
          items: driveItems.map((item) => ({
            id: item.id,
            name: item.name,
            path: item.path,
            mimeType: item.mimeType,
            folderRole: classifyDriveFolderRole({
              sourceProfile: policy.sourceProfile,
              name: item.name,
              path: item.path,
            }),
            month: resolveDriveMonth([...item.path, item.name]),
            academicClassification: classifyAcademicDriveItem(item),
          })),
        });
      }

      const syncBatch = planDocumentSyncBatch({
        items: driveItems,
        cursor: body?.cursor,
        batchSize: body?.batchSize,
      });

      const nowIso = new Date().toISOString();
      const { data: connection, error: connectionError } = await admin
        .from("google_drive_connections")
        .upsert(
          {
            organization_id: organizationId,
            user_id: user.id,
            connection_scope: policy.connectionScope,
            sync_root_folder_id: folderId,
            source_profile: policy.sourceProfile,
            bound_class_id: effectiveClassId,
            class_binding_confirmed_at: effectiveClassId
              ? textValue(existingConnection?.class_binding_confirmed_at) ||
                nowIso
              : null,
            class_binding_confirmed_by: effectiveClassId
              ? textValue(existingConnection?.class_binding_confirmed_by) ||
                user.id
              : null,
            sync_status: "running",
            sync_started_at: nowIso,
            sync_completed_at: null,
            sync_error_code: null,
            sync_error_message: null,
            auth_strategy: driveCredential.strategy,
            expires_at: driveCredential.expiresAt,
            updated_at: nowIso,
          },
          {
            onConflict:
              "organization_id,user_id,connection_scope,sync_root_folder_id,source_profile",
          },
        )
        .select("id,bound_class_id")
        .single();
      if (connectionError || !connection?.id) {
        return createError(
          500,
          "PERSISTENCE_ERROR",
          "Não foi possível iniciar a sincronização.",
        );
      }

      const knowledgeVersion = knowledgeVersionForSource({
        organizationId,
        userId: user.id,
        connectionId: connection.id,
        policy,
      });
      const versionId = knowledgeVersion.id;
      const { error: versionError } = await admin
        .from("knowledge_base_versions")
        .upsert(
          {
            id: versionId,
            organization_id: organizationId,
            domain: "general",
            version_label: knowledgeVersion.label,
            description: knowledgeVersion.description,
            status: "active",
            published_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: "id" },
        );
      if (versionError) {
        await admin
          .from("google_drive_connections")
          .update({
            sync_status: "failed",
            sync_completed_at: new Date().toISOString(),
            sync_error_code: "knowledge_base_unavailable",
            sync_error_message: "Não foi possível preparar a base documental.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);
        return createError(
          500,
          "PERSISTENCE_ERROR",
          "Não foi possível preparar a base documental.",
        );
      }

      const summary = {
        discovered: driveItems.length,
        processed: syncBatch.items.length,
        ready: 0,
        reviewRequired: 0,
        failed: 0,
        unchanged: 0,
        chunks: 0,
        promptInjectionWarnings: 0,
        scopeRejected: 0,
      };

      for (const item of syncBatch.items) {
        const extraction = await extractFileContent(item, driveCredential);
        const sanitized = sanitizeUntrustedAcademicContent(extraction.content);
        if (sanitized.warnings.length) summary.promptInjectionWarnings += 1;
        const sourceUrl =
          textValue(item.webViewLink) ||
          `https://drive.google.com/open?id=${encodeURIComponent(item.id)}`;
        const author = inferAuthor(sanitized.content);
        const institution = inferInstitution(sanitized.content, item.path);
        const academicPeriod = inferAcademicPeriod(item.path);
        const classification = classifyAcademicDriveItem({
          ...item,
          content: sanitized.content,
          institution,
          sourceUrl,
        });
        const folderRole = classifyDriveFolderRole({
          sourceProfile: policy.sourceProfile,
          name: item.name,
          path: item.path,
          content: sanitized.content,
        });
        const sourceScope = sourceScopeForFolderRole(folderRole, policy);
        const documentType = documentTypeForFolderRole(folderRole);
        const month = resolveDriveMonth([...item.path, item.name]);
        const documentDate = resolveDriveDocumentDate([
          ...item.path,
          item.name,
          sanitized.content.slice(0, 4_000),
        ]);
        const ownerUserId = sourceScope === "user_academic" ? user.id : null;
        const sourceClassId =
          sourceScope === "user_academic" ||
          sourceScope === "workspace_academic"
            ? null
            : effectiveClassId;
        let contextReviewCode: string | null = null;
        if (folderRole === "unknown") {
          contextReviewCode = "source_role_unresolved";
        } else if (
          !sourceClassId &&
          (sourceScope === "class_planning" || sourceScope === "class_history")
        ) {
          contextReviewCode = "class_binding_unresolved";
        } else if (folderRole === "monthly_plan" && !month) {
          contextReviewCode = "month_unresolved";
        } else if (
          (folderRole === "report" || folderRole === "lesson_plan") &&
          !documentDate
        ) {
          contextReviewCode = "document_date_unresolved";
        }
        const scopeRejected =
          folderRole === "academic" &&
          classification.knowledgeLayer === "institutional";
        if (scopeRejected) {
          summary.scopeRejected += 1;
        }
        const interpretationWarnings = [
          ...new Set([
            ...sanitized.warnings,
            ...(scopeRejected ? ["institutional_scope_rejected"] : []),
            ...(contextReviewCode ? [contextReviewCode] : []),
          ]),
        ];
        const hashInput =
          normalizeAcademicContentForHash(extraction.content) ||
          [
            item.id,
            item.version,
            item.modifiedTime,
            item.md5Checksum,
            extraction.errorCode,
          ].join("|");
        const contentHash = await sha256(hashInput);
        const classificationKey = await sha256(
          JSON.stringify({
            sourceProfile: policy.sourceProfile,
            folderRole,
            monthKey: month?.monthKey ?? null,
            documentDate: documentDate?.dateKey ?? null,
            sourceScope,
            classId: sourceClassId,
            drivePath: item.path,
          }),
        );
        const revisionByteSize =
          extraction.byteSize !== null &&
          extraction.byteSize >= 0 &&
          extraction.byteSize <= MAX_FILE_BYTES
            ? extraction.byteSize
            : null;

        const { data: existingSource, error: existingSourceError } = await admin
          .from("document_sources")
          .select("id, owner_user_id, source_scope, class_id")
          .eq("organization_id", organizationId)
          .eq("connection_id", connection.id)
          .eq("provider", "google_drive")
          .eq("external_id", item.id)
          .maybeSingle();
        if (existingSourceError) {
          summary.failed += 1;
          continue;
        }
        if (
          ownerUserId &&
          existingSource?.id &&
          textValue(existingSource.owner_user_id) !== ownerUserId
        ) {
          summary.scopeRejected += 1;
          summary.reviewRequired += 1;
          continue;
        }

        const sourcePayload = {
          organization_id: organizationId,
          connection_id: connection.id,
          provider: "google_drive",
          source_scope: sourceScope,
          owner_user_id: ownerUserId,
          source_profile: policy.sourceProfile,
          folder_role: folderRole,
          month_key: month?.monthKey ?? null,
          folder_id: folderId,
          external_id: item.id,
          source_url: sourceUrl,
          filename: item.name,
          mime_type: item.mimeType,
          discipline: classification.discipline,
          academic_area: classification.academicArea,
          material_type: classification.materialType,
          evidence_kind: classification.evidenceKind,
          author: author || null,
          institution: institution || null,
          academic_period: academicPeriod || null,
          unit_id: null,
          modality_id: null,
          class_id: sourceClassId,
          created_by: user.id,
          metadata: {
            sourcePath: item.path,
            classificationConfidence: classification.confidence,
            knowledgeLayer: classification.knowledgeLayer,
            sourceProfile: policy.sourceProfile,
            folderRole,
            documentType,
            monthKey: month?.monthKey ?? null,
            monthNumber: month?.monthNumber ?? null,
            monthYear: month?.year ?? null,
            documentDate: documentDate?.dateKey ?? null,
            sourceScope,
            ownerUserId,
            classId: sourceClassId,
            classBindingStatus: sourceClassId ? "confirmed" : "unresolved",
            connectionId: connection.id,
            authStrategy: driveCredential.strategy,
            resourceKeyPresent: Boolean(item.resourceKey),
          },
          sync_state:
            scopeRejected || contextReviewCode || extraction.status !== "ready"
              ? "failed"
              : existingSource?.id
                ? "changed"
                : "active",
          last_seen_at: nowIso,
          updated_at: nowIso,
        };
        const sourceWrite = await admin
          .from("document_sources")
          .upsert(sourcePayload, {
            onConflict: "organization_id,connection_id,provider,external_id",
          })
          .select("id")
          .single();
        const { data: source, error: sourceError } = sourceWrite;
        if (sourceError || !source?.id) {
          summary.failed += 1;
          continue;
        }

        const markSourceFailure = async (
          stage: string,
          errorCode: unknown = "unknown",
        ) =>
          admin
            .from("document_sources")
            .update({
              sync_state: "failed",
              metadata: {
                ...sourcePayload.metadata,
                lastSyncFailure: {
                  stage,
                  errorCode: textValue(errorCode) || "unknown",
                },
              },
              updated_at: nowIso,
            })
            .eq("id", source.id);

        const { data: existingRevision } = await admin
          .from("document_source_revisions")
          .select(
            "id, extraction_status, parser_version, extraction_provenance",
          )
          .eq("organization_id", organizationId)
          .eq("source_id", source.id)
          .eq("content_hash", contentHash)
          .maybeSingle();
        if (
          existingRevision?.id &&
          existingRevision.extraction_status === "ready" &&
          existingRevision.parser_version === DOCUMENT_DRIVE_PARSER_VERSION &&
          (
            existingRevision.extraction_provenance as Record<
              string,
              unknown
            > | null
          )?.classificationKey === classificationKey
        ) {
          const { count: activeChunkCount, error: activeChunkError } =
            await admin
              .from("kb_documents")
              .select("id", { count: "exact", head: true })
              .eq("organization_id", organizationId)
              .eq("source_revision_id", existingRevision.id)
              .eq("source_scope", sourceScope)
              .eq("available", true);
          if (!activeChunkError && Number(activeChunkCount ?? 0) > 0) {
            const { error: unchangedSourceError } = await admin
              .from("document_sources")
              .update({
                sync_state: "unchanged",
                last_seen_at: nowIso,
                updated_at: nowIso,
              })
              .eq("id", source.id);
            if (unchangedSourceError) {
              summary.failed += 1;
              continue;
            }
            summary.unchanged += 1;
            continue;
          }
        }

        const { data: revision, error: revisionError } = await admin
          .from("document_source_revisions")
          .upsert(
            {
              organization_id: organizationId,
              source_id: source.id,
              external_revision_id:
                textValue(item.version) ||
                textValue(item.md5Checksum) ||
                textValue(item.modifiedTime),
              content_hash: contentHash,
              modified_at: item.modifiedTime ?? null,
              byte_size: revisionByteSize,
              extraction_status:
                scopeRejected || contextReviewCode
                  ? "review_required"
                  : extraction.status,
              normalized_content:
                extraction.status === "ready" && !scopeRejected
                  ? sanitized.content
                  : null,
              error_code: scopeRejected
                ? "institutional_scope_rejected"
                : contextReviewCode || extraction.errorCode,
              parser_name: "goatleta-document-drive",
              parser_version: DOCUMENT_DRIVE_PARSER_VERSION,
              extraction_provenance: {
                securityWarnings: interpretationWarnings,
                blockedInstructionCount: sanitized.blockedInstructionCount,
                pageCount: extraction.pageCount,
                drivePath: item.path,
                createdTime: item.createdTime ?? null,
                sourceProfile: policy.sourceProfile,
                folderRole,
                monthKey: month?.monthKey ?? null,
                documentDate: documentDate?.dateKey ?? null,
                sourceScope,
                classId: sourceClassId,
                classificationKey,
                extractionFormat: extraction.extractionFormat ?? null,
                authStrategy: driveCredential.strategy,
                resourceKeyPresent: Boolean(item.resourceKey),
              },
            },
            { onConflict: "organization_id,source_id,content_hash" },
          )
          .select("id")
          .single();
        if (revisionError || !revision?.id) {
          await markSourceFailure(
            "revision_upsert",
            revisionError?.code ?? "revision_missing",
          );
          summary.failed += 1;
          continue;
        }

        const interpretationConfidence =
          folderRole === "academic"
            ? classification.confidence
            : folderRole === policy.sourceProfile
              ? 0.94
              : 0.82;
        const interpretationPayload = {
          sourceProfile: policy.sourceProfile,
          folderRole,
          documentType,
          monthKey: month?.monthKey ?? null,
          monthNumber: month?.monthNumber ?? null,
          monthYear: month?.year ?? null,
          documentDate: documentDate?.dateKey ?? null,
          discipline: classification.discipline,
          academicArea: classification.academicArea,
          materialType: classification.materialType,
          evidenceKind: classification.evidenceKind,
          author: author || null,
          institution: institution || null,
          academicPeriod: academicPeriod || null,
          sourcePath: item.path,
          sourceTitle: item.name,
          knowledgeLayer: classification.knowledgeLayer,
          concepts: [],
          methodologies: [],
          practicalGuidance: [],
          audience: [],
          bibliographicReferences: [],
        };
        const { data: interpretation, error: interpretationError } = await admin
          .from("document_interpretations")
          .upsert(
            {
              organization_id: organizationId,
              revision_id: revision.id,
              canonical_revision_id: revision.id,
              document_type: scopeRejected
                ? "institutional_guidance"
                : documentType,
              extraction_confidence: interpretationConfidence,
              interpretation: interpretationPayload,
              warnings: interpretationWarnings,
              source_profile: policy.sourceProfile,
              folder_role: folderRole,
              month_key: month?.monthKey ?? null,
              discipline: classification.discipline,
              academic_area: classification.academicArea,
              material_type: classification.materialType,
              evidence_kind: classification.evidenceKind,
              evidence_confidence: classification.confidence,
              extraction_provenance: {
                sourceDocumentId: source.id,
                sourceRevisionId: revision.id,
                contentHash,
                knowledgeLayer: classification.knowledgeLayer,
                sourceProfile: policy.sourceProfile,
                folderRole,
                documentType,
                monthKey: month?.monthKey ?? null,
                documentDate: documentDate?.dateKey ?? null,
                sourceScope,
                classId: sourceClassId,
                extractionFormat: extraction.extractionFormat ?? null,
                authStrategy: driveCredential.strategy,
              },
            },
            { onConflict: "canonical_revision_id" },
          )
          .select("id")
          .single();
        if (interpretationError || !interpretation?.id) {
          await markSourceFailure(
            "interpretation_upsert",
            interpretationError?.code ?? "interpretation_missing",
          );
          summary.failed += 1;
          continue;
        }

        if (sourceClassId) {
          const bindingKey = await sha256(
            `${organizationId}|${interpretation.id}|${sourceClassId}`,
          );
          const { error: bindingError } = await admin
            .from("document_context_bindings")
            .upsert(
              {
                organization_id: organizationId,
                interpretation_id: interpretation.id,
                class_id: sourceClassId,
                period: month?.monthKey ?? null,
                confidence: 1,
                status: "confirmed",
                confirmed_by: user.id,
                source_profile: policy.sourceProfile,
                folder_role: folderRole,
                month_key: month?.monthKey ?? null,
                binding_key: bindingKey,
              },
              { onConflict: "binding_key" },
            );
          if (bindingError) {
            await markSourceFailure(
              "context_binding_upsert",
              bindingError.code,
            );
            summary.failed += 1;
            continue;
          }
        }

        if (scopeRejected) {
          summary.reviewRequired += 1;
          continue;
        }
        if (contextReviewCode) {
          summary.reviewRequired += 1;
          continue;
        }

        if (extraction.status !== "ready" || !sanitized.content) {
          if (extraction.status === "review_required") {
            summary.reviewRequired += 1;
          } else {
            await markSourceFailure("content_extraction", extraction.errorCode);
            summary.failed += 1;
          }
          continue;
        }

        const knowledgeSourceId =
          sourceScope === "user_academic"
            ? `academic_${stableIdPart(organizationId)}_${stableIdPart(
                user.id,
              )}_${stableIdPart(item.id)}`
            : `document_${stableIdPart(organizationId)}_${stableIdPart(
                connection.id,
              )}_${stableIdPart(item.id)}`;
        const { error: knowledgeSourceError } = await admin
          .from("knowledge_sources")
          .upsert(
            {
              id: knowledgeSourceId,
              organization_id: organizationId,
              knowledge_base_version_id: versionId,
              domain: "general",
              owner_user_id: ownerUserId,
              source_scope: sourceScope,
              document_source_id: source.id,
              document_revision_id: revision.id,
              title: textValue(item.name),
              authors: author || "",
              source_year: item.modifiedTime
                ? Number(item.modifiedTime.slice(0, 4))
                : null,
              edition: "",
              source_type: sourceTypeFromEvidence(classification.evidenceKind),
              source_url: sourceUrl || "",
              citation_text:
                [item.name, classification.discipline, author]
                  .filter(Boolean)
                  .join(" — ") || textValue(item.name),
              discipline: classification.discipline,
              academic_area: classification.academicArea,
              material_type: classification.materialType,
              evidence_kind: classification.evidenceKind,
              institution: institution || null,
              academic_period: academicPeriod || null,
              confidence: classification.confidence,
              metadata: {
                driveFileId: item.id,
                drivePath: item.path,
                mimeType: item.mimeType,
                sourceProfile: policy.sourceProfile,
                folderRole,
                documentType,
                monthKey: month?.monthKey ?? null,
                documentDate: documentDate?.dateKey ?? null,
                sourceScope,
                ownerUserId,
                classId: sourceClassId,
                classBindingStatus: sourceClassId ? "confirmed" : "unresolved",
                organizationId,
                connectionId: connection.id,
                sourceDocumentId: source.id,
                sourceRevisionId: revision.id,
                contentHash,
                extractionFormat: extraction.extractionFormat ?? null,
                authStrategy: driveCredential.strategy,
              },
              updated_at: nowIso,
            },
            { onConflict: "id" },
          );
        if (knowledgeSourceError) {
          await markSourceFailure(
            "knowledge_source_upsert",
            knowledgeSourceError.code,
          );
          summary.failed += 1;
          continue;
        }

        const chunks = chunkAcademicContent(sanitized.content).slice(
          0,
          MAX_CHUNKS_PER_FILE,
        );
        const embeddings = await buildEmbeddingBatches(
          chunks.map((chunk) => chunk.text),
        );
        const rows = chunks.map((chunk, index) => ({
          id: `${knowledgeSourceId}_${contentHash.slice(0, 16)}_${index + 1}`,
          organization_id: organizationId,
          knowledge_base_version_id: versionId,
          knowledge_source_id: knowledgeSourceId,
          owner_user_id: ownerUserId,
          source_scope: sourceScope,
          source_document_id: source.id,
          source_revision_id: revision.id,
          content_hash: contentHash,
          chunk_index: index,
          class_id: sourceClassId,
          title: item.name,
          source: sourceUrl,
          chunk: chunk.text,
          source_excerpt: chunk.text,
          source_location: `${[...item.path, item.name].join(" / ")} · trecho ${
            index + 1
          }`,
          embedding: embeddings[index] ?? [],
          embedding_vector: embeddings[index] ?? null,
          tags: [
            classification.discipline,
            classification.academicArea,
            classification.materialType,
            classification.evidenceKind,
            policy.sourceProfile,
            folderRole,
            ...(month?.monthKey ? [month.monthKey] : []),
          ],
          sport: "general",
          level: documentType,
          discipline: classification.discipline,
          academic_area: classification.academicArea,
          material_type: classification.materialType,
          evidence_kind: classification.evidenceKind,
          author,
          institution: institution || null,
          academic_period: academicPeriod || null,
          topic: "",
          audience: "",
          confidence: classification.confidence,
          metadata: {
            startOffset: chunk.startOffset,
            endOffset: chunk.endOffset,
            driveFileId: item.id,
            promptInjectionWarnings: sanitized.warnings,
            sourceProfile: policy.sourceProfile,
            folderRole,
            documentType,
            monthKey: month?.monthKey ?? null,
            monthNumber: month?.monthNumber ?? null,
            monthYear: month?.year ?? null,
            documentDate: documentDate?.dateKey ?? null,
            sourceScope,
            ownerUserId,
            classId: sourceClassId,
            classBindingStatus: sourceClassId ? "confirmed" : "unresolved",
            organizationId,
            connectionId: connection.id,
            extractionFormat: extraction.extractionFormat ?? null,
            authStrategy: driveCredential.strategy,
          },
          available: true,
        }));
        if (rows.length) {
          const { error: chunkError } = await admin
            .from("kb_documents")
            .upsert(rows, { onConflict: "id" });
          if (chunkError) {
            await markSourceFailure("knowledge_chunk_upsert", chunkError.code);
            summary.failed += 1;
            continue;
          }
        } else {
          await markSourceFailure("knowledge_chunk_build", "empty_chunk_set");
          summary.failed += 1;
          continue;
        }

        const { error: previousRevisionError } = await admin
          .from("kb_documents")
          .update({ available: false })
          .eq("organization_id", organizationId)
          .eq("source_document_id", source.id)
          .neq("source_revision_id", revision.id);
        const { error: staleChunkError } = await admin
          .from("kb_documents")
          .update({ available: false })
          .eq("organization_id", organizationId)
          .eq("source_revision_id", revision.id)
          .gte("chunk_index", rows.length);
        if (previousRevisionError || staleChunkError) {
          await markSourceFailure(
            "knowledge_chunk_cleanup",
            previousRevisionError?.code ?? staleChunkError?.code,
          );
          summary.failed += 1;
          continue;
        }

        summary.ready += 1;
        summary.chunks += rows.length;
      }

      if (syncBatch.hasMore) {
        if (body?.continuationMode === "server" && token) {
          const continueSync = async () => {
            const functionUrl = `${textValue(
              Deno.env.get("SUPABASE_URL"),
            ).replace(/\/$/, "")}/functions/v1/academic-drive-sync`;
            const response = await fetch(functionUrl, {
              method: "POST",
              headers: {
                apikey: textValue(Deno.env.get("SUPABASE_ANON_KEY")),
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ...body,
                action: "sync",
                cursor: syncBatch.nextCursor,
                priorFailed: safeCount(body?.priorFailed) + summary.failed,
                priorReviewRequired:
                  safeCount(body?.priorReviewRequired) + summary.reviewRequired,
              }),
            });
            if (!response.ok) {
              throw new Error(`continuation_${response.status}`);
            }
          };
          const backgroundContinuation = continueSync().catch(async () => {
            const completedAt = new Date().toISOString();
            await admin
              .from("google_drive_connections")
              .update({
                sync_status: "failed",
                sync_completed_at: completedAt,
                sync_error_code: "continuation_failed",
                sync_error_message:
                  "A continuação automática falhou e pode ser retomada com segurança.",
                updated_at: completedAt,
              })
              .eq("id", connection.id);
          });
          const edgeRuntime = (
            globalThis as typeof globalThis & {
              EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void };
            }
          ).EdgeRuntime;
          if (edgeRuntime?.waitUntil) {
            edgeRuntime.waitUntil(backgroundContinuation);
          } else {
            await backgroundContinuation;
          }
        }
        return createSuccess({
          status: "in_progress",
          folderId,
          sourceProfile: policy.sourceProfile,
          sourceScope: policy.sourceScope,
          ownerUserId: policy.ownerUserRequired ? user.id : null,
          classId: effectiveClassId,
          classBindingStatus: effectiveClassId ? "confirmed" : "unresolved",
          scientificPromotion: false,
          authStrategy: driveCredential.strategy,
          nextCursor: syncBatch.nextCursor,
          summary,
        });
      }

      const failedTotal = safeCount(body?.priorFailed) + summary.failed;
      const reviewRequiredTotal =
        safeCount(body?.priorReviewRequired) + summary.reviewRequired;
      const syncState =
        failedTotal > 0 || reviewRequiredTotal > 0 ? "partial" : "succeeded";
      const completedAt = new Date().toISOString();
      const syncErrorCode =
        failedTotal > 0
          ? "partial_extraction_failure"
          : reviewRequiredTotal > 0
            ? "review_required"
            : null;
      const syncErrorMessage =
        failedTotal > 0
          ? `${failedTotal} arquivo(s) não puderam ser processados.`
          : reviewRequiredTotal > 0
            ? `${reviewRequiredTotal} arquivo(s) exigem revisão.`
            : null;
      const { error: syncCompletionError } = await admin
        .from("google_drive_connections")
        .update({
          sync_status: syncState,
          sync_completed_at: completedAt,
          sync_error_code: syncErrorCode,
          sync_error_message: syncErrorMessage,
          updated_at: completedAt,
        })
        .eq("id", connection.id);
      if (syncCompletionError) {
        return createError(
          500,
          "PERSISTENCE_ERROR",
          "A sincronização terminou, mas o estado final não pôde ser salvo.",
        );
      }

      return createSuccess({
        status: syncState,
        folderId,
        sourceProfile: policy.sourceProfile,
        sourceScope: policy.sourceScope,
        ownerUserId: policy.ownerUserRequired ? user.id : null,
        classId: effectiveClassId,
        classBindingStatus: effectiveClassId ? "confirmed" : "unresolved",
        scientificPromotion: false,
        authStrategy: driveCredential.strategy,
        nextCursor: null,
        summary,
      });
    },
  }),
);
