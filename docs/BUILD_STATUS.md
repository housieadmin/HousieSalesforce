# Build status and release gate

This project is being delivered in small, reviewable vertical slices. The current feature branch adds the first human ticket-purchase/withdrawal slice on top of the merged board-management implementation. Validation and deployment are driven by the repository GitHub Actions pipeline. The callout-ordering correction is on `fix/insert-immediate-transaction-boundaries`; PR validation is pending. No runtime fix is claimed until the changed Apex is deployed and the account/ticket flows are exercised in the Developer Edition.

## Implemented

- Salesforce DX project layout, package manifest, deploy/bootstrap scripts and Apex test runner.
- Housie account object, infrastructure-only operation lock and Big Object metadata for the 15 logical entities plus the technical operation journal.
- Apex Big Object persistence, operation journal and fail-closed committed-record reads. The Big Object persistence transaction is strictly read-only before `Database.insertImmediate()`; it must not acquire DML row locks or perform ordinary DML.
- Account creation through flat Apex parameters (rather than an Aura-exposed inner-class argument), with a pending-setup state and four immutable signup grant ledger records written in a separate Apex request before a DML-only activation request.
- Route-context lookup by opaque account key.
- Board lifecycle:
  - create a board with a game configuration snapshot and initial WAITING game;
  - create the owner's BOARD_ADMIN membership;
  - list a user's active board memberships;
  - join private boards using the board ID invitation token;
  - list/search public boards and join them;
  - leave only when the latest committed participant state and bot contribution state allow it.
- Durable ticket-command outbox using a DML-only preparation request, a Big Object-only persistence request and a DML-only completion request. Prepared commands remain visible and retryable if persistence or completion is interrupted.
- Persistent per-game command gate acquired in the DML-only preparation request, verified by read-only SOQL during Big Object persistence, and released in the DML-only completion request. The persistence request does not issue `FOR UPDATE`.
- Withdrawal holds points reserved until committed Big Object hold releases and the DML-only completion step; only then are reserved points returned to the available balance.
- Human ticket purchase while the current game is WAITING:
  - server-generated 90-ball ticket layouts satisfying the existing layout validator;
  - no identical layouts within the game's current human-ticket set;
  - one or two human tickets per account according to the game snapshot;
  - manual or automatic mode selection;
  - fee reservation against available account points using append-only wallet-hold state;
  - immutable account resource transactions for the point hold and automatic-token spend;
  - automatic-mode token consumed only for an automatic ticket and only as part of the committed purchase;
  - one distinct Game_Participant state for each participating account;
  - initial game-admin assignment event when the first eligible human participant purchases a ticket.
- Purchase request IDs derive stable ticket/hold IDs so a client retry of the same request does not reserve points twice.
- The owning account can list its own current human tickets and view layouts.
- WAITING-game withdrawal for human-ticket owners, using the same DML prepare / Big Object persist / DML complete sequence:
  - voids their active tickets through append-only withdrawal events;
  - appends RELEASED wallet-hold versions and immutable HOLD_RELEASE ledger transactions;
  - returns reserved points to available balance;
  - appends a withdrawn participant state;
  - allows board leave after the participant withdrawal is committed.
- Board Hub UI for ticket mode selection, purchase, ticket preview and pre-start withdrawal.
- Developer domain tests now also generate and validate 30 random ticket layouts per test run.

## Not yet implemented

- Game start approval flow and capture of active holds into the Game Wallet. Until this exists, there is no playable game start or ticket-fee capture.
- Bot offer creation, equal-share revision acceptance, bot contribution holds, and cancellation/release of all bot offers when a WAITING-game participant withdraws. Current withdrawal handles human ticket holds only.
- Automatic marking and automatic claims. AUTOMATIC currently means mode selection plus token consumption; it does not yet auto-play.
- Manual marking, number-call engine, admin presence/rotation beyond initial assignment, pause/recovery, claims, category closure, disqualification, payouts and settlement.
- Account authentication/session lifecycle, secure URL token expiry/revocation and replay controls. The account key is currently a bearer secret. Do not expose it in rendered UI or grant broad guest read access.
- Complete Experience Cloud site/ExperienceBundle, page routing, guest profile and sharing configuration; these are org-specific.
- Paging beyond the current 200-board directory/membership query limits.
- Durable repair worker for PENDING operation journals.
- Integration, security, concurrency and load testing in the target Developer Org.

Do not describe the product as end-to-end playable, and do not process production points until start/capture, bot cancellation, settlement and the security controls are implemented and verified.

## Validation status

- Source and metadata have been reviewed statically in this feature branch.
- HousieDomainRulesTest contains helper tests and a generated-ticket layout test.
- The repository GitHub Actions PR workflow validates Salesforce metadata and runs local Apex tests, but its test command runs against the already-deployed org version after a dry-run; it does not execute the candidate code in the org. This branch's pipeline result is pending. Runtime verification requires the AI iteration deploy workflow or controlled deployment workflow, followed by UI/API testing.
- Run the PR validation workflow before merge. After merge, the main-branch workflow deploys the wildcard manifest to the Developer Edition and runs local Apex tests.

## Consistency note

Big Object writes are non-transactional and Database.insertImmediate() can leave physical records behind after a partial operation. The Big Object writer does not acquire the DML infrastructure row lock; it writes a COMMITTED journal marker last. Ticket purchase/withdrawal is serialized by its per-game command gate. Other command paths still need explicit durable gates or equivalent idempotent concurrency controls before high-contention production use. Application reads reject records belonging to non-committed operation IDs. This provides fail-closed application visibility, not native rollback or multi-record atomicity.
