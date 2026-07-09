import { useEffect, useRef } from "react";
import type { Attachment, Message } from "../../types/message";
import type { MessageAction } from "../../types/message";
import MessageBubble from "./MessageBubble";

type MessageListProps = {
  messages: Message[];
  selectedMessageIds: Set<string>;
  focusedMessageId: string | null;
  searchQuery: string;
  onMessageAction: (messageId: string, action: MessageAction) => void;
  onOpenAttachment: (attachment: Attachment) => void;
  onPlayAttachment: (messageId: string) => void;
  onReact: (messageId: string, reaction: string) => void;
};

export default function MessageList({
  messages,
  selectedMessageIds,
  focusedMessageId,
  searchQuery,
  onMessageAction,
  onOpenAttachment,
  onPlayAttachment,
  onReact,
}: MessageListProps) {
  const messageRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!focusedMessageId) return;
    const element = messageRefs.current.get(focusedMessageId);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusedMessageId]);

  return (
    <section className="lg2-message-list" aria-label="Сообщения">
      <div className="lg2-date-pill">Сегодня</div>
      {messages.map((message) => {
        const reply = message.replyToId ? messages.find((item) => item.id === message.replyToId) : undefined;

        return (
          <div
            key={message.id}
            ref={(node) => {
              if (node) messageRefs.current.set(message.id, node);
              else messageRefs.current.delete(message.id);
            }}
          >
            <MessageBubble
              message={message}
              selected={selectedMessageIds.has(message.id)}
              focused={message.id === focusedMessageId}
              replyText={reply?.text || (reply ? "Вложение" : undefined)}
              searchQuery={searchQuery}
              onAction={onMessageAction}
              onOpenAttachment={onOpenAttachment}
              onPlayAttachment={onPlayAttachment}
              onReact={onReact}
            />
          </div>
        );
      })}
    </section>
  );
}
