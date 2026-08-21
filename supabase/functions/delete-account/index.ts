import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";

type DeleteAccountPayload = {
  confirmationText?: string;
};

type AffectedOrganization = {
  organizationId: string;
  classCount: number;
  classIds: string[];
  classNames: string[];
  memberRole: "Coordenação" | "Professor" | "Estagiário";
  coordinatorUserIds: string[];
};

type AccountDeletionPreparation = {
  affectedOrganizations?: AffectedOrganization[];
};

type OwnedStorageObject = {
  bucket_id: string;
  object_name: string;
  object_metadata?: Record<string, unknown> | null;
};

const jsonHeaders = (request: Request) => ({
  ...buildCorsHeaders(request),
  "Content-Type": "application/json",
});

const jsonResponse = (
  request: Request,
  status: number,
  payload: Record<string, unknown>,
) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders(request),
  });

const bearerToken = (request: Request) => {
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return "";
  return authorization.slice("Bearer ".length).trim();
};

const normalizeConfirmation = (value: unknown) =>
  typeof value === "string" ? value.trim().toLocaleUpperCase("pt-BR") : "";

const deletionDisplayName = (user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) => {
  const metadata = user.user_metadata ?? {};
  for (const key of ["full_name", "display_name", "name"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return user.email?.split("@")[0]?.trim() || "Um membro";
};

const classNamesSummary = (classNames: string[]) => {
  const visibleNames = classNames.filter(Boolean).slice(0, 3);
  if (!visibleNames.length) return "";
  const remaining = Math.max(0, classNames.length - visibleNames.length);
  return `: ${visibleNames.join(", ")}${remaining ? ` e +${remaining}` : ""}`;
};

const buildCoordinationNotifications = (
  affectedOrganizations: AffectedOrganization[],
  memberName: string,
) =>
  affectedOrganizations.flatMap((affected) => {
    const classCount = Math.max(0, Number(affected.classCount) || 0);
    const classIds = Array.isArray(affected.classIds) ? affected.classIds : [];
    const classNames = Array.isArray(affected.classNames) ? affected.classNames : [];
    const recipients = Array.isArray(affected.coordinatorUserIds)
      ? affected.coordinatorUserIds
      : [];
    const memberLabel = `${memberName} (${affected.memberRole})`;
    const classesLabel = classCount === 1 ? "1 turma ficou" : `${classCount} turmas ficaram`;
    const body = classCount > 0
      ? `${memberLabel} excluiu a conta. ${classesLabel} sem professor responsável${classNamesSummary(classNames)}.`
      : `${memberLabel} excluiu a conta.`;
    return recipients.map((recipientUserId) => ({
      organization_id: affected.organizationId,
      recipient_user_id: recipientUserId,
      inbox_scope: "coord",
      actor_user_id: null,
      type: "generic",
      title: classCount === 0
        ? "Membro excluiu a conta"
        : classCount === 1
          ? "Turma sem professor responsável"
          : "Turmas sem professor responsável",
      body,
      action_url: classCount > 0 ? "/coord/classes" : "/coord/management",
      source_type: "account_deletion",
      source_id: affected.organizationId,
      metadata: {
        event: "member_account_deleted",
        departedMemberName: memberName,
        departedMemberRole: affected.memberRole,
        classCount,
        classIds,
        classNames,
      },
    }));
  });

const metadataString = (
  metadata: Record<string, unknown> | null | undefined,
  ...keys: string[]
) => {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

const rehomeSharedStorageObject = async (
  admin: ReturnType<typeof createClient>,
  storageObject: OwnedStorageObject,
) => {
  const bucket = admin.storage.from(storageObject.bucket_id);
  const temporaryPath = `.account-transfer/${crypto.randomUUID()}`;
  const { data: originalBody, error: downloadError } = await bucket.download(
    storageObject.object_name,
  );
  if (downloadError || !originalBody) {
    throw downloadError ?? new Error("Unable to read owned storage object");
  }

  const contentType = metadataString(
    storageObject.object_metadata,
    "mimetype",
    "contentType",
  );
  const cacheControl = metadataString(
    storageObject.object_metadata,
    "cacheControl",
    "cache_control",
  );
  const { error: temporaryUploadError } = await bucket.upload(
    temporaryPath,
    originalBody,
    {
      upsert: false,
      ...(contentType ? { contentType } : {}),
      ...(cacheControl ? { cacheControl } : {}),
    },
  );
  if (temporaryUploadError) throw temporaryUploadError;

  const { error: removeOriginalError } = await bucket.remove([
    storageObject.object_name,
  ]);
  if (removeOriginalError) {
    await bucket.remove([temporaryPath]);
    throw removeOriginalError;
  }

  const { error: moveError } = await bucket.move(
    temporaryPath,
    storageObject.object_name,
  );
  if (!moveError) return;

  const { data: recoveryBody, error: recoveryDownloadError } =
    await bucket.download(temporaryPath);
  if (!recoveryDownloadError && recoveryBody) {
    const { error: recoveryUploadError } = await bucket.upload(
      storageObject.object_name,
      recoveryBody,
      {
        upsert: true,
        ...(contentType ? { contentType } : {}),
        ...(cacheControl ? { cacheControl } : {}),
      },
    );
    if (!recoveryUploadError) {
      await bucket.remove([temporaryPath]);
      return;
    }
  }
  throw moveError;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return corsPreflight(request);
  if (request.method !== "POST") {
    return jsonResponse(request, 405, {
      code: "METHOD_NOT_ALLOWED",
      error: "Método não permitido.",
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(request, 500, {
      code: "SERVER_CONFIGURATION_ERROR",
      error: "A exclusão de conta não está disponível agora.",
    });
  }

  const token = bearerToken(request);
  if (!token) {
    return jsonResponse(request, 401, {
      code: "UNAUTHORIZED",
      error: "Sua sessão expirou. Entre novamente.",
    });
  }

  let payload: DeleteAccountPayload;
  try {
    payload = (await request.json()) as DeleteAccountPayload;
  } catch {
    return jsonResponse(request, 400, {
      code: "INVALID_PAYLOAD",
      error: "Confirmação inválida.",
    });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const user = authData.user;
  if (authError || !user?.id || !user.email) {
    return jsonResponse(request, 401, {
      code: "UNAUTHORIZED",
      error: "Sua sessão expirou. Entre novamente.",
    });
  }
  if (normalizeConfirmation(payload.confirmationText) !== "EXCLUIR") {
    return jsonResponse(request, 400, {
      code: "CONFIRMATION_MISMATCH",
      error: "Digite EXCLUIR exatamente para confirmar.",
    });
  }

  const { data: preparationData, error: preparationError } = await admin.rpc(
    "prepare_self_account_deletion",
    { p_user_id: user.id },
  );
  if (preparationError) {
    const requiresTransfer = preparationError.message.includes(
      "ACCOUNT_DELETE_REQUIRES_ADMIN_TRANSFER",
    );
    return jsonResponse(request, requiresTransfer ? 409 : 500, {
      code: requiresTransfer
        ? "ADMIN_TRANSFER_REQUIRED"
        : "ACCOUNT_PREPARATION_FAILED",
      error: requiresTransfer
        ? "Defina outro administrador nas organizações compartilhadas antes de excluir a conta."
        : "Não foi possível preparar a exclusão da conta.",
    });
  }

  const { data: ownedObjects, error: ownedObjectsError } = await admin.rpc(
    "list_owned_storage_objects_for_account_deletion",
    { p_user_id: user.id },
  );
  if (ownedObjectsError) {
    return jsonResponse(request, 500, {
      code: "STORAGE_LIST_FAILED",
      error: "Não foi possível preparar os arquivos da conta.",
    });
  }

  try {
    for (const storageObject of (ownedObjects ?? []) as OwnedStorageObject[]) {
      if (storageObject.bucket_id === "profile-photos") {
        const { error: removeError } = await admin.storage
          .from(storageObject.bucket_id)
          .remove([storageObject.object_name]);
        if (removeError) throw removeError;
        continue;
      }
      await rehomeSharedStorageObject(admin, storageObject);
    }
  } catch {
    return jsonResponse(request, 500, {
      code: "STORAGE_PREPARATION_FAILED",
      error: "Não foi possível preparar os arquivos da conta.",
    });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);
  if (deleteError) {
    return jsonResponse(request, 500, {
      code: "ACCOUNT_DELETE_FAILED",
      error: "Não foi possível concluir a exclusão da conta.",
    });
  }

  const coordinationNotifications = buildCoordinationNotifications(
    ((preparationData as AccountDeletionPreparation | null)
      ?.affectedOrganizations ?? []),
    deletionDisplayName(user),
  );
  let notificationsCreated = true;
  if (coordinationNotifications.length) {
    const { error: notificationError } = await admin
      .from("notifications")
      .insert(coordinationNotifications);
    if (notificationError) {
      notificationsCreated = false;
      console.error("Failed to notify coordination after account deletion", {
        code: notificationError.code,
        message: notificationError.message,
      });
    }
  }

  return jsonResponse(request, 200, { deleted: true, notificationsCreated });
});
