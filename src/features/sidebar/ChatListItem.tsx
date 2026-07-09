import { useState, type MouseEvent } from "react";
import { BellOff, Pin } from "lucide-react";
import ContextMenu from "../../shared/components/ContextMenu";
import type { Chat } from "../../types/chat";
import type { ChatAction } from "../../types/chatActions";
import type { Message } from "../../types/message";
import { classNames } from "../../shared/utils/classNames";
import { formatTime } from "../../shared/utils/format";

type ChatListItemProps = {
  chat: Chat;
  lastMessage?: Message;
  active: boolean;
  onSelect: (chatId: string, preserveUnread: boolean) => void;
  onAction: (chatId: string, action: ChatAction) => void;
};

function getPreview(message?: Message): string {
  if (!message) return "Нет сообщений";
  if (message.text) return message.text;
  const firstAttachment = message.attachments?.[0];
  if (!firstAttachment) return "Вложение";

  const labels = {
    photo: "Фото",
    video: "Видео",
    videoNote: "Видеосообщение",
    voice: "Голосовое сообщение",
    file: "Файл",
    link: "Ссылка",
    audio: "Аудио",
    sticker: "Стикер",
  };

  return labels[firstAttachment.kind];
}

export default function ChatListItem({ chat, lastMessage, active, onSelect, onAction }: ChatListItemProps) {
  const [menuPoint, setMenuPoint] = useState<{ x: number; y: number } | null>(null);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onSelect(chat.id, event.ctrlKey || event.metaKey);
  };

  return (
    <>
      <button
        className={classNames("lg2-chat-item", active && "lg2-chat-item-active")}
        type="button"
        onClick={handleClick}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenuPoint({ x: event.clientX, y: event.clientY });
        }}
      >
        <span className="lg2-avatar" style={{ background: chat.accentColor }}>
          {chat.title.slice(0, 1)}
        </span>
        <span className="lg2-chat-item-main">
          <span className="lg2-chat-item-top">
            <span className="lg2-chat-title">{chat.title}</span>
            <span className="lg2-chat-time">{lastMessage ? formatTime(lastMessage.createdAt) : ""}</span>
          </span>
          <span className="lg2-chat-item-bottom">
            <span className="lg2-chat-preview">{chat.blocked ? "Пользователь заблокирован" : chat.typing || getPreview(lastMessage)}</span>
            <span className="lg2-chat-meta">
              {chat.pinned ? <Pin size={13} /> : null}
              {chat.muted ? <BellOff size={13} /> : null}
              {chat.unreadCount > 0 ? <span className="lg2-unread-badge">{chat.unreadCount}</span> : null}
            </span>
          </span>
        </span>
      </button>
      {menuPoint ? (
        <ContextMenu
          x={menuPoint.x}
          y={menuPoint.y}
          onClose={() => setMenuPoint(null)}
          items={[
            { label: chat.pinned ? "Открепить" : "Закрепить", onSelect: () => onAction(chat.id, "togglePin") },
            { label: chat.muted ? "Размьютить" : "Замьютить", onSelect: () => onAction(chat.id, "toggleMute") },
            { label: chat.blocked ? "Разблокировать" : "Заблокировать", onSelect: () => onAction(chat.id, "toggleBlock") },
            { label: "Открыть профиль", onSelect: () => onAction(chat.id, "openProfile") },
            { label: "Очистить историю", onSelect: () => onAction(chat.id, "clearHistory") },
            { label: "Удалить чат", danger: true, onSelect: () => onAction(chat.id, "delete") },
          ]}
        />
      ) : null}
    </>
  );
}
