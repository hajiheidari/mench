import type { GameHistory, GameTranscript } from "@mench/game-protocol";
import type { SocialOptions } from "./social";
async function request<T>(options: SocialOptions, path: string): Promise<T> {
  const response = await fetch(`${options.url ?? ""}/api/history${path}`, {
    credentials: "include",
    headers: options.token ? { Authorization: `Bearer ${options.token}` } : {},
  });
  if (!response.ok)
    throw Error(
      ((await response.json()) as { error?: string }).error ?? "REQUEST_FAILED",
    );
  return response.json() as Promise<T>;
}
export function readHistory(options: SocialOptions = {}) {
  return request<GameHistory>(options, "");
}
export function readTranscript(id: string, options: SocialOptions = {}) {
  return request<GameTranscript>(options, `/${encodeURIComponent(id)}`);
}
