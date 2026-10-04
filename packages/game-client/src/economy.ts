import type { CosmeticSku, EconomySnapshot } from "@mench/game-protocol";
import type { SocialOptions } from "./social";
async function request(options: SocialOptions, path: string, body?: object) {
  const response = await fetch(`${options.url ?? ""}/api/economy${path}`, {
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
  return response;
}
export async function readEconomy(
  options: SocialOptions = {},
): Promise<EconomySnapshot> {
  return (await request(options, "")).json() as Promise<EconomySnapshot>;
}
export async function buyCosmetic(
  options: SocialOptions,
  sku: CosmeticSku,
  requestId: string,
) {
  await request(options, "/purchase", { sku, requestId });
}
export async function equipCosmetic(
  options: SocialOptions,
  sku: CosmeticSku | null,
) {
  await request(options, "/equip", { sku });
}
