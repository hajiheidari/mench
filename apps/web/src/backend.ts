/**
 * "edge" builds talk to the Cloudflare Worker (casual online rooms only);
 * the default "node" build talks to the full Fastify API with accounts.
 */
export const EDGE = import.meta.env.VITE_BACKEND === "edge";

/**
 * The Iranian copy (mench.espadna.ir) is static files only; its online rooms
 * still live on the Worker, so it talks to mench.espadna.com.
 */
export const SERVER =
  EDGE && /(^|\.)espadna\.ir$/.test(location.hostname)
    ? "https://mench.espadna.com"
    : undefined;

/**
 * Answers when the game server is reachable; the online modes check it first.
 * Edge builds only (the Node development server has no such route here).
 */
export const HEALTH_URL = EDGE ? `${SERVER ?? ""}/healthz` : null;
