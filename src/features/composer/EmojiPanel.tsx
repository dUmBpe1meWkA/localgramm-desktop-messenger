const emojiGroups = [
  {
    label: "Основные",
    values: ["👍", "❤️", "😂", "🔥", "🥰", "👏", "😢", "😮"],
  },
  {
    label: "Лица",
    values: ["😀", "😁", "😅", "😊", "😎", "🤔", "🙃", "😴"],
  },
  {
    label: "Жесты",
    values: ["👋", "👌", "🙏", "🤝", "💪", "✌️", "🤌", "🫶"],
  },
  {
    label: "Объекты",
    values: ["💬", "📎", "📷", "🎧", "🎮", "💻", "📌", "⭐"],
  },
];

type EmojiPanelProps = {
  onPick: (emoji: string) => void;
};

export default function EmojiPanel({ onPick }: EmojiPanelProps) {
  return (
    <div className="lg2-picker-panel" role="dialog" aria-label="Emoji picker">
      {emojiGroups.map((group) => (
        <section className="lg2-emoji-group" key={group.label}>
          <h4>{group.label}</h4>
          <div className="lg2-emoji-grid">
            {group.values.map((emoji) => (
              <button type="button" key={emoji} onClick={() => onPick(emoji)} aria-label={`Emoji ${emoji}`}>
                {emoji}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
