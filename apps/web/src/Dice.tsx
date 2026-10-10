import { dicePips } from "@mench/board-geometry";
export function Dice({ value }: { value: number | null }) {
  return (
    <div className="dice" aria-live="polite">
      <span className="dice-value">{value ?? "✦"}</span>
      <div className="dice-face" key={value} aria-hidden="true">
        {value === null ? (
          <span className="dice-idle" />
        ) : (
          Array.from({ length: 9 }, (_, i) => (
            <i
              key={i}
              className={
                dicePips[value]?.some((pip) => pip === i) ? "pip filled" : "pip"
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
