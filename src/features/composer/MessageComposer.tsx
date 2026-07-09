import { File, Image, Mic, Music, Paperclip, Send, Smile, StickyNote, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MockSticker } from "../../data/mockStickers";
import type { Attachment, Message } from "../../types/message";
import EmojiPanel from "./EmojiPanel";
import StickerPanel from "./StickerPanel";

type MessageComposerProps = {
  disabled?: boolean;
  onSend: (text: string, attachments?: Attachment[]) => void;
  replyingToMessage?: Message | null;
  onCancelReply?: () => void;
  editingMessage?: Message | null;
  onEditMessage?: (messageId: string, text: string) => void;
  onCancelEdit?: () => void;
};

type ComposerPanel = "emoji" | "stickers" | "attach" | "record" | null;

export default function MessageComposer({
  disabled = false,
  onSend,
  replyingToMessage,
  onCancelReply,
  editingMessage,
  onEditMessage,
  onCancelEdit,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [recordMode, setRecordMode] = useState<"voice" | "video">("voice");
  const [activePanel, setActivePanel] = useState<ComposerPanel>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previousEditingIdRef = useRef<string | null>(null);

  const canSend = text.trim().length > 0;

  useEffect(() => {
    if (!editingMessage && previousEditingIdRef.current) {
      previousEditingIdRef.current = null;
      setText("");
      return;
    }

    if (!editingMessage) return;
    previousEditingIdRef.current = editingMessage.id;
    setText(editingMessage.text || "");
    setActivePanel(null);
  }, [editingMessage]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
  }, [text]);

  useEffect(() => {
    if (disabled) setActivePanel(null);
  }, [disabled]);

  const submit = () => {
    if (disabled) return;
    if (!canSend) return;
    if (editingMessage) {
      onEditMessage?.(editingMessage.id, text.trim());
      setText("");
      setActivePanel(null);
      return;
    }
    onSend(text.trim());
    setText("");
    setActivePanel(null);
  };

  const sendAttachment = (attachment: Attachment, caption = "") => {
    if (disabled) return;
    onSend(caption, [attachment]);
    setActivePanel(null);
  };

  const sendMockRecording = () => {
    if (recordMode === "voice") {
      sendAttachment({
        id: `local-voice-${Date.now()}`,
        kind: "voice",
        title: "voice-message.webm",
        durationSec: 24,
        waveform: [20, 42, 28, 54, 38, 62, 31, 47, 24, 50, 44, 29, 58, 35, 22, 46],
      });
      return;
    }

    sendAttachment({
      id: `local-video-note-${Date.now()}`,
      kind: "videoNote",
      title: "video-note.webm",
      durationSec: 9,
      thumbnailUrl: "/tauri.svg",
    });
  };

  const sendSticker = (sticker: MockSticker) => {
    sendAttachment({
      id: `local-sticker-${sticker.id}-${Date.now()}`,
      kind: "sticker",
      title: sticker.label,
      url: sticker.src,
      mimeType: sticker.type === "video" ? "video/webm" : "image/webp",
    });
  };

  return (
    <footer className="lg2-composer">
      {replyingToMessage ? (
        <div className="lg2-composer-reply">
          <span>Ответ: {replyingToMessage.text || "вложение"}</span>
          <button type="button" onClick={onCancelReply} aria-label="Отменить ответ">
            Отмена
          </button>
        </div>
      ) : null}
      {editingMessage ? (
        <div className="lg2-composer-reply lg2-composer-edit">
          <span>Редактирование сообщения</span>
          <button
            type="button"
            onClick={() => {
              setText("");
              onCancelEdit?.();
            }}
            aria-label="Отменить редактирование"
          >
            Отмена
          </button>
        </div>
      ) : null}
      {disabled ? <div className="lg2-composer-disabled">Чат заблокирован. Отправка сообщений отключена.</div> : null}
      {activePanel === "emoji" ? <EmojiPanel onPick={(emoji) => setText((value) => `${value}${emoji}`)} /> : null}
      {activePanel === "stickers" ? <StickerPanel onPick={sendSticker} /> : null}
      {activePanel === "attach" ? (
        <div className="lg2-picker-panel lg2-attach-panel" role="dialog" aria-label="Вложения">
          <button
            type="button"
            onClick={() =>
              sendAttachment({
                id: `local-photo-${Date.now()}`,
                kind: "photo",
                title: "local-photo.svg",
                thumbnailUrl: "/vite.svg",
                url: "/vite.svg",
              })
            }
          >
            <Image size={18} /> Фото
          </button>
          <button
            type="button"
            onClick={() =>
              sendAttachment({
                id: `local-file-${Date.now()}`,
                kind: "file",
                title: "localgramm-notes.txt",
                sizeLabel: "4 KB",
              })
            }
          >
            <File size={18} /> Файл
          </button>
          <button
            type="button"
            onClick={() =>
              sendAttachment({
                id: `local-audio-${Date.now()}`,
                kind: "audio",
                title: "sound.mp3",
                durationSec: 18,
              })
            }
          >
            <Music size={18} /> Аудио
          </button>
        </div>
      ) : null}
      {activePanel === "record" ? (
        <div className="lg2-picker-panel lg2-record-panel" role="dialog" aria-label="Запись">
          <strong>{recordMode === "voice" ? "Голосовое сообщение" : "Видеосообщение"}</strong>
          <span>{recordMode === "voice" ? "00:24" : "00:09"}</span>
          <button type="button" onClick={sendMockRecording}>
            Отправить mock-запись
          </button>
        </div>
      ) : null}
      <button
        className="lg2-icon-button"
        type="button"
        aria-label="Вложения"
        disabled={disabled}
        onClick={() => setActivePanel((panel) => (panel === "attach" ? null : "attach"))}
      >
        <Paperclip size={19} />
      </button>
      <button
        className="lg2-icon-button"
        type="button"
        aria-label="Эмоджи"
        disabled={disabled}
        onClick={() => setActivePanel((panel) => (panel === "emoji" ? null : "emoji"))}
      >
        <Smile size={19} />
      </button>
      <textarea
        ref={textareaRef}
        value={text}
        rows={1}
        placeholder={disabled ? "Чат заблокирован" : "Сообщение"}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      {canSend ? (
        <button className="lg2-send-button" type="button" aria-label="Отправить" onClick={submit}>
          <Send size={18} />
        </button>
      ) : (
        <button
          className="lg2-send-button"
          type="button"
          aria-label={recordMode === "voice" ? "Режим голосового сообщения" : "Режим видеосообщения"}
          disabled={disabled}
          onClick={() => {
            setRecordMode((mode) => (mode === "voice" ? "video" : "voice"));
            setActivePanel("record");
          }}
        >
          {recordMode === "voice" ? <Mic size={18} /> : <Video size={18} />}
        </button>
      )}
      <button
        className="lg2-icon-button lg2-sticker-toggle"
        type="button"
        aria-label="Стикеры"
        disabled={disabled}
        onClick={() => setActivePanel((panel) => (panel === "stickers" ? null : "stickers"))}
      >
        <StickyNote size={18} />
      </button>
    </footer>
  );
}
