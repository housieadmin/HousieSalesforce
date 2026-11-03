# Requirements traceability

**Baseline:** `docs/SPEC.md` v1.0 and `docs/DATA_MODEL.md` v1.0, reviewed against `main` at `5637e00fd0461ecc02f89c3db7b74d2407ee4ea9`.

This is a high-level traceability index, not a substitute for the detailed requirement text. Section references point to `docs/SPEC.md`.

| Spec area | Requirement group | Data model support | Implementation status | Main gap / verification note |
|---|---|---|---|---|
| 2.1–2.4 | Accounts, signup awards, global resources | accounts, account_resource_transactions | Partial | Setup/grants exist; authentication/session and complete resource lifecycle missing. |
| 2.3 | Public/private boards, membership and leave rules | boards, board_members, games, game_participants, bot_contributions | Partial | Main board membership flows exist; leave safety must cover complete bot contribution lifecycle. |
| 3 | Platform, board and game roles/permissions | accounts, board_members, game_participants, audit_records | Partial | Permission sets exist; full inheritance, scoped enforcement and secure sessions need work. |
| 4 | Templates, board configuration and immutable game snapshots | boards, games.config_snapshot | Partial | Snapshot concept exists; full template lifecycle and all setting semantics not established. |
| 5.1–5.7 | Game states, automatic creation/start, admin availability, approvals, pause/recovery, completion | games, game_participants, game_events, game_action_requests, game_action_responses | Not implemented / partial | Initial admin assignment exists; lifecycle orchestration and approval execution absent. |
| 6 | Ticket generation, ownership, modes, flips and fixes | tickets, game_events, account_resource_transactions | Partial | Human ticket generation/purchase exists; flips/fixes and full game-time behaviour absent. |
| 7 | Bot offers, contributors, equal-share revisions and bot tickets | bot_contributions, tickets, game_events, wallet_holds | Not implemented | Schema only; acceptance, funding, withdrawal cancellation and payout lifecycle absent. |
| 8 | Number calls, manual/automatic marking and gameplay | game_events, tickets | Not implemented | No functional number-call or marking engine found. |
| 9 | Wallet holds, Game Wallet, prize obligations, settlement/refunds | wallet_holds, account_resource_transactions, game_ledger | Partial / not implemented | Pre-game human holds exist; start capture, Game Wallet accounting and settlement absent. |
| 10 | Claims, validation, ordering, category closure and disqualification | claims, game_events, games.config_snapshot | Not implemented | Schema only; no meaningful claim processing found. |
| 11 | Cancellation request, frozen electorate and voting | game_action_requests, game_action_responses, audit_records | Not implemented | Schema only; voting and settlement behaviour absent. |
| 12 | Chat and visibility/retention | chat_messages | Not implemented | Schema only; no messaging implementation found. |
| 13 | Potential winners and related game presentation | tickets, claims, game_events | Not implemented / unverified | No complete potential-winner calculation/presentation found. |
| 14 | Achievements and leaderboards | No complete dedicated implementation identified | Deferred / not implemented | Product requirements remain unimplemented. |
| Cross-cutting | Idempotency, auditability, fairness, privacy and retention | operation journal, resource transactions, wallet holds, game events, audit records | Partial | Some foundations exist; comprehensive invariants, security and recovery tests remain. |

## How to maintain this matrix

For every feature change:
1. Identify the exact SPEC section(s) affected.
2. Inspect the relevant DATA_MODEL entity and integrity rules.
3. Link the implementation entry point (class, method, LWC or metadata path) in the related implementation/status note or PR.
4. Add/update tests that prove the behaviour and negative cases.
5. State separately whether source tests, deployment and runtime E2E have passed.
6. Update this matrix only when the implementation meaningfully changes.

Never upgrade a row to implemented merely because a field/object, UI control, stub method or event label exists.
