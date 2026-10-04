import type { SocialIntent, SocialSnapshot } from "@mench/game-protocol";
export interface SocialOptions {
  url?: string;
  token?: string | null;
}
async function request(
  options: SocialOptions,
  path: string,
  body?: SocialIntent,
) {
  const response = await fetch(`${options.url ?? ""}/api/social${path}`, {
    credentials: "include",
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok)
    throw new Error(
      ((await response.json()) as { error?: string }).error ?? "REQUEST_FAILED",
    );
  return response;
}
export async function readSocial(
  options: SocialOptions = {},
): Promise<SocialSnapshot> {
  return (await request(options, "")).json() as Promise<SocialSnapshot>;
}
export async function sendSocial(
  options: SocialOptions,
  target: string,
  intent: SocialIntent,
): Promise<void> {
  await request(options, `/${encodeURIComponent(target)}`, intent);
}
