type OAuthProvider = "google" | "facebook" | "apple";

export const buildOAuthAuthorizeUrl = ({
  supabaseUrl,
  provider,
  redirectTo,
  skipHttpRedirect = false,
}: {
  supabaseUrl: string;
  provider: OAuthProvider;
  redirectTo: string;
  skipHttpRedirect?: boolean;
}) => {
  const params = new URLSearchParams({
    provider,
    response_type: "code",
    redirect_to: redirectTo,
  });

  if (provider === "google") {
    params.set("prompt", "select_account");
  }
  if (skipHttpRedirect) {
    params.set("skip_http_redirect", "true");
  }

  return `${supabaseUrl.replace(/\/$/, "")}/auth/v1/authorize?${params.toString()}`;
};
