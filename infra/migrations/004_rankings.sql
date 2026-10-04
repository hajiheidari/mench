CREATE TABLE ratings (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 rating integer NOT NULL DEFAULT 1000,
 games integer NOT NULL DEFAULT 0 CHECK(games>=0),
 wins integer NOT NULL DEFAULT 0 CHECK(wins>=0 AND wins<=games)
);
CREATE TABLE game_results (
 game_id uuid PRIMARY KEY,
 result jsonb NOT NULL,
 rated boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
