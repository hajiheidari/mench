# Dice and online delivery review — 2026-10-10

The actual web Practice randomDie function was read from source and executed 100,000 times with real crypto.getRandomValues (no mocked RNG). Results:

{
"rolls": 100000,
"counts": [
16704,
16761,
16578,
16601,
16594,
16762
],
"sixPercent": 16.762,
"longestSixStreak": 6,
"streaksReachingThreeSixes": 410,
"chiSquare": 2.21012
}

Both native human/bot paths use expo-crypto.getRandomBytes and reject bytes >=252, matching the web sampling algorithm. There are exactly 42 accepted byte values per die face. Bot difficulty changes move choice only. No local dice weighting, streak suppression or probability adjustment was found. Server uses contextual HMAC and the same rejection threshold. The statistical sample is a diagnostic, not evidence of the specific reported game or proof of operator honesty. Raw sampled streaks are distinct from a player's game turn: the default engine forfeits the turn on the third consecutive six. Existing engine/fair-dice suites passed all 31 cases; online browser invite/start/proof/reload acceptance passed.

Current delivered standalone mench-classic-colors.html bundles Practice only; it has no online mode. Full web source has Online and guest room creation, invite URLs /join/CODE, join by code and host start after the chosen capacity is connected. Android has the same create/join flow but defaults to http://127.0.0.1:3001 without EXPO_PUBLIC_API_URL, which is the phone itself, not an Internet service. Its settings allow a shared backend URL. No public backend/site or publicly usable invite URL was provisioned by this work. Prior browser/native-Web protocol tests used a locally running test backend, not public deployment.

After an Internet backend and full web site are configured, the friend flow is: create a 2-player room; share the web invite or room code; friend joins using the same backend; host starts. Android uses the shared backend settings and room code. Random matchmaking additionally needs another connected waiting player. Anonymous casual private rooms do not require an account; ranked does. Publication/hosting and choosing its infrastructure remain separate work.
