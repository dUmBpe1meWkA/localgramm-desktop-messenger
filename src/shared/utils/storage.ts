import type { MessengerState } from "../../types/messenger";

const MESSENGER_STORAGE_KEY = "localgramm:v2:messenger-state";
const MESSENGER_STORAGE_VERSION = 1;

export type MessengerStateSnapshot = MessengerState & {
  version: typeof MESSENGER_STORAGE_VERSION;
  savedAt: string;
};

function isBrowserStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isMessengerStateSnapshot(value: unknown): value is MessengerStateSnapshot {
  if (!value || typeof value !== "object") return false;

  const snapshot = value as Partial<MessengerStateSnapshot>;
  return (
    snapshot.version === MESSENGER_STORAGE_VERSION &&
    Array.isArray(snapshot.chats) &&
    Array.isArray(snapshot.messages) &&
    (typeof snapshot.activeChatId === "string" || snapshot.activeChatId === null)
  );
}

export function loadMessengerState(): MessengerStateSnapshot | null {
  if (!isBrowserStorageAvailable()) return null;

  try {
    const raw = window.localStorage.getItem(MESSENGER_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    return isMessengerStateSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveMessengerState(snapshot: MessengerState): void {
  if (!isBrowserStorageAvailable()) return;

  const payload: MessengerStateSnapshot = {
    ...snapshot,
    version: MESSENGER_STORAGE_VERSION,
    savedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(MESSENGER_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Persistence is best-effort; UI state should continue working even when storage is full or blocked.
  }
}

export function clearMessengerState(): void {
  if (!isBrowserStorageAvailable()) return;

  try {
    window.localStorage.removeItem(MESSENGER_STORAGE_KEY);
  } catch {
    // Ignore storage failures for local mock state.
  }
}
