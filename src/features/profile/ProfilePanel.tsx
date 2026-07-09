import { useMemo, useState, type MouseEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { BellOff, File, Image, Link as LinkIcon, Music, Volume2, X, Video } from "lucide-react";
import ContextMenu from "../../shared/components/ContextMenu";
import type { Chat } from "../../types/chat";
import type { Attachment, AttachmentKind, Message } from "../../types/message";
import { getMockUser } from "../../data/mockUsers";
import { formatDuration, formatTime } from "../../shared/utils/format";

type ProfilePanelProps = {
  chat: Chat | null;
  messages: Message[];
  onClose: () => void;
  onJumpToMessage: (messageId: string) => void;
};

type MaterialTab = {
  kind: AttachmentKind;
  label: string;
  icon: LucideIcon;
};

type MaterialEntry = {
  message: Message;
  attachment: Attachment;
};

const materialKinds: MaterialTab[] = [
  { kind: "photo", label: "Фото", icon: Image },
  { kind: "video", label: "Видео", icon: Video },
  { kind: "videoNote", label: "Видеосообщения", icon: Video },
  { kind: "file", label: "Файлы", icon: File },
  { kind: "voice", label: "Голосовые", icon: Volume2 },
  { kind: "link", label: "Ссылки", icon: LinkIcon },
  { kind: "audio", label: "Музыка", icon: Music },
];

function getMaterialEntries(messages: Message[], kind: AttachmentKind): MaterialEntry[] {
  return messages.flatMap((message) =>
    (message.attachments || [])
      .filter((attachment) => attachment.kind === kind)
      .map((attachment) => ({
        message,
        attachment,
      })),
  );
}

function getMaterialTitle(entry: MaterialEntry): string {
  return entry.attachment.title || entry.message.text || "Вложение";
}

function getMaterialMeta(entry: MaterialEntry): string {
  if (entry.attachment.durationSec) return formatDuration(entry.attachment.durationSec);
  if (entry.attachment.sizeLabel) return entry.attachment.sizeLabel;
  return formatTime(entry.message.createdAt);
}

export default function ProfilePanel({ chat, messages, onClose, onJumpToMessage }: ProfilePanelProps) {
  const [activeKind, setActiveKind] = useState<AttachmentKind>("photo");
  const [menuState, setMenuState] = useState<{ x: number; y: number; messageId: string } | null>(null);

  const materialGroups = useMemo(
    () =>
      materialKinds.map((item) => ({
        ...item,
        entries: getMaterialEntries(messages, item.kind),
      })),
    [messages],
  );

  if (!chat) return null;

  const peer = chat.participantIds.map(getMockUser).find((user) => user && user.id !== 1);
  const activeGroup = materialGroups.find((group) => group.kind === activeKind) || materialGroups[0];

  const openMaterialMenu = (event: MouseEvent, messageId: string) => {
    event.preventDefault();
    setMenuState({ x: event.clientX, y: event.clientY, messageId });
  };

  return (
    <aside className="lg2-profile-panel">
      <header className="lg2-profile-topbar">
        <strong>Информация</strong>
        <button className="lg2-icon-button" type="button" aria-label="Закрыть профиль" onClick={onClose}>
          <X size={18} />
        </button>
      </header>

      <section className="lg2-profile-hero">
        <div className="lg2-avatar lg2-profile-avatar" style={{ background: chat.accentColor }}>
          {chat.title.slice(0, 1)}
        </div>
        <h2>{chat.title}</h2>
        <p>{chat.kind === "group" ? `${chat.participantIds.length} участника` : peer?.lastSeen || "online"}</p>
        {chat.muted ? (
          <span className="lg2-profile-flag">
            <BellOff size={14} /> без уведомлений
          </span>
        ) : null}
      </section>

      <section className="lg2-profile-block">
        <h3>Материалы чата</h3>
        <div className="lg2-material-list">
          {materialGroups.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={item.kind === activeKind ? "lg2-material-row lg2-material-row-active" : "lg2-material-row"}
                type="button"
                key={item.kind}
                onClick={() => setActiveKind(item.kind)}
              >
                <span>
                  <Icon size={18} />
                  {item.label}
                </span>
                <strong>{item.entries.length}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <section className="lg2-profile-block lg2-material-items">
        <h3>{activeGroup.label}</h3>
        {activeGroup.entries.length === 0 ? (
          <p>Пока нет материалов этого типа.</p>
        ) : (
          <div className="lg2-material-item-list">
            {activeGroup.entries.map((entry) => (
              <button
                className="lg2-material-item"
                key={entry.attachment.id}
                type="button"
                onClick={() => onJumpToMessage(entry.message.id)}
                onContextMenu={(event) => openMaterialMenu(event, entry.message.id)}
              >
                {entry.attachment.thumbnailUrl ? <img src={entry.attachment.thumbnailUrl} alt="" /> : <span className="lg2-material-file-icon" />}
                <span>
                  <strong>{getMaterialTitle(entry)}</strong>
                  <small>{getMaterialMeta(entry)}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="lg2-profile-block">
        <h3>Профиль</h3>
        <p>{peer?.bio || "Локальный mock-чат для проверки интерфейса."}</p>
        {peer?.username ? <p>@{peer.username}</p> : null}
      </section>

      {menuState ? (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          onClose={() => setMenuState(null)}
          items={[
            {
              label: "Перейти к сообщению в переписке",
              onSelect: () => onJumpToMessage(menuState.messageId),
            },
          ]}
        />
      ) : null}
    </aside>
  );
}
