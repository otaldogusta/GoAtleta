import { supabaseRestPost } from "./rest";

type MyProfilePhotoRow = {
  photo_url?: string | null;
};

export const getMyProfilePhoto = async (): Promise<string | null> => {
  try {
    const rows = await supabaseRestPost<MyProfilePhotoRow[]>(
      "/rpc/get_my_profile_photo",
      {},
      "return=representation"
    );
    const value = rows?.[0]?.photo_url;
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized || null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Missing auth token")) {
      // Gracefully handle missing auth during app boot
      return null;
    }
    throw error;
  }
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
