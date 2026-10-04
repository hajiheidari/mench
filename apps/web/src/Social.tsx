import { useEffect, useState } from "react";
import { readSocial, sendSocial } from "@mench/game-client";
import type { SocialIntent, SocialSnapshot } from "@mench/game-protocol";
import type { Messages } from "./messages";
export function Social({ t }: { t: Messages }) {
  const [snapshot, setSnapshot] = useState<SocialSnapshot | null>(null);
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [reason, setReason] = useState<"abuse" | "cheating" | "spam">("abuse");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const error = (e: unknown) =>
    setNotice(
      t.errors[e instanceof Error ? e.message : "REQUEST_FAILED"] ?? t.error,
    );
  async function refresh() {
    try {
      setSnapshot(await readSocial());
    } catch (e) {
      error(e);
    }
  }
  useEffect(() => {
    void readSocial()
      .then(setSnapshot)
      .catch((e) =>
        setNotice(
          t.errors[e instanceof Error ? e.message : "REQUEST_FAILED"] ??
            t.error,
        ),
      );
  }, [t]);
  async function action(id: string, intent: SocialIntent) {
    setBusy(true);
    setNotice("");
    try {
      await sendSocial({}, id, intent);
      setSnapshot(await readSocial());
      setNotice(t.done);
    } catch (e) {
      error(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>{t.social}</h2>
      <button
        className="secondary"
        disabled={busy}
        onClick={() => void refresh()}
      >
        {t.refresh}
      </button>
      <label>
        {t.accountId}
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          maxLength={36}
          dir="ltr"
        />
      </label>
      <div className="actions">
        <button
          disabled={busy || !target}
          onClick={() => void action(target, { type: "request" })}
        >
          {t.addFriend}
        </button>
        <button
          disabled={busy || !target}
          onClick={() => void action(target, { type: "block" })}
        >
          {t.block}
        </button>
      </div>
      <label>
        {t.report}
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as typeof reason)}
        >
          <option value="abuse">{t.abuse}</option>
          <option value="cheating">{t.cheating}</option>
          <option value="spam">{t.spam}</option>
        </select>
      </label>
      <button
        disabled={busy || !target}
        onClick={() => void action(target, { type: "report", reason })}
      >
        {t.report}
      </button>
      <label>
        {t.code}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={10}
          dir="ltr"
        />
      </label>
      {snapshot?.friends.map((f) => (
        <div key={f.id} className="social-person">
          <strong>{f.name}</strong> ·{" "}
          {f.accepted
            ? f.online
              ? t.connected
              : t.disconnected
            : f.incoming
              ? t.incoming
              : t.outgoing}
          <p>
            <small dir="ltr">{f.id}</small>
          </p>
          <div className="actions">
            {!f.accepted && f.incoming && (
              <button
                disabled={busy}
                onClick={() => void action(f.id, { type: "accept" })}
              >
                {t.acceptFriend}
              </button>
            )}
            {f.accepted && (
              <button
                disabled={busy || code.length !== 10}
                onClick={() => void action(f.id, { type: "invite", code })}
              >
                {t.inviteFriend}
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => void action(f.id, { type: "remove" })}
            >
              {t.removeFriend}
            </button>
            <button
              disabled={busy}
              onClick={() => void action(f.id, { type: "block" })}
            >
              {t.block}
            </button>
          </div>
        </div>
      ))}
      {!!snapshot?.blocks.length && <h3>{t.block}</h3>}
      {snapshot?.blocks.map((p) => (
        <p key={p.id}>
          {p.name}{" "}
          <button
            disabled={busy}
            onClick={() => void action(p.id, { type: "unblock" })}
          >
            {t.unblock}
          </button>
        </p>
      ))}
      <h3>{t.invites}</h3>
      {snapshot?.invites.map((i) => (
        <p key={`${i.id}:${i.code}`}>
          {i.name}{" "}
          <a href={`/join/${i.code}`}>
            {t.join} {i.code}
          </a>
        </p>
      ))}
      <h3>{t.recentOpponents}</h3>
      {snapshot?.recent.map((p) => (
        <p key={p.id}>
          {p.name}{" "}
          <button
            disabled={busy}
            onClick={() => {
              setTarget(p.id);
            }}
          >
            {t.accountId}
          </button>
        </p>
      ))}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
