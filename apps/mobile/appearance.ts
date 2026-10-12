import { createContext } from "react";
import type { BoardThemeId, PawnSetId } from "@mench/board-geometry";

/** The designs the board draws with; classic until the wallet says otherwise. */
export const Appearance = createContext<{
  board: BoardThemeId;
  pawns: PawnSetId;
}>({ board: "classic", pawns: "classic" });
