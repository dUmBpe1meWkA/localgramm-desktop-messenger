import type { ChatId } from "./chat";
import type { UserId } from "./user";

export type MessageId = string;

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export type AttachmentKind = "photo" | "video" | "videoNote" | "voice" | "file" | "link" | "audio" | "sticker";

export type Attachment = {
  id: string;
  kind: AttachmentKind;
  title?: string;
  url?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  sizeLabel?: string;
  durationSec?: number;
  waveform?: number[];
};

export type Message = {
  id: MessageId;
  chatId: ChatId;
  authorId: UserId;
  text?: string;
  createdAt: string;
  status: MessageStatus;
  outgoing: boolean;
  readAt?: string;
  listened?: boolean;
  edited?: boolean;
  replyToId?: MessageId;
  attachments?: Attachment[];
  reactions?: Record<string, number>;
  myReaction?: string;
};

export type MessageAction = "reply" | "copy" | "forward" | "select" | "edit" | "delete";
