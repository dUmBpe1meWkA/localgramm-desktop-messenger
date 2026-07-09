import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentUser, loginUser, registerUser, resolveCurrentUser } from "../../api/auth";
import type { ApiUser } from "../../types/user";

const TOKEN_STORAGE_KEY = "localgramm_v2_access_token";
const USER_STORAGE_KEY = "localgramm_v2_user";

function readStoredUser(): ApiUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ApiUser) : null;
  } catch {
    return null;
  }
}

function saveSession(token: string, user: ApiUser | null) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

function clearStoredSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || "");
  const [user, setUser] = useState<ApiUser | null>(() => readStoredUser());
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!token) {
        setInitialLoading(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser(token);
        if (cancelled) return;
        setUser(currentUser);
        saveSession(token, currentUser);
      } catch {
        if (cancelled) return;
        clearStoredSession();
        setToken("");
        setUser(null);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError("");

    try {
      const result = await loginUser(username.trim(), password);
      const currentUser = await resolveCurrentUser(result.accessToken, result.user);
      setToken(result.accessToken);
      setUser(currentUser);
      saveSession(result.accessToken, currentUser);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Не удалось войти");
      throw authError;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (username: string, displayName: string, password: string) => {
    setLoading(true);
    setError("");

    try {
      const result = await registerUser(username.trim(), displayName.trim(), password);
      const currentUser = await resolveCurrentUser(result.accessToken, result.user);
      setToken(result.accessToken);
      setUser(currentUser);
      saveSession(result.accessToken, currentUser);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Не удалось зарегистрироваться");
      throw authError;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    setToken("");
    setUser(null);
    setError("");
  }, []);

  return useMemo(
    () => ({
      token,
      user,
      initialLoading,
      loading,
      error,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout,
      setError,
    }),
    [token, user, initialLoading, loading, error, login, register, logout],
  );
}
