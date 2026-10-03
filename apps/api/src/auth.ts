import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import cookie from "@fastify/cookie";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Database } from "./database";
const derive = (
  password: string,
  salt: string,
  length: number,
  options: ScryptOptions,
) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, length, options, (error, result) =>
      error ? reject(error) : resolve(result),
    ),
  );
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const credentials = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
const registration = credentials
  .extend({
    name: z
      .string()
      .trim()
      .min(1)
      .max(24)
      .regex(/^[\p{L}\p{N} _-]+$/u),
  })
  .strict();
interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
}
export interface Account {
  id: string;
  name: string;
  email: string;
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await derive(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}
export async function checkPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [salt, hash] = encoded.split(":");
  if (!salt || !hash) return false;
  const derived = (await derive(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return (
    expected.length === derived.length && timingSafeEqual(expected, derived)
  );
}
export async function resolveAccount(
  db: Database,
  raw: string | undefined,
): Promise<Account | null> {
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const result = await db.pool.query<UserRow>(
    "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()",
    [digest(raw)],
  );
  const user = result.rows[0];
  return user
    ? { id: user.id, name: user.display_name, email: user.email }
    : null;
}
export function registerAuth(app: FastifyInstance, db: Database) {
  app.register(cookie);
  const allowed = (
    process.env.ALLOWED_ORIGINS ??
    "http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:3200,http://127.0.0.1:4173"
  ).split(",");
  const token = (req: FastifyRequest) =>
    req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : req.cookies.mench_session;
  const identify = (req: FastifyRequest): Promise<Account | null> =>
    resolveAccount(db, token(req));
  app.addHook("preHandler", async (req, reply) => {
    if (
      req.url.startsWith("/api/") &&
      ["POST", "DELETE", "PATCH"].includes(req.method) &&
      req.headers.origin &&
      !allowed.includes(req.headers.origin)
    )
      return reply.code(403).send({ error: "ORIGIN_REJECTED" });
  });
  app.post(
    "/api/auth/register",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const input = registration.safeParse(req.body);
      if (!input.success)
        return reply.code(400).send({ error: "INVALID_INPUT" });
      const { email, password, name } = input.data;
      const passwordHash = await hashPassword(password);
      const id = randomUUID();
      try {
        await db.pool.query(
          "INSERT INTO users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)",
          [id, email, name, passwordHash],
        );
        return reply.code(201).send({ id, name });
      } catch (error) {
        if ((error as { code?: string }).code === "23505")
          return reply.code(409).send({ error: "ACCOUNT_UNAVAILABLE" });
        throw error;
      }
    },
  );
  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const input = credentials.safeParse(req.body);
      if (!input.success)
        return reply.code(400).send({ error: "INVALID_INPUT" });
      const result = await db.pool.query<UserRow>(
        "SELECT * FROM users WHERE email=$1",
        [input.data.email],
      );
      const user = result.rows[0];
      // A missing account still runs the same expensive KDF; never disclose passwords or hashes.
      const encoded =
        user?.password_hash ?? "00".repeat(16) + ":" + "00".repeat(64);
      if (!(await checkPassword(input.data.password, encoded)) || !user)
        return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
      const raw = randomBytes(32).toString("hex");
      await db.pool.query("DELETE FROM sessions WHERE expires_at <= now()");
      await db.pool.query(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')",
        [digest(raw), user.id],
      );
      reply.setCookie("mench_session", raw, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 30 * 86400,
      });
      return {
        id: user.id,
        name: user.display_name,
        ...(req.headers["x-client-platform"] === "mobile"
          ? { token: raw }
          : {}),
      };
    },
  );
  app.get("/api/me", async (req, reply) => {
    const user = await identify(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    return user;
  });
  app.post("/api/auth/logout", async (req, reply) => {
    const raw = token(req);
    if (raw)
      await db.pool.query("DELETE FROM sessions WHERE token_hash=$1", [
        digest(raw),
      ]);
    reply.clearCookie("mench_session", { path: "/" });
    return { ok: true };
  });
  app.get("/api/profiles/:id", async (req, reply) => {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(req.params);
    if (!parsed.success)
      return reply.code(400).send({ error: "INVALID_INPUT" });
    const result = await db.pool.query<{ id: string; display_name: string }>(
      "SELECT id,display_name FROM users WHERE id=$1",
      [parsed.data.id],
    );
    if (!result.rows[0]) return reply.code(404).send({ error: "NOT_FOUND" });
    return { id: result.rows[0].id, name: result.rows[0].display_name };
  });
  app.delete("/api/me", async (req, reply) => {
    const user = await identify(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const parsed = z
      .object({ password: z.string().min(12).max(128) })
      .strict()
      .safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "INVALID_INPUT" });
    const result = await db.pool.query<UserRow>(
      "SELECT * FROM users WHERE id=$1",
      [user.id],
    );
    if (
      !result.rows[0] ||
      !(await checkPassword(parsed.data.password, result.rows[0].password_hash))
    )
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    await db.pool.query("DELETE FROM users WHERE id=$1", [user.id]);
    reply.clearCookie("mench_session", { path: "/" });
    return { ok: true };
  });
  return { identify };
}
