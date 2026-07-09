export const quickReactions = ["👍", "❤️", "😂", "🔥", "🥰", "👏"] as const;

export type QuickReaction = (typeof quickReactions)[number];
