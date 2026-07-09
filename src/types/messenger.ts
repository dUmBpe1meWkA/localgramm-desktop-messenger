import type { Chat } from "./chat";
import type { Message } from "./message";

export type MessengerState = {
  chats: Chat[];
  messages: Message[];
  activeChatId: string | null;
};
