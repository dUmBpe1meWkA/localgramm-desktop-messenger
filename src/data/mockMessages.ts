import type { Message } from "../types/message";
import { currentUserId } from "./mockUsers";

export const mockMessages: Message[] = [
  {
    id: "m-101",
    chatId: "chat-mira",
    authorId: 2,
    text: "Я собрала первые категории эмоджи. Главное, чтобы picker больше не ломал высоту composer.",
    createdAt: "2026-05-25T09:12:00+03:00",
    status: "read",
    outgoing: false,
  },
  {
    id: "m-102",
    chatId: "chat-mira",
    authorId: currentUserId,
    text: "Сначала закрепим базовую архитектуру. Потом спокойно вернем picker и стикеры.",
    createdAt: "2026-05-25T09:14:00+03:00",
    status: "read",
    outgoing: true,
    reactions: {
      "👍": 1,
    },
  },
  {
    id: "m-103",
    chatId: "chat-mira",
    authorId: 2,
    text: "Ок, еще приложила референс сетки материалов.",
    createdAt: "2026-05-25T09:18:00+03:00",
    status: "delivered",
    outgoing: false,
    reactions: {
      "🔥": 2,
      "❤️": 1,
    },
    attachments: [
      {
        id: "a-103-photo",
        kind: "photo",
        title: "materials-grid.png",
        thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=640&q=80",
        url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1280&q=80",
      },
    ],
  },
  {
    id: "m-104",
    chatId: "chat-mira",
    authorId: 2,
    text: "Голосовое про правую панель.",
    createdAt: "2026-05-25T09:21:00+03:00",
    status: "delivered",
    outgoing: false,
    listened: false,
    attachments: [
      {
        id: "a-104-voice",
        kind: "voice",
        title: "voice-message.webm",
        durationSec: 37,
        waveform: [18, 34, 22, 48, 30, 58, 44, 25, 52, 41, 28, 46, 20, 36, 54, 32],
      },
    ],
  },
  {
    id: "m-201",
    chatId: "chat-danila",
    authorId: 3,
    text: "Ctrl+клик должен просто открыть чат, без read receipt. Это удобно для проверки непрочитанного.",
    createdAt: "2026-05-24T21:35:00+03:00",
    status: "delivered",
    outgoing: false,
  },
  {
    id: "m-202",
    chatId: "chat-danila",
    authorId: currentUserId,
    text: "Добавлю это в состояние App, но UI оставлю в отдельных компонентах.",
    createdAt: "2026-05-24T21:37:00+03:00",
    status: "delivered",
    outgoing: true,
  },
  {
    id: "m-203",
    chatId: "chat-danila",
    authorId: 3,
    text: "И Esc пусть закрывает активную панель.",
    createdAt: "2026-05-24T21:39:00+03:00",
    status: "delivered",
    outgoing: false,
    attachments: [
      {
        id: "a-203-link",
        kind: "link",
        title: "Telegram Desktop UI patterns",
        url: "https://desktop.telegram.org/",
      },
    ],
  },
  {
    id: "m-301",
    chatId: "chat-team",
    authorId: 4,
    text: "Материалы чата должны считать реальные вложения, а не показывать нули.",
    createdAt: "2026-05-23T18:06:00+03:00",
    status: "read",
    outgoing: false,
    attachments: [
      {
        id: "a-301-file",
        kind: "file",
        title: "localgramm-plan.md",
        sizeLabel: "18 KB",
      },
      {
        id: "a-301-audio",
        kind: "audio",
        title: "notification-draft.mp3",
        durationSec: 128,
      },
    ],
  },
  {
    id: "m-302",
    chatId: "chat-team",
    authorId: currentUserId,
    text: "Принято. Начинаю с маленьких компонентов и mock-слоя.",
    createdAt: "2026-05-23T18:12:00+03:00",
    status: "read",
    outgoing: true,
  },
  {
    id: "m-303",
    chatId: "chat-team",
    authorId: 4,
    text: "Видео-кружок отдельно от обычного видео.",
    createdAt: "2026-05-23T18:17:00+03:00",
    status: "read",
    outgoing: false,
    attachments: [
      {
        id: "a-303-video-note",
        kind: "videoNote",
        title: "video-note.webm",
        durationSec: 12,
        thumbnailUrl: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=400&q=80",
      },
    ],
  },
];

export function getMessagesByChat(chatId: string, messages: Message[] = mockMessages): Message[] {
  return messages.filter((message) => message.chatId === chatId);
}
