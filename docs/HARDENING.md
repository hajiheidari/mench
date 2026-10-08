# Local hardening evidence and remaining release work

This is verified local development evidence, not approval for public production or stores. See PROJECT_STATUS.md for current checks and KNOWN_ISSUES.md for unresolved release requirements.

## Replay and bounded traffic

Public room snapshots and durable checkpoint JSON carry the last 16 revealed proofs and an offset. PostgreSQL stores each roll once in the event log; recovery reconstructs the full history in a consistent repeatable-read transaction and rejects gaps. In-memory history remains full for the current match. Snapshots/events expire 24 hours after room creation, including startup pruning. Completed results independently retain the full replay, so their transcript survives room expiration.

New completed games store initial state, actions, final state and revealed proofs only after deterministic replay matches the final state. Connection changes, including restart transitions, belong in that replay. Older results or incomplete legacy event histories return REPLAY_UNAVAILABLE rather than invented actions. GET /api/history lists the authenticated participant's last 50 completed games; /api/history/:id returns only their transcript. Neither endpoint exposes account IDs, token hashes or pending seeds. Guests have live proof verification but no persistent account history.

Web and Expo share the archive consistency verifier. It checks actions, proof values, roll order, player and committed engine version. Connection-only changes retain the pending commitment's original version. An archive cannot establish that a commitment was published before a nonce: live witnesses must retain their observed commitment and original nonce. The UI states this limitation. Browser export contains revealed proof material only.

## Reproduce measurements

Run from the repository root after npm ci and starting the development PostgreSQL container:

```sh
node --import tsx scripts/dice-simulation.ts
node --import tsx scripts/load.ts
node --import tsx scripts/backup-check.ts
```

DICE_SIMULATION.json records one million reproducible simulated rolls, verification of every proof, counts and chi-square. Simulation seeds are deterministic fixtures only; production still uses crypto.randomBytes. Distribution is not a proof against server seed selection, aborts or equivocation.

LOAD_REPORT.json records 100/500/1000 real Socket.IO guest connections, paired two-player games and four rolls each. All clients remain connected during the sample; 50 match command sequences run concurrently. Each level uses a separately created local database and an IPC-announced ephemeral API port, then closes its own clients/server/database. The source API process's Linux RSS, CPU time, end-to-end acknowledgement percentiles and simple PostgreSQL SELECT 1 probe latency are measured. Database probes measure local round trips, not full transaction latency. Acknowledgements include authoritative transitions, persistence and scheduling. Zero observed errors is short-run stability evidence; it does not cover long games, Internet latency, carrier NAT, account/social traffic, abuse or sustained capacity. The serialized actor and full in-memory history remain scaling limits. No 5000-player capacity claim.

## Readiness, recovery and operations

/health/live reports the running HTTP process. /health checks database reachability and frozen actor/pool state; unhealthy returns 503. Idle PostgreSQL pool errors are handled without dumping private connection objects and fail readiness closed. An ambiguous persistence failure freezes gameplay until restart. Durable writes precede acknowledgements and broadcasts. Registered sockets enforce session expiry and revocation; guests cannot resume registered capabilities. Admission defaults to at most 5000 live/authorizing game transports; rooms, queued players, pending commands, request caches, message sizes and per-socket commands also have bounds.

Fastify emits structured request/response timing; room events include command category, room and engine version. Passwords/cookies/Authorization are redacted and no pending seed or raw capability is logged. Private logs still need access controls and a defined retention policy. Monitor readiness failures, actor failures, command latency, PostgreSQL capacity/locks, disk and backup age. External alert delivery, dashboards and paging have not been configured.

BACKUP_REPORT.json documents a custom-format PostgreSQL dump restored into a temporary local database: all 19 table counts/content digests matched and wallet balances reconciled against append-only receipts. The private archive is outside Git under /workspace/mench-backups with restrictive permissions; it contains sensitive identity/session/pending-seed data. This directory is not offsite protection. Before launch, choose encrypted offsite storage, a retention policy, RPO/RTO, scheduled backups/PITR and a restore owner. Repeat restoration against an isolated target. Never restore over a live database for verification.

## Deployment preparation

compose.production.yaml and infra/Dockerfile.production prepare one API instance and a built static web shell behind nginx HTTPS/WebSocket proxy. The API runs as UID1000 with a read-only filesystem, dropped capabilities and readiness healthcheck. Database URL/TLS files are mounted as secrets, not embedded in images or arguments. The real domain and private files are mandatory; no production defaults are invented.

Supply MENCH_DOMAIN (hostname only), MENCH_DATABASE_URL_FILE, MENCH_TLS_CERTIFICATE_FILE and MENCH_TLS_KEY_FILE in a private deployment environment. The URL file must be readable by container UID1000, e.g. owner1000/mode0400; TLS private key stays restricted. ALLOWED_ORIGINS derives from the HTTPS domain. ADMIN_USER_IDS is optional and empty disables staff access. Use dedicated database credentials, TLS to remote PostgreSQL, restricted networking and a reviewed migration/runtime role strategy. The API currently migrates on startup, so its database role needs migration privileges; splitting these credentials is release work.

Local image builds and a loopback-only rehearsal verified the nonroot API, readiness, built shell, valid TLS trust, private-route denial and a real WebSocket create/leave through nginx. The rehearsal used a temporary locally trusted certificate, without disabling verification, and stopped its own containers. It did not configure a public domain, externally trusted certificate, production database or deploy a service. The API template requires single ownership; do not scale replicas against the same room snapshots. Docker restart policy does not restart merely unhealthy processes: alert and controlled recovery are still required.
