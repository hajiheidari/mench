CREATE TABLE tournaments (
 id uuid PRIMARY KEY,
 owner uuid REFERENCES users(id) ON DELETE SET NULL,
 snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tournament_members ON tournaments USING gin((snapshot->'players'));
CREATE TABLE tournament_games (
 game_id uuid PRIMARY KEY,
 tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
 match_id text NOT NULL,
 room_code text REFERENCES room_snapshots(code) ON DELETE SET NULL,
 UNIQUE(tournament_id,match_id)
);
