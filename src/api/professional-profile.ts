import { supabaseRestPost } from "./rest";

type ProfessionalProfileRow = {
  birth_date?: string | null;
  cpf_masked?: string | null;
  rg?: string | null;
  address?: string | null;
  gender_identity?: string | null;
};

export type ProfessionalProfile = {
  birthDate: string;
  cpfMasked: string;
  rg: string;
  address: string;
  genderIdentity: string;
};

const EMPTY_PROFILE: ProfessionalProfile = {
  birthDate: "",
  cpfMasked: "",
  rg: "",
  address: "",
  genderIdentity: "",
};

export const getMyProfessionalProfile = async (): Promise<ProfessionalProfile> => {
  const rows = await supabaseRestPost<ProfessionalProfileRow[]>(
    "/rpc/get_my_professional_profile",
    {},
    "return=representation",
  );
  const row = rows?.[0];
  if (!row) return EMPTY_PROFILE;
  return {
    birthDate: row.birth_date ?? "",
    cpfMasked: row.cpf_masked ?? "",
    rg: row.rg ?? "",
    address: row.address ?? "",
    genderIdentity: row.gender_identity ?? "",
  };
};

export const saveMyProfessionalProfile = async (profile: {
  birthDate: string;
  cpfInput: string | null;
  rg: string;
  address: string;
  genderIdentity: string;
}): Promise<void> => {
  await supabaseRestPost<null>(
    "/rpc/save_my_professional_profile",
    {
      p_birth_date: profile.birthDate,
      p_cpf_input: profile.cpfInput,
      p_rg: profile.rg,
      p_address: profile.address,
      p_gender_identity: profile.genderIdentity,
    },
    "return=minimal",
  );
};
