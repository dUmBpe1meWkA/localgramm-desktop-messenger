import { useEffect, useMemo, useState } from "react";
import AppProviders from "./AppProviders";
import { createDefaultMessengerState, messengerRepository } from "../data/messengerRepository";
import { currentUserId } from "../data/mockUsers";
import ChatWindow from "../features/chat/ChatWindow";
import MediaViewer from "../features/media/MediaViewer";
import ProfilePanel from "../features/profile/ProfilePanel";
import Sidebar from "../features/sidebar/Sidebar";
import type { Chat } from "../types/chat";
import type { ChatAction } from "../types/chatActions";
import type { MessengerState } from "../types/messenger";
import type { Attachment, Message, MessageAction } from "../types/message";
import "../shared/styles/base.css";

function createOutgoingMessage(chatId: string, text: string, replyToId?: string, attachments?: Attachment[]): Message {
  return {
    id: `local-${Date.now()}`,
    chatId,
    authorId: currentUserId,
    text: text || undefined,
    createdAt: new Date().toISOString(),
    status: "sent",
    outgoing: true,
    replyToId,
    attachments,
  };
}

function markChatRead(chats: Chat[], messages: Message[], chatId: string): { chats: Chat[]; messages: Message[] } {
  return {
    chats: chats.map((chat) => (chat.id === chatId ? { ...chat, unreadCount: 0, typing: undefined } : chat)),
    messages: messages.map((message) =>
      message.chatId === chatId && !message.outgoing && message.status !== "read"
        ? { ...message, status: "read", readAt: new Date().toISOString() }
        : message,
    ),
  };
}

function MessengerShell() {
  const [initialState] = useState(createDefaultMessengerState);
  const [chats, setChats] = useState<Chat[]>(initialState.chats);
  const [messages, setMessages] = useState<Message[]>(initialState.messages);
  const [activeChatId, setActiveChatId] = useState<string | null>(initialState.activeChatId);
  const [hydrated, setHydrated] = useState(false);
  const [profileOpen, setProfileOpen] = useState(() => window.innerWidth > 760);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(() => new Set());
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [viewerAttachment, setViewerAttachment] = useState<Attachment | null>(null);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) || null,
    [activeChatId, chats],
  );

  const activeMessages = useMemo(
    () => messages.filter((message) => message.chatId === activeChatId),
    [activeChatId, messages],
  );

  const replyingToMessage = useMemo(
    () => activeMessages.find((message) => message.id === replyingToMessageId) || null,
    [activeMessages, replyingToMessageId],
  );

  const editingMessage = useMemo(
    () => activeMessages.find((message) => message.id === editingMessageId) || null,
    [activeMessages, editingMessageId],
  );

  const selectChat = (chatId: string, preserveUnread: boolean) => {
    setActiveChatId(chatId);
    setProfileOpen(window.innerWidth > 760);
    setFocusedMessageId(null);
    setReplyingToMessageId(null);
    setEditingMessageId(null);

    if (preserveUnread) return;

    const next = markChatRead(chats, messages, chatId);
    setChats(next.chats);
    setMessages(next.messages);
  };

  const applyMessengerState = (state: MessengerState) => {
    setChats(state.chats);
    setMessages(state.messages);
    setActiveChatId(state.activeChatId);
  };

  const resetMessengerState = () => {
    void messengerRepository.reset().then((state) => {
      applyMessengerState(state);
    });
    setProfileOpen(window.innerWidth > 760);
    setSelectedMessageIds(new Set());
    setFocusedMessageId(null);
    setReplyingToMessageId(null);
    setEditingMessageId(null);
    setViewerAttachment(null);
  };

  const sendMessage = (text: string, attachments?: Attachment[]) => {
    if (!activeChatId) return;
    if (activeChat?.blocked) return;

    const message = createOutgoingMessage(activeChatId, text, replyingToMessageId || undefined, attachments);
    setMessages((items) => [...items, message]);
    setReplyingToMessageId(null);
    setFocusedMessageId(message.id);
    setChats((items) =>
      items.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              lastMessageId: message.id,
            }
          : chat,
      ),
    );

    window.setTimeout(() => {
      setMessages((items) => items.map((item) => (item.id === message.id ? { ...item, status: "delivered" } : item)));
    }, 700);

    window.setTimeout(() => {
      setMessages((items) => items.map((item) => (item.id === message.id ? { ...item, status: "read" } : item)));
    }, 1800);
  };

  const deleteMessage = (messageId: string) => {
    const target = messages.find((message) => message.id === messageId);
    if (!target) return;

    const nextMessages = messages.filter((message) => message.id !== messageId);
    setMessages(nextMessages);
    setSelectedMessageIds((items) => {
      const next = new Set(items);
      next.delete(messageId);
      return next;
    });
    if (replyingToMessageId === messageId) setReplyingToMessageId(null);
    if (editingMessageId === messageId) setEditingMessageId(null);

    setChats((items) =>
      items.map((chat) => {
        if (chat.id !== target.chatId || chat.lastMessageId !== messageId) return chat;
        const lastMessage = [...nextMessages].reverse().find((message) => message.chatId === chat.id);
        return { ...chat, lastMessageId: lastMessage?.id || "" };
      }),
    );
  };

  const handleMessageAction = (messageId: string, action: MessageAction) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message) return;

    if (action === "reply") {
      setEditingMessageId(null);
      setReplyingToMessageId(messageId);
      return;
    }

    if (action === "edit") {
      if (!message.outgoing || !message.text) return;
      setReplyingToMessageId(null);
      setEditingMessageId(messageId);
      return;
    }

    if (action === "copy") {
      if (message.text) void navigator.clipboard?.writeText(message.text);
      return;
    }

    if (action === "forward") {
      if (!activeChatId) return;
      sendMessage(`Переслано: ${message.text || message.attachments?.[0]?.title || "вложение"}`);
      return;
    }

    if (action === "select") {
      setSelectedMessageIds((items) => {
        const next = new Set(items);
        if (next.has(messageId)) next.delete(messageId);
        else next.add(messageId);
        return next;
      });
      return;
    }

    deleteMessage(messageId);
  };

  const editMessage = (messageId: string, text: string) => {
    setMessages((items) =>
      items.map((message) => (message.id === messageId ? { ...message, text, edited: true } : message)),
    );
    setEditingMessageId(null);
    setFocusedMessageId(messageId);
  };

  const markAttachmentPlayed = (messageId: string) => {
    setMessages((items) => items.map((message) => (message.id === messageId ? { ...message, listened: true } : message)));
  };

  const toggleReaction = (messageId: string, reaction: string) => {
    setMessages((items) =>
      items.map((message) => {
        if (message.id !== messageId) return message;

        const reactions = { ...(message.reactions || {}) };
        const previousReaction = message.myReaction;

        if (previousReaction) {
          const previousCount = (reactions[previousReaction] || 0) - 1;
          if (previousCount > 0) reactions[previousReaction] = previousCount;
          else delete reactions[previousReaction];
        }

        if (previousReaction === reaction) {
          return {
            ...message,
            myReaction: undefined,
            reactions,
          };
        }

        reactions[reaction] = (reactions[reaction] || 0) + 1;

        return {
          ...message,
          myReaction: reaction,
          reactions,
        };
      }),
    );
  };

  const handleChatAction = (chatId: string, action: ChatAction) => {
    if (action === "openProfile") {
      selectChat(chatId, false);
      setProfileOpen(true);
      return;
    }

    if (action === "delete") {
      setChats((items) => items.filter((chat) => chat.id !== chatId));
      setMessages((items) => items.filter((message) => message.chatId !== chatId));
      if (activeChatId === chatId) {
        const nextChat = chats.find((chat) => chat.id !== chatId);
        setActiveChatId(nextChat?.id || null);
      }
      return;
    }

    if (action === "clearHistory") {
      setMessages((items) => items.filter((message) => message.chatId !== chatId));
      setChats((items) =>
        items.map((chat) => (chat.id === chatId ? { ...chat, lastMessageId: "", unreadCount: 0, typing: undefined } : chat)),
      );
      return;
    }

    setChats((items) =>
      items.map((chat) => {
        if (chat.id !== chatId) return chat;
        if (action === "togglePin") return { ...chat, pinned: !chat.pinned };
        if (action === "toggleMute") return { ...chat, muted: !chat.muted };
        return { ...chat, blocked: !chat.blocked };
      }),
    );
  };

  const jumpToMessage = (messageId: string) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message) return;

    setActiveChatId(message.chatId);
    setFocusedMessageId(messageId);
    setProfileOpen(window.innerWidth > 760);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (viewerAttachment) {
        setViewerAttachment(null);
        return;
      }

      if (editingMessageId) {
        setEditingMessageId(null);
        return;
      }

      if (replyingToMessageId) {
        setReplyingToMessageId(null);
        return;
      }

      if (profileOpen) {
        setProfileOpen(false);
        return;
      }

      setActiveChatId(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingMessageId, profileOpen, replyingToMessageId, viewerAttachment]);

  useEffect(() => {
    let mounted = true;

    void messengerRepository.load().then((state) => {
      if (!mounted) return;
      applyMessengerState(state);
      setHydrated(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    void messengerRepository.save({
      chats,
      messages,
      activeChatId,
    });
  }, [activeChatId, chats, hydrated, messages]);

  return (
    <main className="lg2-page lg2-messenger">
      <Sidebar
        chats={chats}
        messages={messages}
        activeChatId={activeChatId}
        onSelectChat={selectChat}
        onChatAction={handleChatAction}
        onResetState={resetMessengerState}
      />
      <ChatWindow
        chat={activeChat}
        messages={activeMessages}
        profileOpen={profileOpen}
        onToggleProfile={() => setProfileOpen((value) => !value)}
        onCloseChat={() => setActiveChatId(null)}
        onSend={sendMessage}
        onCancelReply={() => setReplyingToMessageId(null)}
        onMessageAction={handleMessageAction}
        selectedMessageIds={selectedMessageIds}
        focusedMessageId={focusedMessageId}
        replyingToMessage={replyingToMessage}
        editingMessage={editingMessage}
        onEditMessage={editMessage}
        onCancelEdit={() => setEditingMessageId(null)}
        onOpenAttachment={setViewerAttachment}
        onPlayAttachment={markAttachmentPlayed}
        onReact={toggleReaction}
        onFocusMessage={setFocusedMessageId}
      />
      {profileOpen ? (
        <ProfilePanel
          chat={activeChat}
          messages={activeMessages}
          onClose={() => setProfileOpen(false)}
          onJumpToMessage={jumpToMessage}
        />
      ) : null}
      {viewerAttachment ? <MediaViewer attachment={viewerAttachment} onClose={() => setViewerAttachment(null)} /> : null}
    </main>
  );
}

export default function App() {
  return (
    <AppProviders>
      <MessengerShell />
    </AppProviders>
  );
}
