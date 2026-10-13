/* Generated from scripts/build-game-art.mjs designs: one image per board theme and pawn set. */
import type { ImageSourcePropType } from "react-native";
import type {
  BoardThemeId,
  DiceSkinId,
  PawnSetId,
} from "@mench/board-geometry";
import board from "./assets/game/board.png";
import board_wood from "./assets/game/board-wood.png";
import board_night from "./assets/game/board-night.png";
import board_firoozeh from "./assets/game/board-firoozeh.png";
import board_kashi from "./assets/game/board-kashi.png";
import board_khatam from "./assets/game/board-khatam.png";
import dice_wood from "./assets/game/dice-wood.png";
import dice_travertine from "./assets/game/dice-travertine.png";
import dice_marble from "./assets/game/dice-marble.png";
import dice_anar from "./assets/game/dice-anar.png";
import dice_copper from "./assets/game/dice-copper.png";
import dice_firoozeh from "./assets/game/dice-firoozeh.png";
import dice_lapis from "./assets/game/dice-lapis.png";
import dice_gold from "./assets/game/dice-gold.png";
import dice_night from "./assets/game/dice-night.png";
import pawn0 from "./assets/game/pawn-0.png";
import pawn1 from "./assets/game/pawn-1.png";
import pawn2 from "./assets/game/pawn-2.png";
import pawn3 from "./assets/game/pawn-3.png";
import pawn_wood_0 from "./assets/game/pawn-wood-0.png";
import pawn_wood_1 from "./assets/game/pawn-wood-1.png";
import pawn_wood_2 from "./assets/game/pawn-wood-2.png";
import pawn_wood_3 from "./assets/game/pawn-wood-3.png";
import pawn_crystal_0 from "./assets/game/pawn-crystal-0.png";
import pawn_crystal_1 from "./assets/game/pawn-crystal-1.png";
import pawn_crystal_2 from "./assets/game/pawn-crystal-2.png";
import pawn_crystal_3 from "./assets/game/pawn-crystal-3.png";
import pawn_copper_0 from "./assets/game/pawn-copper-0.png";
import pawn_copper_1 from "./assets/game/pawn-copper-1.png";
import pawn_copper_2 from "./assets/game/pawn-copper-2.png";
import pawn_copper_3 from "./assets/game/pawn-copper-3.png";
import pawn_firoozeh_0 from "./assets/game/pawn-firoozeh-0.png";
import pawn_firoozeh_1 from "./assets/game/pawn-firoozeh-1.png";
import pawn_firoozeh_2 from "./assets/game/pawn-firoozeh-2.png";
import pawn_firoozeh_3 from "./assets/game/pawn-firoozeh-3.png";
import pawn_gold_0 from "./assets/game/pawn-gold-0.png";
import pawn_gold_1 from "./assets/game/pawn-gold-1.png";
import pawn_gold_2 from "./assets/game/pawn-gold-2.png";
import pawn_gold_3 from "./assets/game/pawn-gold-3.png";

export const BOARD_ART: Record<BoardThemeId, ImageSourcePropType> = {
  classic: board,
  wood: board_wood,
  night: board_night,
  firoozeh: board_firoozeh,
  kashi: board_kashi,
  khatam: board_khatam,
};
export const PAWN_ART: Record<PawnSetId, ImageSourcePropType[]> = {
  classic: [pawn0, pawn1, pawn2, pawn3],
  wood: [pawn_wood_0, pawn_wood_1, pawn_wood_2, pawn_wood_3],
  crystal: [pawn_crystal_0, pawn_crystal_1, pawn_crystal_2, pawn_crystal_3],
  copper: [pawn_copper_0, pawn_copper_1, pawn_copper_2, pawn_copper_3],
  firoozeh: [
    pawn_firoozeh_0,
    pawn_firoozeh_1,
    pawn_firoozeh_2,
    pawn_firoozeh_3,
  ],
  gold: [pawn_gold_0, pawn_gold_1, pawn_gold_2, pawn_gold_3],
};

/** Die face textures (scripts/build-dice-art.mjs); the classic die is plain. */
export const DICE_ART: Partial<Record<DiceSkinId, ImageSourcePropType>> = {
  wood: dice_wood,
  travertine: dice_travertine,
  marble: dice_marble,
  anar: dice_anar,
  copper: dice_copper,
  firoozeh: dice_firoozeh,
  lapis: dice_lapis,
  gold: dice_gold,
  night: dice_night,
};
