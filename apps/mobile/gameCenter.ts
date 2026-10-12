import { useEffect, useRef, useState } from "react";
import { FREE_SKUS } from "@mench/board-geometry";
import type { WalletView } from "@mench/game-client";
import { GameCenter } from "./modules/game-center";

/** Set up in App Store Connect by infra/scripts/asc_gamecenter.py. */
export const LEADERBOARD = "com.espadna.mench.online_wins";
export const ACHIEVEMENTS = {
  firstWin: "com.espadna.mench.first_win",
  online10: "com.espadna.mench.online_wins_10",
  online50: "com.espadna.mench.online_wins_50",
  firstDesign: "com.espadna.mench.first_design",
} as const;

/**
 * Signs in to Game Center (iOS) and mirrors the wallet's server-counted wins
 * to the leaderboard and achievements whenever they change.
 */
export function useGameCenter(wallet: WalletView | null) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    GameCenter?.authenticate()
      .then(setReady)
      .catch(() => setReady(false));
  }, []);
  const sent = useRef("");
  useEffect(() => {
    const gc = GameCenter;
    if (!gc || !ready || !wallet) return;
    const online = wallet.onlineWins ?? 0;
    const wins = online + (wallet.botWins ?? 0);
    const designs = wallet.owned.length - FREE_SKUS.length;
    const key = `${online}:${wins}:${designs}`;
    if (sent.current === key) return;
    sent.current = key;
    void (async () => {
      try {
        if (online > 0) {
          await gc.submitScore(LEADERBOARD, online);
          await gc.reportAchievement(ACHIEVEMENTS.online10, online * 10);
          await gc.reportAchievement(ACHIEVEMENTS.online50, online * 2);
        }
        if (wins > 0) await gc.reportAchievement(ACHIEVEMENTS.firstWin, 100);
        if (designs > 0)
          await gc.reportAchievement(ACHIEVEMENTS.firstDesign, 100);
      } catch {
        // Offline or Game Center hiccup: the next wallet change retries.
        sent.current = "";
      }
    })();
  }, [ready, wallet]);
  return ready ? () => void GameCenter?.showDashboard() : null;
}
