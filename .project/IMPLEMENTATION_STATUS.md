# Implementation status

**Snapshot:** `main` at `5637e00fd0461ecc02f89c3db7b74d2407ee4ea9` (2026-11-03)  
**Method:** Static source and metadata review plus limited GitHub Actions evidence. Runtime status is only claimed where explicitly evidenced.

## Status definitions

- **Implemented (source):** meaningful production-path behaviour exists in source.
- **Partial:** some behaviour exists, but material requirements or lifecycle stages are missing.
- **Not implemented:** no meaningful implementation was found; schema/placeholder code does not count.
- **Runtime verified:** successful test or deployed-org scenario proves the specific behaviour. Always name the evidence.
- **Not runtime verified:** source exists but a representative deployed-org test has not established behaviour.

## Feature status

| Area | Status | Evidence / gap |
|---|---|---|
| Account setup and signup grants | Partial | Account creation and signup resource grant flow exist. Authentication/session lifecycle and public security controls are incomplete. |
| Account wallet projection and resource ledger | Partial | Account balances, holds and resource transaction records exist for the current purchase/withdrawal slice. Full resource lifecycle and settlement are incomplete. |
| Roles and permissions | Partial | Permission sets and Apex access controls exist. Full role hierarchy, participant-scoped security and session enforcement are incomplete. |
| Boards and membership | Implemented in source | Create board/current WAITING game, owner membership, private join, public directory/join, membership listing and leave checks exist. Broad runtime/concurrency coverage is not established. |
| Templates and game configuration | Partial | Configuration snapshot support exists. Full reusable template management and all configuration behaviours need verification/implementation. |
| Game lifecycle | Not implemented | No complete automatic create/start/run/pause/resume/complete/cancel orchestration. |
| Human ticket generation | Implemented in source | Server-side 90-ball layout generation and validation exist. |
| Human ticket purchase | Partial | WAITING-game purchase, point holds, ledger entries and ticket-mode selection exist. Do not treat as end-to-end verified without deployed-org purchase evidence. |
| Human ticket withdrawal | Partial | WAITING-game withdrawal/release path exists for human tickets. Bot offer cancellation/release is absent. |
| Bot offers and bot tickets | Not implemented | Data model exists; offer lifecycle, equal-share acceptance and funding behaviour were not found. |
| Manual marking | Not implemented | No meaningful gameplay marking implementation found. |
| Automatic marking and claims | Not implemented | Automatic mode selection/token consumption is not automatic gameplay. |
| Number-call engine | Not implemented | No durable scheduled number-call engine/recovery implementation found. |
| Claims and prize categories | Not implemented | Schema exists; submission, validation, ordering, disqualification and closure logic absent. |
| Game Wallet and settlement | Not implemented | Logical schema exists; capture, obligations, payout, refund and reconciliation lifecycle absent. |
| Game admin rotation and availability | Partial | Initial admin assignment on first participant purchase exists; presence, succession, pause and recovery are absent. |
| Start/pause/resume approvals | Not implemented | Request/response schema exists; complete approval and execution workflow not found. |
| Cancellation voting | Not implemented | Schema exists; frozen electorate, vote processing and cancellation settlement absent. |
| Chat/presence | Not implemented | Schema exists; no functional messaging/presence implementation found. |
| Achievements/leaderboards | Deferred / not implemented | No functional implementation found in reviewed source. |
| Audit and fairness | Partial | Operation journal, ledger and selected audit/event records exist. Full administrative audit coverage and game fairness workflows remain incomplete. |
| History and retention | Partial | Append-only records and retention settings are represented; complete retention/archival processing is not established. |
| Repair/recovery | Partial | Pending operation journal pattern exists; durable repair worker was not found. |
| Experience Cloud delivery | Partial | LWC application shell and bundles exist; full site bundle, routing, guest/auth configuration and activation remain org-specific/incomplete. |

## Tests and verification

- One Apex test class was observed: `HousieDomainRulesTest`.
- Tests cover helper/domain rules such as wallet arithmetic, deterministic IDs, equal-share calculations, ticket validation and layout generation.
- No broad service-level tests were found for account creation, board membership, ticket purchase/withdrawal, idempotency under retry, concurrency, claims, game lifecycle or settlement.
- `scripts/run-tests.sh` runs the narrow domain test class.
- Browser-agent framework exists, but scenario success must be interpreted narrowly: inspect which user journey was exercised, which deployed commit was tested, and whether assertions prove product behaviour.
- PR validation, Apex compilation and deployment success are not substitutes for representative runtime verification.

## Release posture

The product is **not end-to-end playable** based on the reviewed source. The missing game lifecycle, gameplay, claim and settlement flows are blockers. Public launch is also blocked by incomplete authentication/session security and Experience Cloud configuration.

Do not process real or production points until wallet capture, game settlement, reconciliation, idempotency and security controls are implemented and verified.
