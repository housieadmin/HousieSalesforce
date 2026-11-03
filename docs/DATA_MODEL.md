# Housie v2 — Minimal Initial Logical Schema

**Version:** 1.0  
**Status:** Updated incrementally from the initial minimal model  
**Scope:** Technology-independent logical schema for the initial release. This document defines entities, responsibilities, relationships and integrity rules; it does not prescribe SQL types or a database vendor.

## 1. Design principles

- Keep the initial model small without collapsing records that have independent lifecycle, ownership, audit or settlement requirements.
- Embed compact, game-scoped configuration in `games.config_snapshot`; do not create a category-definition table for repeated static defaults.
- Keep account-level balances on `accounts`, but retain immutable resource transactions and separate active wallet holds.
- Store ticket layout and current marks on `tickets`; do not create per-number or per-marking tables initially.
- Use `game_events` as the ordered authoritative game event stream. Claims, financial transactions and approval responses remain first-class records.
- Notifications are delivery/presentation of open action requests, not a separate source-of-truth table.

## 2. Tables (16)

### 1. `accounts`

One row per human account.

- `id` (PK)
- `profile` — compact profile fields
- `platform_role` — ordinary account or platform super-admin
- `points_balance` — total points not yet captured/spent
- `reserved_points` — portion of points_balance unavailable due to active holds
- `auto_mode_tokens`, `flips`, `fixes` — current consumable balances
- `status`, `created_at`, `updated_at`

`available_points` is derived as `points_balance - reserved_points`; it should not be independently writable. All balances are account-global and shared across boards and games.

### 2. `account_resource_transactions`

Immutable audit trail for account resource changes.

- `id` (PK), `account_id` (FK)
- `resource_type` — POINTS, AUTO_MODE_TOKEN, FLIP, FIX
- `transaction_type` — GRANT, SPEND, HOLD_RESERVE, HOLD_ADJUST, HOLD_RELEASE, HOLD_CAPTURE, REFUND, REWARD, ADJUSTMENT
- `quantity` — signed or direction-qualified amount
- `source_type`, `source_id` — game, ticket, hold, admin grant, etc.
- `idempotency_key`, `created_at`, `metadata`

Every balance mutation and hold transition must have a corresponding immutable transaction. Hold reserve/release/capture and the associated balance updates must be atomic and idempotent.

### 3. `wallet_holds` **(new)**

Tracks points committed to a pre-game purchase or bot contribution but not yet transferred into a Game Wallet.

- `id` (PK), `account_id` (FK), `game_id` (FK)
- `source_type` — HUMAN_TICKET or BOT_CONTRIBUTION
- `source_id` — ticket or contribution record
- `amount` — currently reserved amount
- `status` — ACTIVE, CAPTURED, RELEASED
- `created_at`, `updated_at`, `captured_at`, `released_at`

An active hold increases `accounts.reserved_points` and reduces available points without reducing `points_balance`. Capture decreases both `points_balance` and `reserved_points`; release decreases only `reserved_points`. Holds are not Game Wallet funds. One active hold per source commitment. Use the account transaction ledger to audit every reserve, accepted adjustment, release and capture. A bot-contribution hold may be adjusted only after all affected contributors explicitly accept the revised amounts.

### 4. `boards`

One row per persistent board.

- `id` (PK), `name`, `visibility`, `owner_account_id` (FK)
- `config` — current board-level settings, including fees, limits, prize rules, bot limits, timing and retention
- `current_game_id` (FK, nullable)
- `status`, `created_at`, `updated_at`

### 5. `board_members`

One row per account-board membership.

- `id` (PK), `board_id` (FK), `account_id` (FK)
- `board_role` — MEMBER or BOARD_ADMIN
- `joined_at`, `left_at`, `status`

A member may leave only when they are not actively participating in the board's current game. Active participation means owning at least one paid human ticket or contributing to at least one funded bot offer in that game. A participant must first withdraw from a WAITING game; withdrawal voids their human tickets and cancels every bot offer to which they contributed. After withdrawal completes and no active participation remains, board membership may end. Leaving or disconnecting is not a substitute for game withdrawal. Enforce one current membership per account and board.

### 6. `games`

One row per game instance.

- `id` (PK), `board_id` (FK)
- `status` — WAITING, RUNNING, PAUSED, COMPLETED, CANCELLED
- `config_snapshot` — immutable snapshot of board settings, prize categories and rules, including the confirmed initial defaults (minimum human participants 2; maximum human tickets per account 2; maximum bots 2; number-calling interval 5 seconds; missed-call delay grace 300 seconds; START/PAUSE/RESUME request expiry 60 seconds; cancellation voting window 60 seconds; chat retention 3 days; admin offline grace 90 seconds)
- `current_admin_account_id` (FK, nullable)
- `event_sequence` — latest authoritative event sequence
- `wallet_total`, `wallet_obligations`, `wallet_available` — optional cached projections, never the sole financial source of truth
- `created_at`, `started_at`, `completed_at`, `cancelled_at`

One board has at most one current game. A game snapshots configuration at creation, including while WAITING. At start, ticket layouts/modes and bot funding are frozen and valid holds are captured.

### 7. `game_participants`

One row per distinct human account participating through at least one paid human ticket.

- `id` (PK), `game_id` (FK), `account_id` (FK)
- `join_sequence`, `joined_at`, `withdrawn_at`, `status` — status distinguishes active from withdrawn participation

Unique `(game_id, account_id)`. Bot-only contributors are not human game participants for minimum participation or ordinary start/pause/resume participant approval, but can be cancellation voters under the product rules.

### 8. `tickets`

One row per human or bot ticket. Stores layout and current marking state together.

- `id` (PK), `game_id` (FK)
- `ticket_kind` — HUMAN or BOT
- `owner_account_id` (FK, nullable; required for HUMAN, null for BOT)
- `mode` — MANUAL or AUTOMATIC for human tickets; BOT tickets are automated
- `layout` — structured 3×9 ticket layout
- `marked_numbers` — compact set/bitset of marked numbers
- `status` — ACTIVE, DISQUALIFIED, WITHDRAWN, etc.
- `entry_fee`, `wallet_hold_id` (FK, nullable)
- `bot_proposer_account_id` (FK, nullable)
- `created_at`, `purchased_at`, `withdrawn_at`

Ticket layout and marking state do not need separate child tables initially. Human ticket purchase creates a hold; withdrawal while WAITING voids all of that account's human tickets in the game and releases their holds. After start, withdrawal is prohibited and ownership/settlement rights persist regardless of disconnect. A participant must withdraw before leaving the board.

### 9. `bot_contributions`

One row per contributor per bot offer/ticket.

- `id` (PK), `game_id` (FK), `ticket_id` (FK to bot ticket/offer)
- `contributor_account_id` (FK)
- `accepted_sequence`, `created_at`, `accepted_at`
- `accepted_amount`, `accepted_revision` — amount and offer revision explicitly accepted by this contributor
- `proposed_amount`, `proposed_revision` — pending revised amount/revision awaiting explicit acceptance; nullable
- `current_hold_amount`, `wallet_hold_id` (FK)
- `final_share`, `captured_amount`, `refund_amount`
- `status` — PENDING_ACCEPTANCE, ACCEPTED, PENDING_RECONFIRMATION, DECLINED, CANCELLED, CAPTURED, RELEASED

The proposer is the first contributor. A new contributor may trigger a proposed equal-share revision, but existing accepted amounts and holds must never be silently changed. Every affected contributor must explicitly accept the proposed revision before it becomes effective and holds are adjusted. Until all required acceptances are received, the prior accepted amounts and holds remain unchanged. A declined revision is rejected and the offer returns to its previous accepted state; an unaccepted new contributor is not added. If a revision remains pending at game start, it is discarded and the offer converts only if the previously accepted commitments exactly cover the ticket price. If any contributor withdraws from the WAITING game, the entire bot offer is cancelled and all contributor holds are released; remaining contributors are not forced to absorb a larger share or continue the offer. At start, final accepted shares are frozen and holds captured. Bot payout distribution uses final shares. Offer revisions and accept/decline decisions are also recorded in `game_events` so the acceptance history remains auditable.

### 10. `game_events`

Append-only, ordered event stream for authoritative game progression.

- `id` (PK), `game_id` (FK), `sequence`
- `event_type`, `actor_account_id` (FK, nullable)
- `payload`, `created_at`

Includes number calls, state changes, admin rotation, ticket/offer lifecycle events, category closure and other ordered game events. Unique `(game_id, sequence)`. This replaces a separate number-calls table initially.

### 11. `claims`

One row per submitted or automatically generated category claim.

- `id` (PK), `game_id` (FK), `ticket_id` (FK)
- `category_key` — references category definition in immutable game config snapshot
- `claimant_account_id` (FK, nullable for bot/system claims)
- `call_sequence`, `claim_sequence`
- `validation_status`, `claim_status`, `rejection_reason`
- `award_amount`, `created_at`, `resolved_at`

Claims are first-class because validation, disqualification, category closure and award settlement require independent durable records. The ordered event stream determines claim/draw ordering.

### 12. `game_action_requests`

One row per requested START, PAUSE, RESUME or CANCEL action.

- `id` (PK), `game_id` (FK)
- `action_type`, `requester_account_id` (FK)
- `required_approval_rules` — e.g. one eligible admin plus a different non-admin participant
- `expected_game_state`, `status` — OPEN, APPROVED, REJECTED, EXPIRED, EXECUTED
- `created_at`, `expires_at`, `closed_at`, `executed_at`

An open request is the broadcast notification source for eligible reviewers. Notifications may be delivered through in-app, push or other channels, but no separate notification table is required initially. START, PAUSE and RESUME requests expire after 60 seconds by default; the CANCEL vote has its own 60-second voting window. Close the request atomically once the threshold is met, approval becomes impossible, or its deadline passes; execute the action exactly once after revalidating state.

### 13. `game_action_responses` **(renamed/reworked)**

Stores actual responses to action requests and frozen cancellation electorate entries.

- `id` (PK), `request_id` (FK), `account_id` (FK)
- `response` — APPROVE, REJECT, or NULL (no response yet; cancellation electorate only)
- `eligibility_role` / `eligibility_snapshot` — role basis at response or electorate freeze
- `responded_at`, `created_at`

Unique `(request_id, account_id)`. For START/PAUSE/RESUME, create a row only when an eligible account responds; do not pre-create rows for every eligible reviewer. The requester is automatically recorded as APPROVE for their own qualifying role category, consistent with the product rule that a requester can count for their own role category. For CANCEL, create one row for every eligible voter when the 60-second vote begins to freeze the electorate; non-response remains NULL and counts in the denominator. If the cancellation requester is eligible, create their row as APPROVE immediately. One account receives one vote.

### 14. `game_ledger`

Immutable game-level accounting entries for captured funds, obligations and settlement.

- `id` (PK), `game_id` (FK)
- `entry_type` — HUMAN_TICKET_CAPTURE, BOT_CONTRIBUTION_CAPTURE, PRIZE_AWARD, BOT_PAYOUT, REFUND, UNAWARDED_ALLOCATION, CANCELLATION_REFUND, ADJUSTMENT
- `amount`, `account_id` (FK, nullable), `ticket_id` (FK, nullable), `source_type`, `source_id`
- `idempotency_key`, `created_at`, `metadata`

Only captured funds enter the Game Wallet. Pre-start wallet holds and their adjustments/releases do not create Game Wallet entries. Track outstanding liabilities separately from available prize pool. All settlement entries must reconcile and be idempotent.

### 15. `chat_messages`

One row per board or game chat message.

- `id` (PK), `scope_type` (BOARD or GAME), `scope_id`
- `sender_account_id` (FK), `message`, `created_at`

Retention follows board/game chat configuration. Game chat visibility begins from the account's game join time as defined by product rules.

### 16. `audit_records`

Durable audit trail for privileged or sensitive actions not adequately represented by domain events/ledgers.

- `id` (PK), `actor_account_id` (FK, nullable)
- `scope_type`, `scope_id`, `action`, `before_state`, `after_state`, `reason`, `created_at`

Do not duplicate every ordinary game event or ledger entry here. Use for administrative changes, overrides, grants and other security-relevant actions.

## 3. Core relationships

- `accounts` 1—N `account_resource_transactions`
- `accounts` 1—N `wallet_holds`; `games` 1—N `wallet_holds`
- `boards` 1—N `board_members`; `boards` 1—N `games`
- `games` 1—N `game_participants`, `tickets`, `bot_contributions`, `game_events`, `claims`, `game_action_requests`, `game_ledger`, `chat_messages`
- `tickets` 1—N `bot_contributions` for BOT offers/tickets; HUMAN tickets have an owner account
- `game_action_requests` 1—N `game_action_responses`

## 4. Required integrity rules

1. Available points (`points_balance - reserved_points`) must never be negative.
2. Hold creation, adjustment, release and capture must update account balances and append account resource transactions atomically.
3. A hold can transition from ACTIVE to exactly one terminal state: CAPTURED or RELEASED. Repeated requests must be idempotent.
4. A pre-start withdrawal must void all of the account's human tickets in that game and release their ticket holds. Every bot offer to which the account contributed, whether as proposer or non-proposer, must be cancelled and all contributor holds for each such offer released. Apply all changes atomically.
5. Board membership cannot be ended while the account owns a paid human ticket or has an active contribution in the current game. A WAITING-game withdrawal must happen first. Disconnect is not withdrawal.
6. Once a game starts, holds are captured, tickets and accepted contribution shares freeze, and participant withdrawal is no longer allowed.
7. Existing bot contributors' accepted amounts must not change silently when a new contributor joins. A revised equal split requires explicit acceptance from every affected contributor before any hold adjustment. A withdrawal by any contributor cancels the whole offer and releases all holds.
8. Only captured money appears in `game_ledger` and the Game Wallet. Holds are not prize-pool funds.
9. Every human must own at least one paid human ticket to count as a human participant. Bot-only contributors may vote in cancellation but do not count toward minimum participation.
10. One account can have at most one participant row and one cancellation vote per game/request.
11. For ordinary START/PAUSE/RESUME, collect only actual reviewer responses; the requester may count as approval for their own role category. One account cannot satisfy both distinct approval roles.
12. For CANCEL, freeze all eligible voters at vote creation. The eligible initiator is automatically APPROVE. Approval threshold is at least 50% of the frozen electorate; NULL/non-responses remain in the denominator.
13. Action execution must be atomic, state-checked and exactly-once. Notifications are not authoritative approval records.
14. Game configuration and category definitions are immutable snapshots after game creation.
15. Claims, official call ordering, game ledger entries and completed/cancelled outcomes remain auditable and cannot be silently rewritten.

## 5. Explicitly not separate tables in the initial version

- Account roles: global platform role on `accounts`; board role on `board_members`; current game admin on `games` plus `game_events` history.
- Account resources: balances on `accounts`; immutable movements in `account_resource_transactions`; temporary commitments in `wallet_holds`.
- Ticket numbers and markings: structured fields on `tickets`.
- Game categories: embedded in `games.config_snapshot`; category runtime state derived from claims/events or cached projections.
- Number calls: ordered `game_events`.
- Notifications: derived from open `game_action_requests` and delivered via notification channels without a separate source-of-truth table.

## 6. Deferred extensions

Add only when requirements justify them: achievements, leaderboard snapshots, category-state projections, number-call projections, per-mark event history, membership history, notification inbox/outbox, sessions/devices, reusable templates, moderation records and richer analytics.

## 7. Confirmed product defaults and rules

The following values are the initial board defaults and are included in each game's immutable configuration snapshot. Boards may override configurable values where permitted.

| Setting | Initial default |
|---|---:|
| Minimum distinct human participants | 2 |
| Maximum human tickets per account per game | 2 |
| Maximum bot tickets per game | 2 |
| Number-calling interval | 5 seconds |
| Missed number-call delay grace | 300 seconds (5 minutes) |
| START / PAUSE / RESUME action-request expiry | 60 seconds |
| Cancellation voting window | 60 seconds |
| Board/game chat retention | 3 days |
| Admin offline grace | 90 seconds |

Bot contribution rounding is confirmed: calculate shares to two decimal places, then allocate residual 0.01-point units in contributor acceptance order. Use account ID as a deterministic tie-breaker if acceptance sequence is identical.

No product-policy questions from the previous initial-defaults list remain open. Database-specific implementation details (numeric precision, transaction isolation, uniqueness constraints and event payload schemas) belong in the database-ready design, not this logical model.

**End of Minimal Initial Logical Schema — Version 1.0**
