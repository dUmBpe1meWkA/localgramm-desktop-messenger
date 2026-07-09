export type ApiErrorPayload = {
  detail?: string | { msg?: string; message?: string }[];
  message?: string;
  error?: string;
};

export type ApiAuthResponse<TUser> = {
  access_token?: string;
  token?: string;
  user?: TUser;
};

export type ApiRequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
