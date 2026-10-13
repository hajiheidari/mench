import { useContext, type CSSProperties } from "react";
import { DICE_STYLES, dicePips, type DiceSkinId } from "@mench/board-geometry";
import { Appearance } from "./coins";

export function Dice({
  value,
  skin,
}: {
  value: number | null;
  /** Shop previews pass a design; the game uses the player's chosen one. */
  skin?: DiceSkinId;
}) {
  const chosen = useContext(Appearance).dice;
  const look = DICE_STYLES[skin ?? chosen] ?? DICE_STYLES.classic;
  const style = {
    "--dice-top": look.faceTop,
    "--dice-bottom": look.faceBottom,
    "--dice-rim": look.rim,
    "--dice-edge": look.edge,
    "--dice-pip": look.pip,
    ...(look.veins ? { "--dice-veins": look.veins } : {}),
  } as CSSProperties;
  return (
    <div
      className={look.veins ? "dice veined" : "dice"}
      aria-live="polite"
      style={style}
    >
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
