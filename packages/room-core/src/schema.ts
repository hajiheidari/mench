import { z } from "zod";
const name = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .regex(/^[\p{L}\p{N} _-]+$/u);
const code = z.string().regex(/^[A-F0-9]{10}$/);
const version = z.number().int().min(0);
export const commandSchema = z
  .object({
    version: z.literal(1),
    requestId: z.string().uuid(),
    payload: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("create"),
          name,
          capacity: z.number().int().min(2).max(4),
          ranked: z.boolean().optional(),
        })
        .strict(),
      z.object({ type: z.literal("join"), name, code }).strict(),
      z
        .object({
          type: z.literal("resume"),
          code,
          token: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict(),
      z.object({ type: z.literal("start") }).strict(),
      z
        .object({
          type: z.literal("roll"),
          nonce: z.string().regex(/^[a-f0-9]{64}$/),
          expectedVersion: version,
        })
        .strict(),
      z
        .object({
          type: z.literal("move"),
          pawn: z.number().int().min(0).max(3),
          expectedVersion: version,
        })
        .strict(),
      z.object({ type: z.literal("leave") }).strict(),
      z
        .object({
          type: z.literal("queue"),
          name,
          ranked: z.boolean().optional(),
        })
        .strict(),
      z.object({ type: z.literal("cancelQueue") }).strict(),
    ]),
  })
  .strict();
