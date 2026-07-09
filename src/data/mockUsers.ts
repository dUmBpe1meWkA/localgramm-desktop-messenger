import type { User } from "../types/user";

export const currentUserId = 1;

export const mockUsers: User[] = [
  {
    id: currentUserId,
    username: "local_owner",
    displayName: "Алексей",
    status: "online",
    bio: "LocalGramm frontend sandbox",
    phone: "+7 900 000-00-00",
  },
  {
    id: 2,
    username: "mira.design",
    displayName: "Мира",
    status: "online",
    bio: "Дизайн, UI, стикеры",
  },
  {
    id: 3,
    username: "danila.dev",
    displayName: "Данила",
    status: "recently",
    lastSeen: "был недавно",
  },
  {
    id: 4,
    username: "localgramm_team",
    displayName: "LocalGramm Team",
    status: "hidden",
    bio: "Черновики, идеи и тесты интерфейса",
  },
];

export function getMockUser(userId: number): User | undefined {
  return mockUsers.find((user) => user.id === userId);
}
