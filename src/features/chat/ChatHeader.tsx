import { Info, MoreVertical, Phone, Search, X } from "lucide-react";
import type { Chat } from "../../types/chat";
import { getMockUser } from "../../data/mockUsers";

type ChatHeaderProps = {
  chat: Chat;
  profileOpen: boolean;
  searchOpen: boolean;
  onSearchClick: () => void;
  onToggleProfile: () => void;
  onCloseChat: () => void;
};

function getStatus(chat: Chat): string {
  if (chat.kind === "group") return `${chat.participantIds.length} участника`;
  const peer = chat.participantIds.map(getMockUser).find((user) => user && user.id !== 1);
  if (!peer) return "локальный чат";
  if (peer.status === "online") return "online";
  return peer.lastSeen || "статус скрыт";
}

export default function ChatHeader({ chat, profileOpen, searchOpen, onSearchClick, onToggleProfile, onCloseChat }: ChatHeaderProps) {
  return (
    <header className="lg2-chat-header">
      <button className="lg2-avatar lg2-header-avatar" style={{ background: chat.accentColor }} type="button" onClick={onToggleProfile}>
        {chat.title.slice(0, 1)}
      </button>
      <button className="lg2-chat-heading" type="button" onClick={onToggleProfile}>
        <span>{chat.title}</span>
        <small>{chat.typing || getStatus(chat)}</small>
      </button>
      <div className="lg2-chat-actions">
        <button
          className={searchOpen ? "lg2-icon-button lg2-icon-button-active" : "lg2-icon-button"}
          type="button"
          aria-label="Поиск"
          onClick={onSearchClick}
        >
          <Search size={18} />
        </button>
        <button className="lg2-icon-button" type="button" aria-label="Звонок">
          <Phone size={18} />
        </button>
        <button className="lg2-icon-button" type="button" aria-label={profileOpen ? "Скрыть профиль" : "Показать профиль"} onClick={onToggleProfile}>
          <Info size={18} />
        </button>
        <button className="lg2-icon-button" type="button" aria-label="Еще">
          <MoreVertical size={18} />
        </button>
        <button className="lg2-icon-button lg2-mobile-only" type="button" aria-label="Закрыть чат" onClick={onCloseChat}>
          <X size={18} />
        </button>
      </div>
    </header>
  );
}
