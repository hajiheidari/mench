import type { Rankings, RatingSummary } from "@mench/game-protocol";
import type { SocialOptions } from "./social";
export async function readRankings(options: SocialOptions = {}) {
  const request = async <T>(path: string): Promise<T> => {
    const response = await fetch(`${options.url ?? ""}/api/rankings${path}`, {
      credentials: "include",
      headers: options.token
        ? { Authorization: `Bearer ${options.token}` }
        : {},
    });
    if (!response.ok) throw Error("REQUEST_FAILED");
    return response.json() as Promise<T>;
  };
  const [leaderboard, self] = await Promise.all([
    request<Rankings>(""),
    request<RatingSummary>("/me"),
  ]);
  return { leaderboard, self };
}
