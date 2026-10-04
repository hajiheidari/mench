import { useEffect, useRef, useState } from "react";
import { readAdmin, sendAdmin } from "@mench/game-client";
import type {
  AdminIntent,
  AdminSummary,
  ModerationReason,
} from "@mench/game-protocol";
import type { Messages } from "./messages";
export function Admin({ t }: { t: Messages }) {
  const [data, setData] = useState<AdminSummary | null>(null);
  const [target, setTarget] = useState("");
  const [days, setDays] = useState(1);
  const [reason, setReason] = useState<ModerationReason>("abuse");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const requests = useRef(new Map<string, string>());
  useEffect(() => {
    void readAdmin()
      .then(setData)
      .catch(() => setNotice(t.error));
  }, [t.error]);
  async function action(
    input:
      | Omit<Extract<AdminIntent, { type: "suspend" }>, "requestId">
      | Omit<Extract<AdminIntent, { type: "unsuspend" }>, "requestId">
      | Omit<Extract<AdminIntent, { type: "report" }>, "requestId">
      | Omit<Extract<AdminIntent, { type: "cancelTournament" }>, "requestId">,
  ) {
    setBusy(true);
    setNotice("");
    const key = JSON.stringify(input);
    const id = requests.current.get(key) ?? crypto.randomUUID();
    requests.current.set(key, id);
    try {
      await sendAdmin({}, { ...input, requestId: id });
      setData(await readAdmin());
      requests.current.delete(key);
      setNotice(t.done);
    } catch (e) {
      setNotice(
        t.errors[e instanceof Error ? e.message : "REQUEST_FAILED"] ?? t.error,
      );
    } finally {
      setBusy(false);
    }
  }
  if (!data) return null;
  return (
    <section>
      <h2>{t.admin}</h2>
      <p>
        {data.health.healthy ? t.healthy : t.error} · {t.rooms}:{" "}
        {data.health.rooms} · {t.activeGames}: {data.health.activeGames}
      </p>
      <button
        disabled={busy}
        onClick={() =>
          void readAdmin()
            .then(setData)
            .catch(() => setNotice(t.error))
        }
      >
        {t.refresh} · {t.admin}
      </button>
      <label>
        {t.accountId}
        <select
          aria-label={t.admin + " · " + t.accountId}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">{t.recentUsers}</option>
          {data.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {u.banned_until ? " · " + t.suspend : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t.days}
        <input
          type="number"
          min={1}
          max={30}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        />
      </label>
      <label>
        {t.report}
        <select
          aria-label={t.admin + " · " + t.report}
          value={reason}
          onChange={(e) => setReason(e.target.value as ModerationReason)}
        >
          {(["abuse", "cheating", "spam"] as const).map((r) => (
            <option key={r} value={r}>
              {t[r]}
            </option>
          ))}
        </select>
      </label>
      <div className="actions">
        <button
          disabled={busy || !target}
          onClick={() => {
            if (confirm(t.adminConfirm))
              void action({ type: "suspend", userId: target, days, reason });
          }}
        >
          {t.suspend}
        </button>
        <button
          disabled={busy || !target}
          onClick={() =>
            void action({ type: "unsuspend", userId: target, reason })
          }
        >
          {t.unsuspend}
        </button>
      </div>
      <h3>{t.reports}</h3>
      {data.reports.map((report) => (
        <p key={report.id}>
          {t[report.reason]} · {t[report.status]}
          {report.status === "pending" && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  void action({
                    type: "report",
                    reportId: report.id,
                    status: "dismissed",
                  })
                }
              >
                {t.dismissed}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void action({
                    type: "report",
                    reportId: report.id,
                    status: "actioned",
                  })
                }
              >
                {t.actioned}
              </button>
            </>
          )}
        </p>
      ))}
      <h3>{t.tournament}</h3>
      {data.tournaments.map((item) => (
        <p key={item.id}>
          {item.capacity} · {t[item.phase]} · <span dir="ltr">{item.id}</span>
          <button
            disabled={busy}
            onClick={() =>
              void action({
                type: "cancelTournament",
                tournamentId: item.id,
                reason,
              })
            }
          >
            {t.cancelTournament}
          </button>
        </p>
      ))}
      <h3>{t.ledger}</h3>
      <ul>
        {data.ledger.map((entry, i) => (
          <li key={i}>
            {t[entry.kind]} · {entry.delta}
          </li>
        ))}
      </ul>
      <h3>{t.audit}</h3>
      <ul>
        {data.audit.map((entry, i) => (
          <li key={i}>
            {entry.action === "report" ? t.report : t[entry.action]}
          </li>
        ))}
      </ul>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
