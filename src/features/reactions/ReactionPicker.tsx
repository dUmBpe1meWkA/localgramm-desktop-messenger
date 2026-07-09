import { quickReactions } from "./reactions";

type ReactionPickerProps = {
  activeReaction?: string;
  onPick: (reaction: string) => void;
};

export default function ReactionPicker({ activeReaction, onPick }: ReactionPickerProps) {
  return (
    <div className="lg2-reaction-picker" role="group" aria-label="Быстрые реакции">
      {quickReactions.map((reaction) => (
        <button
          className={activeReaction === reaction ? "lg2-reaction-picker-active" : undefined}
          key={reaction}
          type="button"
          aria-label={`Реакция ${reaction}`}
          onClick={() => onPick(reaction)}
        >
          {reaction}
        </button>
      ))}
    </div>
  );
}
