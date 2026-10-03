# Security

M0 has no authentication, user persistence, purchases or multiplayer command handling. Public health response contains no account data. API limits body size; structured logs redact Authorization/Cookie. Bind Docker ports to loopback; database password is explicitly local-only. Never commit real .env files.

Before M4: runtime schemas, origin policy, authentication/authorization, idempotency, rate limits and replay defense. Before M2: document commitment timing, context binding, seed selection/abort attacks, client entropy and rejection sampling. Commit/reveal alone is not proof of unbiased server choice. Payment metadata must never enter RNG.

Before production: dependency and secret scanning, account deletion, moderation/report/block, ledger atomicity, backups and incident procedures. M0 is not production-ready. No proprietary assets are used.

Dependency audit executed: 23 findings (16 high / 7 moderate) remain in native tooling; see KNOWN_ISSUES.md. TLS verification was retained for npm and Docker builds. No production release is authorized by M0.
