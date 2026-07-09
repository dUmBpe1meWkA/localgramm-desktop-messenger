import { mockStickers, type MockSticker } from "../../data/mockStickers";

type StickerPanelProps = {
  onPick: (sticker: MockSticker) => void;
};

export default function StickerPanel({ onPick }: StickerPanelProps) {
  return (
    <div className="lg2-picker-panel lg2-sticker-panel" role="dialog" aria-label="Sticker picker">
      <header>
        <strong>Стикеры</strong>
        <span>{mockStickers.length}</span>
      </header>
      <div className="lg2-sticker-grid">
        {mockStickers.map((sticker) => (
          <button type="button" key={sticker.id} onClick={() => onPick(sticker)} aria-label={sticker.label}>
            {sticker.type === "video" ? (
              <video src={sticker.src} muted loop playsInline autoPlay />
            ) : (
              <img src={sticker.src} alt="" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
