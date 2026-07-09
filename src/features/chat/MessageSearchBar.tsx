import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useEffect, useRef } from "react";

type MessageSearchBarProps = {
  query: string;
  currentIndex: number;
  total: number;
  onQueryChange: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
};

export default function MessageSearchBar({
  query,
  currentIndex,
  total,
  onQueryChange,
  onNext,
  onPrevious,
  onClose,
}: MessageSearchBarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const resultText = query.trim() ? (total > 0 ? `${currentIndex + 1}/${total}` : "0/0") : "";

  return (
    <div
      className="lg2-message-search-bar"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <Search size={17} />
      <input
        ref={inputRef}
        type="search"
        placeholder="Поиск в чате"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) onPrevious();
            else onNext();
          }
        }}
      />
      <span>{resultText}</span>
      <button className="lg2-icon-button" type="button" aria-label="Предыдущий результат" disabled={total === 0} onClick={onPrevious}>
        <ChevronUp size={18} />
      </button>
      <button className="lg2-icon-button" type="button" aria-label="Следующий результат" disabled={total === 0} onClick={onNext}>
        <ChevronDown size={18} />
      </button>
      <button className="lg2-icon-button" type="button" aria-label="Закрыть поиск" onClick={onClose}>
        <X size={18} />
      </button>
    </div>
  );
}
