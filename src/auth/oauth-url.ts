type OAuthProvider = "google" | "facebook" | "apple";

export const buildOAuthAuthorizeUrl = ({
  supabaseUrl,
  provider,
  redirectTo,
}: {
  supabaseUrl: string;
  provider: OAuthProvider;
  redirectTo: string;
}) => {
  const params = new URLSearchParams({
    provider,
    redirect_to: redirectTo,
  });

  if (provider === "google") {
    params.set("prompt", "select_account");
  }
  return `${supabaseUrl.replace(/\/$/, "")}/auth/v1/authorize?${params.toString()}`;
};
