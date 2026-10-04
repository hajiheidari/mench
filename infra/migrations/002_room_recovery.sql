CREATE TABLE room_snapshots (
 code text PRIMARY KEY, snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE room_events (
 id bigserial PRIMARY KEY, room_code text NOT NULL REFERENCES room_snapshots(code) ON DELETE CASCADE,
 request_id uuid NOT NULL, kind text NOT NULL, data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(room_code,request_id)
);
