import { useEffect, useRef, useState } from "react";
import { readEconomy, buyCosmetic, equipCosmetic } from "@mench/game-client";
import type { CosmeticSku, EconomySnapshot } from "@mench/game-protocol";
import type { Messages } from "./messages";
export function Wallet({ t }: { t: Messages }) {
  const [data, setData] = useState<EconomySnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const requests = useRef(new Map<CosmeticSku, string>());
  function accept(snapshot: EconomySnapshot) {
    setData(snapshot);
    document.documentElement.dataset.theme = snapshot.active ?? "";
  }
  useEffect(() => {
    void readEconomy()
      .then(accept)
      .catch(() => setNotice(t.error));
  }, [t.error]);
  async function action(sku: CosmeticSku | null, buy = false) {
    setBusy(true);
    setNotice("");
    try {
      if (buy && sku) {
        const id = requests.current.get(sku) ?? crypto.randomUUID();
        requests.current.set(sku, id);
        await buyCosmetic({}, sku, id);
      } else await equipCosmetic({}, sku);
      accept(await readEconomy());
      setNotice(t.done);
    } catch (e) {
      setNotice(
        t.errors[e instanceof Error ? e.message : "REQUEST_FAILED"] ?? t.error,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>{t.wallet}</h2>
      {data && (
        <>
          <p>
            {t.coins}: {data.balance}
          </p>
          <p className="fine">{t.coinHint}</p>
          {data.catalog.map((item) => (
            <p key={item.sku}>
              {t[item.sku]} · {item.price} {t.coins}{" "}
              <button
                disabled={busy || data.active === item.sku}
                onClick={() =>
                  void action(item.sku, !data.owned.includes(item.sku))
                }
              >
                {data.owned.includes(item.sku) ? t.equip : t.buy} ·{" "}
                {t[item.sku]}
              </button>
            </p>
          ))}
          <button
            disabled={busy || !data.active}
            onClick={() => void action(null)}
          >
            {t.plain}
          </button>
          <h3>{t.ledger}</h3>
          <ol>
            {data.ledger.map((entry, i) => (
              <li key={i}>
                {t[entry.kind]} · {entry.delta}
              </li>
            ))}
          </ol>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
