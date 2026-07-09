import type { Chat } from "../types/chat";

export const mockChats: Chat[] = [
  {
    id: "chat-mira",
    kind: "private",
    title: "Мира",
    participantIds: [1, 2],
    accentColor: "#58b7ff",
    lastMessageId: "m-104",
    unreadCount: 2,
    pinned: true,
    typing: "записывает голосовое",
  },
  {
    id: "chat-danila",
    kind: "private",
    title: "Данила",
    participantIds: [1, 3],
    accentColor: "#59d7cf",
    lastMessageId: "m-203",
    unreadCount: 2,
  },
  {
    id: "chat-team",
    kind: "group",
    title: "LocalGramm Team",
    participantIds: [1, 2, 3, 4],
    accentColor: "#d7a85b",
    lastMessageId: "m-303",
    unreadCount: 0,
    muted: true,
  },
];
