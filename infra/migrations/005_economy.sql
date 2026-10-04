CREATE TABLE cosmetics (
 sku text PRIMARY KEY, price integer NOT NULL CHECK(price>0)
);
INSERT INTO cosmetics(sku,price) VALUES ('aurora',60),('sunset',80);
CREATE TABLE wallets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
 balance bigint NOT NULL DEFAULT 0 CHECK(balance>=0),
 active_sku text REFERENCES cosmetics(sku),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE wallet_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 wallet_id uuid NOT NULL REFERENCES wallets(id),
 reference text UNIQUE NOT NULL,
 kind text NOT NULL CHECK(kind IN ('reward','purchase')),
 delta bigint NOT NULL CHECK(delta<>0),
 metadata jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='reward' AND delta>0) OR (kind='purchase' AND delta<0))
);
CREATE INDEX wallet_history ON wallet_ledger(wallet_id,created_at);
CREATE TABLE owned_cosmetics (
 wallet_id uuid NOT NULL REFERENCES wallets(id),
 sku text NOT NULL REFERENCES cosmetics(sku),
 PRIMARY KEY(wallet_id,sku)
);
CREATE FUNCTION forbid_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'LEDGER_IMMUTABLE'; END $$;
CREATE TRIGGER ledger_immutable BEFORE UPDATE OR DELETE ON wallet_ledger FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();
