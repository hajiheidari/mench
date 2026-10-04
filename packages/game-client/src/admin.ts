import type { AdminIntent, AdminSummary } from "@mench/game-protocol";
import type { SocialOptions } from "./social";
async function request(
  options: SocialOptions,
  path: string,
  body?: AdminIntent,
) {
  return fetch(`${options.url ?? ""}/api/admin${path}`, {
    credentials: "include",
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
export async function readAdmin(
  options: SocialOptions = {},
): Promise<AdminSummary | null> {
  const role = await request(options, "/me");
  if (role.status === 403) return null;
  if (!role.ok) throw Error("REQUEST_FAILED");
  const data = await request(options, "");
  if (!data.ok) throw Error("REQUEST_FAILED");
  return data.json() as Promise<AdminSummary>;
}
export async function sendAdmin(options: SocialOptions, intent: AdminIntent) {
  const response = await request(options, "", intent);
  if (!response.ok)
    throw Error(
      ((await response.json()) as { error?: string }).error ?? "REQUEST_FAILED",
    );
}
