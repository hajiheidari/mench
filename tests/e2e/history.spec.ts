import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import {
  applyAction,
  createGame,
  currentPlayer,
  legalMoves,
  type Action,
} from "@mench/game-engine";
import { reveal, secureSeed, type DiceProof } from "@mench/fair-dice";
import { verifyTranscriptConsistency } from "@mench/game-protocol";
test("participant can check and export a completed replay; archive witnessing limitation is visible", async ({
  page,
}) => {
  const db = new pg.Pool({
    connectionString:
      process.env.TEST_DATABASE_URL ??
      "postgres://mench:local-development-only@127.0.0.1:5432/mench",
  });
  const email = `history-${randomUUID()}@example.com`;
  const password = "history-test-passphrase-123";
  const matchId = randomUUID();
  let accountId: string | undefined;
  try {
    expect(
      (
        await page.request.post("http://127.0.0.1:3001/api/auth/register", {
          data: { email, password, name: "ReplayOwner" },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await page.request.post("http://127.0.0.1:3001/api/auth/login", {
          data: { email, password },
        })
      ).ok(),
    ).toBe(true);
    const profile = await (
      await page.request.get("http://127.0.0.1:3001/api/me")
    ).json();
    accountId = profile.id;
    const players = [randomUUID(), randomUUID()];
    const initialState = createGame(players);
    let state = initialState;
    const actions: Action[] = [];
    const proofs: DiceProof[] = [];
    for (let step = 0; step < 10000 && state.phase !== "finished"; step++) {
      const owner = currentPlayer(state).id;
      let action: Action;
      if (state.phase === "roll") {
        const proof = reveal(
          secureSeed(),
          {
            gameId: matchId,
            playerId: owner,
            roll: proofs.length,
            version: state.version,
          },
          secureSeed(),
        );
        proofs.push(proof);
        action = { type: "roll", playerId: owner, value: proof.value };
      } else
        action = { type: "move", playerId: owner, pawn: legalMoves(state)[0]! };
      state = applyAction(state, action);
      actions.push(action);
    }
    expect(state.phase).toBe("finished");
    const transcript = { initialState, actions, finalState: state, proofs };
    expect(verifyTranscriptConsistency(transcript)).toBe(true);
    // DB fixture only; no public result-submission or coin-grant endpoint exists.
    await db.query("INSERT INTO game_results(game_id,result) VALUES($1,$2)", [
      matchId,
      JSON.stringify({
        state,
        ranked: false,
        players: [
          { id: players[0], accountId, name: "ReplayOwner" },
          { id: players[1], name: "ReplayGuest" },
        ],
        transcript,
      }),
    ]);
    await page.goto("/");
    await page.getByRole("button", { name: "English", exact: true }).click();
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Match history" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "This checks archive consistency. Prior commitment publication can only be witnessed during live play.",
      ),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Check replay", exact: true })
      .click();
    await expect(
      page.getByText("Replay and dice calculations are consistent", {
        exact: true,
      }),
    ).toBeVisible();
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download replay", exact: true })
      .click();
    const downloaded = await downloading;
    expect(downloaded.suggestedFilename()).toBe("mench-replay.json");
    const file = await downloaded.path();
    if (!file) throw Error("DOWNLOAD_UNAVAILABLE");
    const exported = JSON.parse(await readFile(file, "utf8"));
    expect(verifyTranscriptConsistency(exported)).toBe(true);
    expect(exported).toEqual(transcript);
  } finally {
    await db.query("DELETE FROM game_results WHERE game_id=$1", [matchId]);
    if (accountId) await db.query("DELETE FROM users WHERE id=$1", [accountId]);
    await db.end();
  }
});
