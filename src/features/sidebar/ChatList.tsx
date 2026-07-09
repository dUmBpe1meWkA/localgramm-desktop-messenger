import type { Chat } from "../../types/chat";
import type { ChatAction } from "../../types/chatActions";
import type { Message } from "../../types/message";
import ChatListItem from "./ChatListItem";

type ChatListProps = {
  chats: Chat[];
  messages: Message[];
  activeChatId: string | null;
  onSelectChat: (chatId: string, preserveUnread: boolean) => void;
  onChatAction: (chatId: string, action: ChatAction) => void;
};

export default function ChatList({ chats, messages, activeChatId, onSelectChat, onChatAction }: ChatListProps) {
  const orderedChats = [...chats].sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)));

  return (
    <div className="lg2-chat-list">
      {orderedChats.map((chat) => (
        <ChatListItem
          key={chat.id}
          chat={chat}
          lastMessage={messages.find((message) => message.id === chat.lastMessageId)}
          active={chat.id === activeChatId}
          onSelect={onSelectChat}
          onAction={onChatAction}
        />
      ))}
      {orderedChats.length === 0 ? <div className="lg2-empty-list">Ничего не найдено</div> : null}
    </div>
  );
}
