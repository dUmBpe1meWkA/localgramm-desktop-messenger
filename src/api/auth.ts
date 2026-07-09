import { tryApiRequest } from "./client";
import type { ApiAuthResponse } from "../types/api";
import type { ApiUser } from "../types/user";

export type AuthResult = {
  accessToken: string;
  user: ApiUser | null;
};

function normalizeAuthResponse(response: ApiAuthResponse<ApiUser>): AuthResult {
  const accessToken = response.access_token || response.token || "";

  if (!accessToken) {
    throw new Error("Сервер не вернул access token");
  }

  return {
    accessToken,
    user: response.user || null,
  };
}

export async function loginUser(username: string, password: string): Promise<AuthResult> {
  const response = await tryApiRequest<ApiAuthResponse<ApiUser>>(
    ["/auth/login", "/login", "/api/auth/login"],
    {
      method: "POST",
      body: { username, password },
    },
  );

  return normalizeAuthResponse(response);
}

export async function registerUser(
  username: string,
  displayName: string,
  password: string,
): Promise<AuthResult> {
  const response = await tryApiRequest<ApiAuthResponse<ApiUser>>(
    ["/auth/register", "/register", "/api/auth/register"],
    {
      method: "POST",
      body: {
        username,
        display_name: displayName,
        name: displayName,
        password,
      },
    },
  );

  return normalizeAuthResponse(response);
}

export async function getCurrentUser(token: string): Promise<ApiUser> {
  return tryApiRequest<ApiUser>(["/users/me", "/me", "/auth/me", "/api/users/me"], {
    method: "GET",
    token,
  });
}

export async function resolveCurrentUser(token: string, fallback: ApiUser | null): Promise<ApiUser | null> {
  try {
    return await getCurrentUser(token);
  } catch {
    return fallback;
  }
}
