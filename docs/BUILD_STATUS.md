# Build status and release gate

This project is delivered in reviewable vertical slices. The ticket-purchase transaction-order defect and its related lock-order corrections are complete in [PR #24](https://github.com/housieadmin/HousieSalesforce/pull/24). PR validation, targeted Developer Edition deployment and public Experience Cloud purchase regression succeeded; the two-ticket test scenario completed without the pending-uncommitted-work error. See [the recorded evidence](../.project/sessions/2026-11-04-ticket-purchase-transaction-fix-status.md). Do not repeat this verification routinely; reopen it only if a later change causes a regression or a specific evidence gap is identified.

The active next-step roadmap and milestone acceptance criteria are in [`.project/MILESTONES.md`](../.project/MILESTONES.md).

## Implemented

- Salesforce DX project layout, package manifest, deploy/bootstrap scripts and Apex test runner.
- Housie account object, infrastructure-only operation lock and Big Object metadata for the 15 logical entities plus the technical operation journal.
- Apex Big Object persistence, serialized write lock, operation journal and fail-closed committed-record reads.
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
- Persistent per-game command gate held from command preparation until DML completion. This does not depend on a `FOR UPDATE` row lock surviving `insertImmediate`; Salesforce releases Apex `FOR UPDATE` locks when a callout occurs.
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

- PR #24 validation on final source head passed metadata validation and local Apex tests.
- The four transaction-boundary Apex classes were deployed successfully to the Developer Edition.
- Public Experience Cloud purchase regression passed on the dedicated `test-user-3` fixture: two distinct active tickets were created; no pending-uncommitted-work error was observed.
- The fixture cleanup run passed and removed a duplicate scenario-owned board.
- These checks close the agreed ticket-purchase fix milestone. They are not a blanket verification of withdrawal, bot funding, gameplay, settlement, concurrency or security.
- Future milestones should run the tests required by their own acceptance criteria. Do not rerun completed milestone checks without a concrete regression or changed requirement.

## Consistency note

Big Object writes are non-transactional and Database.insertImmediate() can leave physical records behind after a partial operation. Apex serializes business commands through the infrastructure lock and writes a COMMITTED journal marker last. Application reads reject records belonging to non-committed operation IDs. This provides fail-closed application visibility, not native rollback or multi-record atomicity.
