import { useEffect, useState } from "react";
import type { Messages } from "./messages";
import { Social } from "./Social";
import { Rankings } from "./Rankings";
import { Wallet } from "./Wallet";
import { Tournaments } from "./Tournaments";
import { Admin } from "./Admin";
interface Profile {
  id: string;
  name: string;
  email: string;
}
export function Account({ t }: { t: Messages }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch("/api/me")
      .then(async (r) => {
        if (r.ok) setUser((await r.json()) as Profile);
      })
      .catch(() => setNotice(t.error));
  }, [t.error]);
  async function action(kind: "register" | "login" | "logout" | "delete") {
    setBusy(true);
    setNotice("");
    try {
      const url = kind === "delete" ? "/api/me" : `/api/auth/${kind}`;
      const body =
        kind === "register"
          ? { email, password, name }
          : kind === "login"
            ? { email, password }
            : kind === "delete"
              ? { password }
              : {};
      const response = await fetch(url, {
        method: kind === "delete" ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const problem = (await response.json()) as { error?: string };
        setNotice(t.errors[problem.error ?? "REQUEST_FAILED"] ?? t.error);
        return;
      }
      if (kind === "login") {
        const profile = await fetch("/api/me");
        setUser((await profile.json()) as Profile);
        setPassword("");
      } else if (kind === "logout" || kind === "delete") {
        document.documentElement.dataset.theme = "";
        setUser(null);
        setPassword("");
      } else setNotice(t.registered);
    } catch {
      setNotice(t.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="lobby">
      <div className="panel">
        <h2>{user ? t.account : t.signIn}</h2>
        {user ? (
          <>
            <p>{user.name}</p>
            <p dir="ltr">{user.email}</p>
            <p>
              {t.accountId}: <span dir="ltr">{user.id}</span>
            </p>
            <Social t={t} />
            <Rankings t={t} />
            <Wallet t={t} />
            <Tournaments t={t} userId={user.id} />
            <Admin t={t} />
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void action("logout")}
            >
              {t.logout}
            </button>
            <label>
              {t.password}
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              className="secondary danger"
              disabled={busy || password.length < 12}
              onClick={() => {
                if (confirm(t.deleteConfirm)) void action("delete");
              }}
            >
              {t.deleteAccount}
            </button>
          </>
        ) : (
          <>
            <label>
              {t.nickname}
              <input
                value={name}
                autoComplete="nickname"
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              {t.email}
              <input
                value={email}
                type="email"
                autoComplete="email"
                maxLength={254}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              {t.password}
              <input
                value={password}
                type="password"
                autoComplete="current-password"
                maxLength={128}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <p className="fine">{t.authHint}</p>
            <div className="actions">
              <button
                className="primary"
                disabled={busy || password.length < 12}
                onClick={() => void action("login")}
              >
                {t.login}
              </button>
              <button
                className="secondary"
                disabled={busy || password.length < 12 || !name}
                onClick={() => void action("register")}
              >
                {t.register}
              </button>
            </div>
          </>
        )}
        {notice && (
          <p className="notification" role="status">
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}
