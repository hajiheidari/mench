CREATE TABLE friendships (
 requester uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipient uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 accepted boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(requester,recipient), CHECK(requester<>recipient)
);
CREATE UNIQUE INDEX friendship_pair ON friendships(LEAST(requester,recipient),GREATEST(requester,recipient));
CREATE TABLE user_blocks (
 blocker uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 blocked uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(blocker,blocked), CHECK(blocker<>blocked)
);
CREATE TABLE user_reports (
 id uuid PRIMARY KEY, reporter uuid REFERENCES users(id) ON DELETE SET NULL,
 subject uuid REFERENCES users(id) ON DELETE SET NULL,
 reason text NOT NULL CHECK(reason IN ('abuse','cheating','spam')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_rate ON user_reports(reporter,created_at);
CREATE TABLE recent_opponents (
 player uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 opponent uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 played_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(player,opponent), CHECK(player<>opponent)
);
CREATE TABLE friend_invites (
 sender uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipient uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 room_code text NOT NULL REFERENCES room_snapshots(code) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour',
 PRIMARY KEY(sender,recipient,room_code), CHECK(sender<>recipient)
);
