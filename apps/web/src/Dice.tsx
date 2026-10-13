import { useContext, type CSSProperties } from "react";
import {
  DICE_STYLES,
  diceFaceSvg,
  dicePips,
  type DiceSkinId,
} from "@mench/board-geometry";

const textures = new Map<DiceSkinId, string | null>();
/** The die's face texture as a CSS background, built once per design. */
function texture(skin: DiceSkinId): string | null {
  if (!textures.has(skin)) {
    const svg = diceFaceSvg(skin);
    textures.set(
      skin,
      svg
        ? `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
        : null,
    );
  }
  return textures.get(skin)!;
}
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
  const id = skin ?? chosen;
  const look = DICE_STYLES[id] ?? DICE_STYLES.classic;
  const face = texture(id);
  const style = {
    "--dice-top": look.faceTop,
    "--dice-bottom": look.faceBottom,
    "--dice-rim": look.rim,
    "--dice-edge": look.edge,
    "--dice-pip": look.pip,
    ...(face ? { backgroundImage: face, backgroundSize: "cover" } : {}),
  } as CSSProperties;
  return (
    <div className="dice" aria-live="polite" style={style}>
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
