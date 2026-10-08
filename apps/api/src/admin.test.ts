import { randomUUID, randomBytes, createHash } from "node:crypto";
import { beforeAll, afterAll, describe, test, expect } from "vitest";
import { io, type Socket } from "socket.io-client";
import { EVENTS, type Intent, type Reply } from "@mench/game-protocol";
import { Database } from "./database";
import { Rooms } from "./rooms";
import { createApp } from "./app";
import { hashPassword } from "./auth";
import { GameClient, type Session } from "@mench/game-client";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)(
  "PostgreSQL moderation and live session revocation",
  () => {
    const db = new Database(url!);
    const rooms = new Rooms();
    const ids = Array.from({ length: 3 }, () => randomUUID());
    const tokens = ids.map(() => randomBytes(32).toString("hex"));
    const secondary = randomBytes(32).toString("hex");
    const password = "test-passphrase-12345";
    const app = createApp(rooms, 100, db, { adminUserIds: [ids[0]!] });
    const sockets: Socket[] = [];
    let endpoint = "";
    let cap = "";
    let code = "";
    let reportId = "";
    let tournamentId = "";
    let revivedToken = "";
    let clientRoomCode = "";
    const headers = (index: number) => ({
      authorization: `Bearer ${tokens[index]}`,
    });
    const admin = (payload: object, actor = 0) =>
      app.inject({
        method: "POST",
        url: "/api/admin",
        headers: headers(actor),
        payload,
      });
    async function connect(token?: string) {
      const socket = io(endpoint, {
        transports: ["websocket"],
        forceNew: true,
        reconnection: false,
        ...(token
          ? { extraHeaders: { authorization: `Bearer ${token}` } }
          : {}),
      });
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
      });
      sockets.push(socket);
      return socket;
    }
    const command = (socket: Socket, payload: Intent) =>
      socket.timeout(5000).emitWithAck(EVENTS.COMMAND, {
        version: 1,
        requestId: randomUUID(),
        payload,
      }) as Promise<Reply>;
    beforeAll(async () => {
      await db.migrate();
      const hash = await hashPassword(password);
      for (let i = 0; i < 3; i++) {
        await db.pool.query(
          "INSERT INTO users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)",
          [ids[i], `${ids[i]}@example.com`, `Moderation${i}`, hash],
        );
        await db.pool.query(
          "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
          [createHash("sha256").update(tokens[i]!).digest("hex"), ids[i]],
        );
      }
      await db.pool.query(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
        [createHash("sha256").update(secondary).digest("hex"), ids[1]],
      );
      await app.listen({ port: 0, host: "127.0.0.1" });
      const address = app.server.address();
      if (!address || typeof address === "string") throw Error();
      endpoint = `http://127.0.0.1:${address.port}`;
      await connect(tokens[1]);
      await connect(secondary);
      await connect();
    });
    afterAll(async () => {
      for (const socket of sockets) socket.disconnect();
      await app.close();
      const cleanup = new Database(url!);
      if (tournamentId)
        await cleanup.pool.query("DELETE FROM tournaments WHERE id=$1", [
          tournamentId,
        ]);
      if (code)
        await cleanup.pool.query("DELETE FROM room_snapshots WHERE code=$1", [
          code,
        ]);
      if (clientRoomCode)
        await cleanup.pool.query("DELETE FROM room_snapshots WHERE code=$1", [
          clientRoomCode,
        ]);
      if (reportId)
        await cleanup.pool.query("DELETE FROM user_reports WHERE id=$1", [
          reportId,
        ]);
      await cleanup.pool.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [
        ids,
      ]);
      const audits = await cleanup.pool.query(
        "SELECT actor_id,subject_id FROM admin_audit WHERE request_id=ANY($1::uuid[])",
        [auditRequests],
      );
      expect(
        audits.rows.every((r) => r.actor_id === null && r.subject_id === null),
      ).toBe(true);
      await cleanup.close();
    });
    const auditRequests: string[] = [];
    test("logout revokes only its game sockets; registered room capabilities require matching live account", async () => {
      const created = await command(sockets[0]!, {
        type: "create",
        name: "Moderation1",
        capacity: 2,
      });
      if (!created.ok || !created.room || !created.token) throw Error();
      code = created.room.code;
      cap = created.token;
      expect(
        await command(sockets[2]!, { type: "resume", code, token: cap }),
      ).toEqual({ ok: false, error: "UNAUTHENTICATED" });
      const revoked = new Promise<void>((resolve) =>
        sockets[0]!.once(EVENTS.AUTH_REVOKED, resolve),
      );
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/auth/logout",
            headers: headers(1),
            payload: {},
          })
        ).statusCode,
      ).toBe(200);
      await revoked;
      expect(sockets[1]!.connected).toBe(true);
      expect(
        (await command(sockets[1]!, { type: "resume", code, token: cap })).ok,
      ).toBe(true);
      expect(
        (await app.inject({ url: "/api/me", headers: headers(1) })).statusCode,
      ).toBe(401);
    });
    test("server roles protect admin data, suspension revokes every session, audits and retries are immutable", async () => {
      expect((await app.inject({ url: "/api/admin" })).statusCode).toBe(403);
      expect(
        (await app.inject({ url: "/api/admin", headers: headers(2) }))
          .statusCode,
      ).toBe(403);
      const requestId = randomUUID();
      auditRequests.push(requestId);
      const payload = {
        type: "suspend",
        requestId,
        userId: ids[1],
        days: 1,
        reason: "cheating",
      };
      expect((await admin(payload, 2)).statusCode).toBe(403);
      expect((await admin({ ...payload, forceDice: 6 })).statusCode).toBe(400);
      const revoked = new Promise<void>((resolve) =>
        sockets[1]!.once(EVENTS.AUTH_REVOKED, resolve),
      );
      expect((await admin(payload)).statusCode).toBe(200);
      await revoked;
      expect((await admin(payload)).statusCode).toBe(200);
      expect((await admin({ ...payload, days: 2 })).statusCode).toBe(409);
      expect(
        (
          await db.pool.query("SELECT * FROM sessions WHERE user_id=$1", [
            ids[1],
          ])
        ).rows,
      ).toEqual([]);
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: `${ids[1]}@example.com`, password },
      });
      expect(login.statusCode).toBe(403);
      expect(login.json().error).toBe("ACCOUNT_SUSPENDED");
      const audit = await db.pool.query(
        "SELECT action FROM admin_audit WHERE actor_id=$1 AND request_id=$2",
        [ids[0], requestId],
      );
      expect(audit.rows).toEqual([{ action: "suspend" }]);
      await expect(
        db.pool.query(
          "UPDATE admin_audit SET action='forged' WHERE actor_id=$1",
          [ids[0]],
        ),
      ).rejects.toThrow("AUDIT_IMMUTABLE");
      const summary = await app.inject({
        url: "/api/admin",
        headers: headers(0),
      });
      expect(summary.statusCode).toBe(200);
      expect(JSON.stringify(summary.json())).not.toContain("@example.com");
      expect(JSON.stringify(summary.json())).not.toContain(cap);
      expect(JSON.stringify(summary.json())).not.toContain(tokens[0]);
    });
    test("report decisions and live-bracket cancellations have audit entries; administrators cannot suspend privileged peers", async () => {
      expect(
        (
          await admin({
            type: "suspend",
            requestId: randomUUID(),
            userId: ids[0],
            days: 1,
            reason: "abuse",
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: "POST",
            url: `/api/social/${ids[1]}`,
            headers: headers(2),
            payload: { type: "report", reason: "cheating" },
          })
        ).statusCode,
      ).toBe(200);
      reportId = (
        await db.pool.query<{ id: string }>(
          "SELECT id FROM user_reports WHERE reporter=$1 AND subject=$2",
          [ids[2], ids[1]],
        )
      ).rows[0]!.id;
      const reportRequest = randomUUID();
      auditRequests.push(reportRequest);
      expect(
        (
          await admin({
            type: "report",
            requestId: reportRequest,
            reportId,
            status: "actioned",
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await db.pool.query("SELECT status FROM user_reports WHERE id=$1", [
            reportId,
          ])
        ).rows,
      ).toEqual([{ status: "actioned" }]);
      const created = await app.inject({
        method: "POST",
        url: "/api/tournaments",
        headers: headers(2),
        payload: { capacity: 4 },
      });
      expect(created.statusCode).toBe(201);
      tournamentId = created.json().id;
      // A live bracket cancellation uses the same audited endpoint; no winner is fabricated.
      await db.pool.query(
        "UPDATE tournaments SET snapshot=jsonb_set(snapshot,'{phase}','\"running\"') WHERE id=$1",
        [tournamentId],
      );
      const cancelRequest = randomUUID();
      auditRequests.push(cancelRequest);
      expect(
        (
          await admin({
            type: "cancelTournament",
            requestId: cancelRequest,
            tournamentId,
            reason: "spam",
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await db.pool.query(
            "SELECT snapshot->>'phase' AS phase FROM tournaments WHERE id=$1",
            [tournamentId],
          )
        ).rows,
      ).toEqual([{ phase: "cancelled" }]);
    });
    test("restored access requires fresh login; account deletion revokes live games and anonymizes protected audit identities", async () => {
      const requestId = randomUUID();
      auditRequests.push(requestId);
      expect(
        (
          await admin({
            type: "unsuspend",
            requestId,
            userId: ids[1],
            reason: "cheating",
          })
        ).statusCode,
      ).toBe(200);
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { "x-client-platform": "mobile" },
        payload: { email: `${ids[1]}@example.com`, password },
      });
      expect(login.statusCode).toBe(200);
      revivedToken = login.json().token;
      const socket = await connect(revivedToken);
      expect(
        (await command(socket, { type: "resume", code, token: cap })).ok,
      ).toBe(true);
      const revoked = new Promise<void>((resolve) =>
        socket.once(EVENTS.AUTH_REVOKED, resolve),
      );
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: "/api/me",
            headers: { authorization: `Bearer ${revivedToken}` },
            payload: { password },
          })
        ).statusCode,
      ).toBe(200);
      await revoked;
      expect(
        await command(sockets[2]!, { type: "resume", code, token: cap }),
      ).toEqual({ ok: false, error: "UNAUTHENTICATED" });
      const audit = await db.pool.query(
        "SELECT subject_id FROM admin_audit WHERE action='suspend' AND request_id=$1",
        [auditRequests[0]],
      );
      expect(audit.rows).toEqual([{ subject_id: null }]);
    });
    test("shared client clears the room capability and authoritative view after account logout", async () => {
      const saved: (Session | null)[] = [];
      const client = new GameClient({
        url: endpoint,
        token: tokens[2]!,
        requestId: randomUUID,
        save: (session) => saved.push(session),
      });
      client.connect();
      try {
        await new Promise<void>((resolve) => {
          const stop = client.subscribe((state) => {
            if (state.connected) {
              queueMicrotask(stop);
              resolve();
            }
          });
        });
        const created = await client.send({
          type: "create",
          name: "Moderation2",
          capacity: 2,
        });
        if (!created?.ok || !created.room) throw Error();
        clientRoomCode = created.room.code;
        expect(saved.at(-1)).not.toBe(null);
        const revoked = new Promise<void>((resolve) => {
          const stop = client.subscribe((state) => {
            if (state.error === "UNAUTHENTICATED") {
              queueMicrotask(stop);
              resolve();
            }
          });
        });
        await app.inject({
          method: "POST",
          url: "/api/auth/logout",
          headers: headers(2),
          payload: {},
        });
        await revoked;
        expect(saved.at(-1)).toBe(null);
        expect(client.state.room).toBe(null);
        expect(client.state.connected).toBe(false);
      } finally {
        client.close();
      }
    });
    test("an already connected authenticated socket is revoked when its session expires", async () => {
      const shortToken = randomBytes(32).toString("hex");
      await db.pool.query(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 second')",
        [createHash("sha256").update(shortToken).digest("hex"), ids[2]],
      );
      const socket = await connect(shortToken);
      await new Promise<void>((resolve) =>
        socket.once(EVENTS.AUTH_REVOKED, resolve),
      );
      expect(
        (
          await app.inject({
            url: "/api/me",
            headers: { authorization: `Bearer ${shortToken}` },
          })
        ).statusCode,
      ).toBe(401);
    });
  },
);
