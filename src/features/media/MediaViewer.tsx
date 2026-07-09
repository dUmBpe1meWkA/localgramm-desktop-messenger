import { ExternalLink, X } from "lucide-react";
import type { Attachment } from "../../types/message";

type MediaViewerProps = {
  attachment: Attachment;
  onClose: () => void;
};

export default function MediaViewer({ attachment, onClose }: MediaViewerProps) {
  const source = attachment.url || attachment.thumbnailUrl || "";
  const isVideo = attachment.mimeType?.startsWith("video") || attachment.kind === "videoNote";

  return (
    <div className="lg2-media-viewer" role="dialog" aria-label="Просмотр медиа" onClick={onClose}>
      <div className="lg2-media-viewer-top">
        <strong>{attachment.title || "Медиа"}</strong>
        <button className="lg2-icon-button" type="button" aria-label="Закрыть просмотр" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="lg2-media-viewer-body" onClick={(event) => event.stopPropagation()}>
        {isVideo ? (
          <video src={source} controls autoPlay loop={attachment.kind === "sticker"} />
        ) : (
          <img src={source} alt={attachment.title || "Медиа"} />
        )}
      </div>

      {source ? (
        <a className="lg2-media-viewer-link" href={source} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
          <ExternalLink size={16} /> Открыть источник
        </a>
      ) : null}
    </div>
  );
}
