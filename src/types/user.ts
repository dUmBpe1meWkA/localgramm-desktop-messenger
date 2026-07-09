export type UserId = number;

export type ApiUser = {
  id: UserId;
  username: string;
  display_name?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  is_online?: boolean;
  last_seen_at?: string | null;
  show_online_status?: boolean;
  ask_before_adding_to_groups?: boolean;
};

export type User = {
  id: UserId;
  username: string;
  displayName: string;
  avatarUrl?: string;
  status: "online" | "offline" | "recently" | "hidden";
  lastSeen?: string;
  bio?: string;
  phone?: string;
};

export function getUserDisplayName(user: ApiUser | null | undefined): string {
  if (!user) return "";
  return user.display_name || user.name || user.username;
}
