# Architecture decisions and invariants

This document records constraints that future implementation work must preserve unless a deliberate, reviewed decision changes them. The detailed current mapping remains in `docs/ARCHITECTURE.md` and `docs/DATA_MODEL_MAPPING.md`.

## AD-001 — Product and logical data sources

- `docs/SPEC.md` is the product behaviour authority.
- `docs/DATA_MODEL.md` is the logical data authority.
- Salesforce implementation details must map to these documents; do not silently redefine product rules to fit the current code.

## AD-002 — Big Objects are not transactional

Big Object writes via `Database.insertImmediate()` are non-transactional. A successful physical write cannot be rolled back as part of a normal Apex transaction. Do not describe the operation journal as providing database atomicity or rollback.

## AD-003 — Operation journal controls application visibility

The implementation uses operation IDs and a journal commit marker. Application reads must expose only records belonging to committed operations. A PENDING journal/partial physical write is not a successful business operation. The journal is a fail-closed visibility/commit protocol, not a transactional rollback mechanism.

## AD-004 — Separate transaction phases

Callout-sensitive workflows must respect Salesforce's uncommitted-work restrictions. Keep DML preparation, Big Object persistence and DML completion in separate request/transaction boundaries where required. Never introduce a callout after uncommitted DML in the same transaction.

## AD-005 — Idempotency is a business invariant

Stable request/record identifiers and idempotency keys must prevent retries from duplicating tickets, holds, ledger entries, claims or settlement. Retry behaviour must be tested, not assumed.

## AD-006 — Wallet integrity

- Account balances are projections backed by immutable resource transactions.
- Available points are derived from total points less reserved points.
- Active holds reduce available points without becoming Game Wallet funds.
- Only captured funds enter the Game Wallet.
- Hold reserve/adjust/release/capture and corresponding balance/ledger changes must be atomic within their supported transaction boundary and idempotent.
- Never silently change accepted bot-contribution shares.

## AD-007 — Game configuration is snapshotted

A game uses an immutable snapshot of board/template settings from game creation. Later board/template changes must not silently alter an existing game.

## AD-008 — Ticket ownership and bot funding are distinct

Human ticket ownership and bot-ticket contribution/funding have different actors, wallet rules and payout allocation. Do not collapse them into a single owner model.

## AD-009 — Ordered game history

The game event stream is append-only and ordered per game. Claims, action responses, financial ledger entries and audit records retain their independent lifecycle where required by the logical model.

## AD-010 — A schema is not a feature

A Big Object definition or field does not implement its lifecycle. A placeholder service that only writes an audit/event record does not implement game behaviour. A selected automatic mode does not implement automatic marking.

## AD-011 — Runtime verification is separate from CI

Compilation, Apex unit tests, PR validation, deployment and browser smoke tests prove different things. Record the exact deployed commit, scenario, assertions and outcome before calling a user journey verified.

## AD-012 — Public account identity requires real session security

The documented opaque account key is a bearer secret and is not sufficient public authentication by itself. Public account-specific operations require authenticated session/invitation controls, expiry, revocation, replay protection and rate limiting.

## Change control

A change to these invariants must include:
- The reason and affected SPEC/DATA_MODEL sections.
- Alternatives considered and consequences.
- Migration/compatibility impact.
- Tests and rollout/repair strategy.
- An explicit decision record in `.project/decisions/` (create the directory when the first decision is approved).
