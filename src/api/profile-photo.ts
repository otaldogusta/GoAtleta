import { supabaseRestPost } from "./rest";

type MyProfilePhotoRow = {
  photo_url?: string | null;
};

export const getMyProfilePhoto = async (): Promise<string | null> => {
  const rows = await supabaseRestPost<MyProfilePhotoRow[]>(
    "/rpc/get_my_profile_photo",
    {},
    "return=representation"
  );
  const value = rows?.[0]?.photo_url;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
};

export const setMyProfilePhoto = async (
  photoUrl: string | null
): Promise<void> => {
  await supabaseRestPost<null>(
    "/rpc/set_my_profile_photo",
    {
      p_photo_url: (photoUrl ?? "").trim() || null,
    },
    "return=minimal"
  );
};
