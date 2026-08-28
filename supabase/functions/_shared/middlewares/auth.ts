import {
  createClient,
  SupabaseClient,
  User,
} from "https://esm.sh/@supabase/supabase-js@2";

export const getBearerToken = (req: Request): string | null => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice("bearer ".length).trim() || null;
};

export type AuthenticatedRequest = {
  user: User;
  token: string;
};

export async function authenticateRequest(
  req: Request
): Promise<AuthenticatedRequest | null> {
  const token = getBearerToken(req);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!token || !supabaseUrl || !anonKey) return null;

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;

  return { user: data.user, token };
}

export async function validateAuth(
  supabase: SupabaseClient,
  token: string | null,
  requireAuth: boolean
): Promise<{ user: User | null; error: string | null; status: number }> {
  
  if (requireAuth && !token) {
    return { user: null, error: "Missing authorization token", status: 401 };
  }

  if (token) {
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (requireAuth && (authError || !authData?.user)) {
      return { user: null, error: "Invalid or expired token", status: 401 };
    }
    return { user: authData?.user ?? null, error: null, status: 200 };
  }

  return { user: null, error: null, status: 200 };
}
