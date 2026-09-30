import { isVolleyballClassModality } from "./class-modality";
import type { ProfileRecord } from "./class-pedagogical-profile";
import type { ClassGroup } from "./models";

export function resolveClassProfile(
  cls?: ClassGroup | null,
): ProfileRecord | undefined {
  if (
    cls?.pedagogicalProfileUnavailable &&
    isVolleyballClassModality(cls.modality)
  ) {
    throw new Error(
      "Reconecte para carregar o perfil atualizado antes de gerar planos.",
    );
  }
  const record = cls?.pedagogicalProfile;
  return cls &&
    isVolleyballClassModality(cls.modality) &&
    record?.class_id === cls.id &&
    record.organization_id === cls.organizationId
    ? record
    : undefined;
}
