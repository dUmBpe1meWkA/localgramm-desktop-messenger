import { Edit3, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Chat } from "../../types/chat";
import type { ChatAction } from "../../types/chatActions";
import type { Message } from "../../types/message";
import ChatList from "./ChatList";

type SidebarProps = {
  chats: Chat[];
  messages: Message[];
  activeChatId: string | null;
  onSelectChat: (chatId: string, preserveUnread: boolean) => void;
  onChatAction: (chatId: string, action: ChatAction) => void;
  onResetState: () => void;
};

export default function Sidebar({ chats, messages, activeChatId, onSelectChat, onChatAction, onResetState }: SidebarProps) {
  const [query, setQuery] = useState("");
  const filteredChats = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return chats;

    return chats.filter((chat) => {
      const lastMessage = messages.find((message) => message.id === chat.lastMessageId);
      return `${chat.title} ${lastMessage?.text || ""}`.toLowerCase().includes(normalizedQuery);
    });
  }, [chats, messages, query]);

  return (
    <aside className="lg2-sidebar">
      <header className="lg2-sidebar-header">
        <div>
          <div className="lg2-app-name">LocalGramm</div>
          <div className="lg2-sidebar-subtitle">локальный frontend</div>
        </div>
        <div className="lg2-sidebar-actions">
          <button className="lg2-icon-button" type="button" aria-label="Сбросить локальное состояние" onClick={onResetState}>
            <RotateCcw size={17} />
          </button>
          <button className="lg2-icon-button" type="button" aria-label="Новый чат" onClick={() => setQuery("")}>
            <Edit3 size={18} />
          </button>
        </div>
      </header>

      <label className="lg2-search">
        <Search size={17} />
        <input type="search" placeholder="Поиск" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>

      <ChatList
        chats={filteredChats}
        messages={messages}
        activeChatId={activeChatId}
        onSelectChat={onSelectChat}
        onChatAction={onChatAction}
      />
    </aside>
  );
}
