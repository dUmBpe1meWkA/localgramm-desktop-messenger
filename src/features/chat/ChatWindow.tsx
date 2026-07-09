import { useEffect, useMemo, useState } from "react";
import type { Chat } from "../../types/chat";
import type { Attachment, Message } from "../../types/message";
import type { MessageAction } from "../../types/message";
import ChatHeader from "./ChatHeader";
import MessageSearchBar from "./MessageSearchBar";
import MessageComposer from "../composer/MessageComposer";
import MessageList from "../messages/MessageList";

type ChatWindowProps = {
  chat: Chat | null;
  messages: Message[];
  profileOpen: boolean;
  onToggleProfile: () => void;
  onCloseChat: () => void;
  onSend: (text: string) => void;
  onCancelReply: () => void;
  onMessageAction: (messageId: string, action: MessageAction) => void;
  selectedMessageIds: Set<string>;
  focusedMessageId: string | null;
  replyingToMessage: Message | null;
  editingMessage: Message | null;
  onEditMessage: (messageId: string, text: string) => void;
  onCancelEdit: () => void;
  onOpenAttachment: (attachment: Attachment) => void;
  onPlayAttachment: (messageId: string) => void;
  onReact: (messageId: string, reaction: string) => void;
  onFocusMessage: (messageId: string | null) => void;
};

export default function ChatWindow({
  chat,
  messages,
  profileOpen,
  onToggleProfile,
  onCloseChat,
  onSend,
  onCancelReply,
  onMessageAction,
  selectedMessageIds,
  focusedMessageId,
  replyingToMessage,
  editingMessage,
  onEditMessage,
  onCancelEdit,
  onOpenAttachment,
  onPlayAttachment,
  onReact,
  onFocusMessage,
}: ChatWindowProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchMatches = useMemo(() => {
    if (!normalizedSearchQuery) return [];
    return messages.filter((message) => (message.text || "").toLowerCase().includes(normalizedSearchQuery));
  }, [messages, normalizedSearchQuery]);

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchIndex(0);
  }, [chat?.id]);

  useEffect(() => {
    setSearchIndex(0);
  }, [normalizedSearchQuery]);

  useEffect(() => {
    if (!searchOpen || !normalizedSearchQuery) return;
    if (searchMatches.length === 0) {
      onFocusMessage(null);
      return;
    }

    const safeIndex = Math.min(searchIndex, searchMatches.length - 1);
    if (safeIndex !== searchIndex) {
      setSearchIndex(safeIndex);
      return;
    }

    onFocusMessage(searchMatches[safeIndex].id);
  }, [normalizedSearchQuery, onFocusMessage, searchIndex, searchMatches, searchOpen]);

  if (!chat) {
    return (
      <section className="lg2-chat-panel lg2-empty-chat">
        <div>
          <h1>Выберите чат</h1>
          <p>Список слева уже работает. Ctrl+клик открывает чат без отметки прочтения.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={searchOpen ? "lg2-chat-panel lg2-chat-panel-search" : "lg2-chat-panel"}>
      <ChatHeader
        chat={chat}
        profileOpen={profileOpen}
        searchOpen={searchOpen}
        onSearchClick={() => setSearchOpen((value) => !value)}
        onToggleProfile={onToggleProfile}
        onCloseChat={onCloseChat}
      />
      {searchOpen ? (
        <MessageSearchBar
          query={searchQuery}
          currentIndex={searchMatches.length === 0 ? 0 : Math.min(searchIndex, searchMatches.length - 1)}
          total={searchMatches.length}
          onQueryChange={setSearchQuery}
          onNext={() => setSearchIndex((index) => (searchMatches.length === 0 ? 0 : (index + 1) % searchMatches.length))}
          onPrevious={() =>
            setSearchIndex((index) => (searchMatches.length === 0 ? 0 : (index - 1 + searchMatches.length) % searchMatches.length))
          }
          onClose={() => {
            setSearchOpen(false);
            setSearchQuery("");
            onFocusMessage(null);
          }}
        />
      ) : null}
      <MessageList
        messages={messages}
        selectedMessageIds={selectedMessageIds}
        focusedMessageId={focusedMessageId}
        searchQuery={searchOpen ? searchQuery : ""}
        onMessageAction={onMessageAction}
        onOpenAttachment={onOpenAttachment}
        onPlayAttachment={onPlayAttachment}
        onReact={onReact}
      />
      <MessageComposer
        disabled={Boolean(chat.blocked)}
        onSend={onSend}
        replyingToMessage={replyingToMessage}
        onCancelReply={onCancelReply}
        editingMessage={editingMessage}
        onEditMessage={onEditMessage}
        onCancelEdit={onCancelEdit}
      />
    </section>
  );
}
