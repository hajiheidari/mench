import { expect, test } from "vitest";
import { createApp } from "./app";
test("health route reports versioned JSON and unknown routes fail", async () => {
  const app = createApp();
  try {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", protocolVersion: 1 });
    expect(
      (await app.inject({ method: "GET", url: "/missing" })).statusCode,
    ).toBe(404);
  } finally {
    await app.close();
  }
});
