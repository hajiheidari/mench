import { createContext } from "react";
import type {
  BoardThemeId,
  DiceSkinId,
  PawnSetId,
} from "@mench/board-geometry";

/** The designs the board draws with; classic until the wallet says otherwise. */
export const Appearance = createContext<{
  board: BoardThemeId;
  pawns: PawnSetId;
  dice: DiceSkinId;
}>({ board: "classic", pawns: "classic", dice: "classic" });
