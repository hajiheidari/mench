/**
 * "edge" builds talk to the Cloudflare Worker (casual online rooms only);
 * the default "node" build talks to the full Fastify API with accounts.
 */
export const EDGE = import.meta.env.VITE_BACKEND === "edge";
