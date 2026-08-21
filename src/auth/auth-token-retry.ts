import { isAuthSessionError } from "../ui/error-messages";

export const PROFILE_SESSION_EXPIRED_MESSAGE =
  "Sua sessão expirou. Entre novamente para salvar o nome.";

export const runWithFreshAuthToken = async <T>({
  getValidToken,
  refreshToken,
  request,
  sessionExpiredMessage = PROFILE_SESSION_EXPIRED_MESSAGE,
}: {
  getValidToken: () => Promise<string>;
  refreshToken: () => Promise<string>;
  request: (accessToken: string) => Promise<T>;
  sessionExpiredMessage?: string;
}): Promise<T> => {
  const accessToken = await getValidToken();
  if (!accessToken) throw new Error(sessionExpiredMessage);

  try {
    return await request(accessToken);
  } catch (error) {
    if (!isAuthSessionError(error)) throw error;
  }

  const refreshedToken = await refreshToken();
  if (!refreshedToken) throw new Error(sessionExpiredMessage);

  try {
    return await request(refreshedToken);
  } catch (error) {
    if (isAuthSessionError(error)) {
      throw new Error(sessionExpiredMessage);
    }
    throw error;
  }
};
