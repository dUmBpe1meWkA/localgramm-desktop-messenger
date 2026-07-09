import { useState, type MouseEvent } from "react";
import { Check, CheckCheck, File, Link as LinkIcon, Music, Play, Video } from "lucide-react";
import ContextMenu from "../../shared/components/ContextMenu";
import ReactionPicker from "../reactions/ReactionPicker";
import type { Attachment, Message } from "../../types/message";
import type { MessageAction } from "../../types/message";
import { classNames } from "../../shared/utils/classNames";
import { formatDuration, formatTime } from "../../shared/utils/format";

type MessageBubbleProps = {
  message: Message;
  selected: boolean;
  focused: boolean;
  replyText?: string;
  searchQuery: string;
  onAction: (messageId: string, action: MessageAction) => void;
  onOpenAttachment: (attachment: Attachment) => void;
  onPlayAttachment: (messageId: string) => void;
  onReact: (messageId: string, reaction: string) => void;
};

function MessageStatusIcon({ status }: { status: Message["status"] }) {
  if (status === "read") return <CheckCheck className="lg2-status-read" size={15} />;
  if (status === "delivered") return <CheckCheck size={15} />;
  if (status === "sent") return <Check size={15} />;
  return <span className="lg2-message-status-text">{status === "sending" ? "..." : "!"}</span>;
}

function Waveform({ values = [] }: { values?: number[] }) {
  return (
    <span className="lg2-waveform">
      {values.map((value, index) => (
        <span key={`${value}-${index}`} style={{ height: `${Math.max(8, Math.min(value, 58))}%` }} />
      ))}
    </span>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();
  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  let index = lowerText.indexOf(lowerQuery);

  while (index !== -1) {
    if (index > cursor) parts.push({ text: text.slice(cursor, index), match: false });
    parts.push({ text: text.slice(index, index + normalizedQuery.length), match: true });
    cursor = index + normalizedQuery.length;
    index = lowerText.indexOf(lowerQuery, cursor);
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });

  return (
    <>
      {parts.map((part, partIndex) =>
        part.match ? (
          <mark key={`${part.text}-${partIndex}`} className="lg2-search-mark">
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${partIndex}`}>{part.text}</span>
        ),
      )}
    </>
  );
}

function AttachmentView({
  attachment,
  listened,
  onOpen,
  onPlay,
}: {
  attachment: Attachment;
  listened?: boolean;
  onOpen: () => void;
  onPlay: () => void;
}) {
  if (attachment.kind === "sticker") {
    return (
      <button className="lg2-attachment lg2-sticker-attachment" type="button" onClick={onOpen} aria-label="Открыть стикер">
        {attachment.mimeType?.startsWith("video") ? (
          <video src={attachment.url} muted loop playsInline autoPlay />
        ) : (
          <img src={attachment.url} alt={attachment.title || "Стикер"} />
        )}
      </button>
    );
  }

  if (attachment.kind === "photo") {
    return (
      <button className="lg2-attachment lg2-photo-attachment" type="button" onClick={onOpen} aria-label="Открыть фото">
        <img src={attachment.thumbnailUrl || attachment.url} alt={attachment.title || "Фото"} />
      </button>
    );
  }

  if (attachment.kind === "voice") {
    return (
      <div className="lg2-attachment lg2-voice-attachment">
        <button className="lg2-round-play" type="button" aria-label="Проиграть голосовое" onClick={onPlay}>
          <Play size={15} fill="currentColor" />
        </button>
        <Waveform values={attachment.waveform} />
        <span className="lg2-duration">{formatDuration(attachment.durationSec)}</span>
        {!listened ? <span className="lg2-unlistened-dot" title="Не прослушано" /> : null}
      </div>
    );
  }

  if (attachment.kind === "videoNote") {
    return (
      <button className="lg2-attachment lg2-video-note" type="button" onClick={onOpen} aria-label="Открыть видеосообщение">
        {attachment.thumbnailUrl ? <img src={attachment.thumbnailUrl} alt={attachment.title || "Видеосообщение"} /> : <Video size={34} />}
        <span>{formatDuration(attachment.durationSec)}</span>
      </button>
    );
  }

  if (attachment.kind === "link") {
    return (
      <a className="lg2-attachment lg2-file-attachment" href={attachment.url} target="_blank" rel="noreferrer">
        <LinkIcon size={18} />
        <span>{attachment.title || attachment.url}</span>
      </a>
    );
  }

  const isAudio = attachment.kind === "audio";
  const Icon = isAudio ? Music : File;

  return (
    <button
      className="lg2-attachment lg2-file-attachment"
      type="button"
      onClick={isAudio ? onPlay : undefined}
      aria-label={isAudio ? "Проиграть аудио" : "Файл"}
    >
      <Icon size={19} />
      <span>{attachment.title || "Файл"}</span>
      {attachment.sizeLabel ? <small>{attachment.sizeLabel}</small> : null}
      {attachment.durationSec ? <small>{formatDuration(attachment.durationSec)}</small> : null}
    </button>
  );
}

export default function MessageBubble({
  message,
  selected,
  focused,
  replyText,
  searchQuery,
  onAction,
  onOpenAttachment,
  onPlayAttachment,
  onReact,
}: MessageBubbleProps) {
  const [menuPoint, setMenuPoint] = useState<{ x: number; y: number } | null>(null);

  const openContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    setMenuPoint({ x: event.clientX, y: event.clientY });
  };

  return (
    <>
      <article
        className={classNames(
          "lg2-message-row",
          message.outgoing && "lg2-message-row-out",
          selected && "lg2-message-row-selected",
          focused && "lg2-message-row-focused",
        )}
        data-message-id={message.id}
        onContextMenu={openContextMenu}
        onDoubleClick={() => onReact(message.id, "❤️")}
      >
        <div className={classNames("lg2-message-bubble", message.outgoing && "lg2-message-bubble-out")}>
          {replyText ? <div className="lg2-reply-preview">{replyText}</div> : null}
          {message.attachments?.map((attachment) => (
            <AttachmentView
              key={attachment.id}
              attachment={attachment}
              listened={message.listened}
              onOpen={() => onOpenAttachment(attachment)}
              onPlay={() => onPlayAttachment(message.id)}
            />
          ))}
          {message.text ? (
            <p>
              <HighlightedText text={message.text} query={searchQuery} />
            </p>
          ) : null}
          <footer className="lg2-message-footer">
            {message.edited ? <span>изменено</span> : null}
            <time>{formatTime(message.createdAt)}</time>
            {message.outgoing ? <MessageStatusIcon status={message.status} /> : null}
          </footer>
          {message.reactions && Object.keys(message.reactions).length > 0 ? (
            <div className="lg2-message-reactions">
              {Object.entries(message.reactions).map(([reaction, count]) => (
                <button
                  className={message.myReaction === reaction ? "lg2-message-reaction-active" : undefined}
                  key={reaction}
                  type="button"
                  aria-label={`Реакция ${reaction}`}
                  onClick={() => onReact(message.id, reaction)}
                >
                  <span>{reaction}</span>
                  <strong>{count}</strong>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </article>
      {menuPoint ? (
        <>
          <div className="lg2-reaction-popover" style={{ left: menuPoint.x, top: Math.max(8, menuPoint.y - 52) }}>
            <ReactionPicker
              activeReaction={message.myReaction}
              onPick={(reaction) => {
                onReact(message.id, reaction);
                setMenuPoint(null);
              }}
            />
          </div>
          <ContextMenu
            x={menuPoint.x}
            y={menuPoint.y}
            onClose={() => setMenuPoint(null)}
            items={[
              { label: "Ответить", onSelect: () => onAction(message.id, "reply") },
              { label: "Копировать", disabled: !message.text, onSelect: () => onAction(message.id, "copy") },
              { label: "Переслать", onSelect: () => onAction(message.id, "forward") },
              { label: selected ? "Снять выбор" : "Выбрать", onSelect: () => onAction(message.id, "select") },
              { label: "Редактировать", disabled: !message.outgoing || !message.text, onSelect: () => onAction(message.id, "edit") },
              { label: "Удалить", danger: true, onSelect: () => onAction(message.id, "delete") },
            ]}
          />
        </>
      ) : null}
    </>
  );
}
