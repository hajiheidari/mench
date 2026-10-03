import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { Database } from "./database";
import { createApp } from "./app";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL identity integration", () => {
  const db = new Database(url!);
  const app = createApp(undefined, 100, db);
  const email = `test-${randomUUID()}@example.com`;
  const password = "test-passphrase-12345";
  let session = "";
  let userId = "";
  beforeAll(async () => {
    await db.migrate();
    await db.migrate();
    await app.ready();
  });
  afterAll(async () => {
    await db.pool.query("DELETE FROM users WHERE email=$1", [email]);
    await app.close();
    await db.close();
  });
  test("registration stores a hash, duplicate and invalid input rejected", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, password, name: "Tester" },
    });
    expect(r.statusCode).toBe(201);
    userId = r.json<{ id: string }>().id;
    const row = await db.pool.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id=$1",
      [userId],
    );
    expect(row.rows[0]!.password_hash).not.toContain(password);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: { email, password, name: "Tester" },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: { email: "bad", password: "short", name: "Tester" },
        })
      ).statusCode,
    ).toBe(400);
  });
  test("login, HttpOnly session, self/profile isolation and CSRF", async () => {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email, password: "wrong-passphrase" },
        })
      ).statusCode,
    ).toBe(401);
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).not.toHaveProperty("token");
    expect(r.cookies[0]!.httpOnly).toBe(true);
    session = r.cookies[0]!.value;
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/me",
          cookies: { mench_session: session },
        })
      ).json(),
    ).toEqual({ id: userId, name: "Tester", email });
    const p = await app.inject({
      method: "GET",
      url: `/api/profiles/${userId}`,
    });
    expect(p.json()).toEqual({ id: userId, name: "Tester" });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/logout",
          headers: { origin: "https://evil.invalid" },
          cookies: { mench_session: session },
        })
      ).statusCode,
    ).toBe(403);
  });
  test("revocation and password-confirmed deletion invalidate all sessions", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: { mench_session: session },
    });
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/me",
          cookies: { mench_session: session },
        })
      ).statusCode,
    ).toBe(401);
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
      headers: { "x-client-platform": "mobile" },
    });
    const token = r.json<{ token: string }>().token;
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: "/api/me",
          headers: { authorization: `Bearer ${token}` },
          payload: { password: "wrong-passphrase" },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: "/api/me",
          headers: { authorization: `Bearer ${token}` },
          payload: { password },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/me",
          headers: { authorization: `Bearer ${token}` },
        })
      ).statusCode,
    ).toBe(401);
  });
});
