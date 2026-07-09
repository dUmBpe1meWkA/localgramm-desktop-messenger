import type { UserId } from "./user";

export type ChatId = string;

export type ChatKind = "private" | "group" | "channel" | "saved";

export type Chat = {
  id: ChatId;
  kind: ChatKind;
  title: string;
  participantIds: UserId[];
  avatarUrl?: string;
  accentColor: string;
  lastMessageId: string;
  unreadCount: number;
  pinned?: boolean;
  muted?: boolean;
  blocked?: boolean;
  archived?: boolean;
  typing?: string;
};
