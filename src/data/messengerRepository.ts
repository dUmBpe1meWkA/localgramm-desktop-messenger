import { mockChats } from "./mockChats";
import { mockMessages } from "./mockMessages";
import { clearMessengerState, loadMessengerState, saveMessengerState } from "../shared/utils/storage";
import type { MessengerState } from "../types/messenger";

export type MessengerRepository = {
  load: () => Promise<MessengerState>;
  save: (state: MessengerState) => Promise<void>;
  reset: () => Promise<MessengerState>;
};

function cloneState(state: MessengerState): MessengerState {
  return {
    chats: state.chats.map((chat) => ({ ...chat })),
    messages: state.messages.map((message) => ({
      ...message,
      attachments: message.attachments?.map((attachment) => ({ ...attachment })),
      reactions: message.reactions ? { ...message.reactions } : undefined,
    })),
    activeChatId: state.activeChatId,
  };
}

export function createDefaultMessengerState(): MessengerState {
  return cloneState({
    chats: mockChats,
    messages: mockMessages,
    activeChatId: mockChats[0]?.id || null,
  });
}

function normalizeMessengerState(state: MessengerState | null): MessengerState {
  if (!state) return createDefaultMessengerState();

  const fallback = createDefaultMessengerState();
  const chats = state.chats.length > 0 ? state.chats : fallback.chats;
  const activeChatExists = chats.some((chat) => chat.id === state.activeChatId);

  return cloneState({
    chats,
    messages: state.messages,
    activeChatId: activeChatExists ? state.activeChatId : chats[0]?.id || null,
  });
}

export const localMessengerRepository: MessengerRepository = {
  async load() {
    return normalizeMessengerState(loadMessengerState());
  },

  async save(state) {
    saveMessengerState(state);
  },

  async reset() {
    clearMessengerState();
    return createDefaultMessengerState();
  },
};

export const messengerRepository = localMessengerRepository;
