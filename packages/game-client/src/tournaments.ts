import type {
  PublicTournament,
  TournamentListing,
  TournamentIntent,
} from "@mench/game-protocol";
import type { SocialOptions } from "./social";
async function request<T>(
  options: SocialOptions,
  path: string,
  body?: object,
): Promise<T> {
  const response = await fetch(`${options.url ?? ""}/api/tournaments${path}`, {
    credentials: "include",
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok)
    throw Error(
      ((await response.json()) as { error?: string }).error ?? "REQUEST_FAILED",
    );
  return response.json() as Promise<T>;
}
export const listTournaments = (options: SocialOptions = {}) =>
  request<TournamentListing>(options, "");
export const readTournament = (options: SocialOptions, id: string) =>
  request<PublicTournament>(options, `/${encodeURIComponent(id)}`);
export const createTournament = (
  options: SocialOptions,
  capacity: 4 | 8 | 16 | 32,
) => request<PublicTournament>(options, "", { capacity });
export const sendTournament = (
  options: SocialOptions,
  id: string,
  intent: TournamentIntent,
) => request<PublicTournament>(options, `/${encodeURIComponent(id)}`, intent);
