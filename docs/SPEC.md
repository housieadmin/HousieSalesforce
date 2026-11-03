# Housie — Product Requirements Specification

**Version:** 1.0 
**Status:** Consolidated product requirements  
**Scope:** Product behaviour, game rules, roles, participation, economy, claims, settlement and administration. Technology choices and implementation sequence are excluded.

---

## 1. Product objective

Build an automated multiplayer Housie/Tambola platform where users join persistent boards, participate in games, spend and earn virtual points, compete for prizes, and progress through achievements and leaderboards.

Each board has one current game at a time. Games are created automatically, numbers are called automatically, claims are validated automatically, and games are settled automatically.

Game execution must not depend on a particular player's browser or the original game administrator remaining online.

However, if no eligible game administrator is available, a running game automatically pauses. It resumes only after an eligible administrator is available and the required approvals are obtained.

## 2. Accounts, resources and boards

### 2.1 Accounts

- Users can sign up, log in and maintain a persistent profile.
- Every account has a global points wallet and an inventory of consumables.
- Points, auto-mode tokens, flips and fixes are account-level resources shared across all boards and games.
- Users can participate in multiple boards and concurrent games, provided they have sufficient resources and meet each game's requirements.

### 2.2 Signup awards

Every new account receives:

| Resource | Initial quantity |
|---|---:|
| Points | 100 |
| Auto-mode tokens | 1 |
| Fixes | 1 |
| Flips | 1 |

These are global account-level resources, not board-specific allocations.

### 2.3 Boards

- Boards can be public and searchable or private through an invitation link.
- A user joins a board once and can leave it only when they are not actively participating in the board’s current game.
- Active participation means owning at least one paid human ticket or contributing to at least one funded bot offer in the current game. A user cannot leave the board while either condition is true.
- A participant in a WAITING game must withdraw from that game first. Once the withdrawal and all related ticket/offer releases are complete, the account may leave the board.
- A board has one current game.
- A board has a board owner/admin who manages board settings, membership and board-level administration.
- Board settings include game configuration, ticket fees and limits, minimum participation, prize rules, bot limits, administrator availability and retention policies.

### 2.4 Global resources

- Points are used to purchase human tickets, fund bot tickets and receive prizes or refunds.
- Auto-mode tokens authorize automatic play for individual human tickets.
- Flips replace assigned ticket layouts before game start.
- Fixes synchronize a ticket's markings with official called-number history.
- Consumables are shared across boards and games.
- All grants and spending must be recorded in an auditable inventory history.

## 3. Roles, hierarchy and permissions

### 3.1 Roles

The platform distinguishes:

1. **Platform super-admin:** highest platform-level authority.
2. **Board admin:** authority over a particular board.
3. **Game admin:** rotating game-level administrator.
4. **Human ticket owner:** owns one or more paid human tickets in a game.
5. **Bot contributor:** contributes points toward a bot ticket.
6. **Bot:** automated ticket participant without an independent human account or wallet.

### 3.2 Administrative hierarchy

Higher administrative roles inherit the lower-level administrative permissions, plus their own additional permissions.

| Role | Authority |
|---|---|
| Platform super-admin | Platform-wide authority; inherits board and game administrative permissions and can override approval requirements |
| Board admin | Board-wide authority; inherits game-admin permissions for the board and has additional board-management permissions |
| Game admin | Game-level authority over normal participants, subject to the game's approval rules |
| Normal participant | Game participation and player-level permissions |

### 3.3 Platform super-admin

The platform super-admin can:

- Manage any board and game.
- Perform board-admin and game-admin actions.
- Start, pause, resume or cancel any game immediately without joining it.
- Bypass all ordinary approval requirements.
- Grant points to user accounts.
- Grant auto-mode tokens, flips and fixes directly to user accounts.
- Exercise platform-wide administrative control.

Super-admin actions must be auditable, including the actor, action, affected game or account, timestamp and reason.

Administrative authority does not permit silently rewriting historical game results, deleting financial history or bypassing wallet and settlement integrity rules.

### 3.4 Board admin

A board admin:

- Manages board settings and membership.
- Has game-admin permissions for that board.
- Can request permitted game actions.
- Can participate in a game by purchasing a human ticket.
- When joined as a player, can act in the game-admin approval role and exercise normal participant rights.
- Receives one vote as a participating board admin, not multiple votes for holding multiple roles.

A board admin who has not joined as a player does not receive a participant vote.

### 3.5 Game admin

- The first eligible human ticket owner to join a game becomes its initial game admin.
- The game-admin role rotates in participant join order when the current admin becomes unavailable or leaves.
- The current game admin can request and approve permitted game actions.
- A game admin remains one human account and receives only one vote.
- Holding the game-admin role does not provide unilateral authority over ordinary start, pause or resume actions.

### 3.6 Platform super-admin point and consumable grants

- Only platform super-admins can grant points.
- Only platform super-admins can grant auto-mode tokens, flips and fixes.
- Board admins and game admins cannot create global resources.
- All grants must be recorded with the grantor, recipient, quantity, resource type, timestamp and reason.

## 4. Boards, templates and game configuration

- Multiple reusable game templates can exist.
- Each board is assigned a template.
- Every newly created game inherits the board's current template settings.
- Each game snapshots its settings when it is created, including while it is waiting.
- Changes to board or template settings apply only to games created after the current game completes or is cancelled.
- Existing games never silently inherit changed settings.

Configurable board settings include:

- Minimum human participation.
- Human ticket entry fee.
- Maximum human tickets per account.
- Prize categories and allocation weights.
- Maximum winners per category, if configured.
- Bot limits and contribution rules.
- Number-calling interval (initial default: 5 seconds).
- Missed number-call delay grace (initial default: 300 seconds; configurable).
- Admin offline grace period (default: 90 seconds).
- START/PAUSE/RESUME action-request expiry (initial default: 60 seconds).
- Chat and event retention (initial chat-retention default: 3 days).
- Other game-specific rules.

### 4.1 Minimum participation

Minimum participation is measured by distinct human accounts owning at least one paid human ticket.

- Multiple tickets owned by one account count as one human participant.
- Bot contributors without a paid human ticket do not count.
- Bot tickets do not count.
- Automatic-mode human tickets count exactly like manual human tickets.

## 5. Game lifecycle and administration

### 5.1 Lifecycle states

A game has one of these states:

| State | Meaning |
|---|---|
| WAITING | Players can join, purchase tickets and configure ticket modes; bot offers are allowed |
| RUNNING | Number calling, marking, claims and game processing are active |
| PAUSED | Number calling and game-changing operations are suspended |
| COMPLETED | All categories and final allocations have been settled |
| CANCELLED | An approved cancellation has been settled |

Completed and cancelled games are historical records and cannot be reopened.

### 5.2 Game creation and start

1. A waiting game is created automatically for the board.
2. A human joins by purchasing at least one human ticket.
3. The player can purchase additional tickets within the board limit.
4. Ticket mode is selected for each ticket at purchase.
5. Optional bot offers can be proposed and accepted.
6. An eligible game admin is selected.
7. Participants may withdraw from a WAITING game before it starts; withdrawal rules and financial releases are defined in Sections 6.2 and 9.2–9.3. Withdrawal voids all of the participant’s human tickets and cancels every bot offer to which they contribute, releasing all holds for those offers.
8. The game starts only after minimum human participation is met and the start approval requirements are satisfied.
9. At start, ticket layouts, ticket modes, participation and bot offers are frozen; all valid pre-game wallet holds are captured into the Game Wallet.
10. Number calling and automated game processing begin.

A human cannot join a game without purchasing at least one paid human ticket. A participant may withdraw from a WAITING game, but cannot withdraw after the game starts. Withdrawal removes the account from active participation in that game; it does not itself remove the account’s board membership.

### 5.3 Game administrator availability

- The first eligible human ticket owner to join becomes the initial game admin.
- Admin succession follows participant join order.
- Each board has a configurable admin offline grace period.
- The default admin offline grace period is **90 seconds**.
- If the current admin remains unavailable beyond the configured grace period, the role transfers to the next eligible participant.
- If no eligible admin is available, a running game automatically pauses.
- A particular admin's departure does not permanently stop or invalidate the game.
- An eligible admin must be available before a game can start.

Automatic human tickets and bot tickets continue operating independently of their owners or contributors being online. Their offline status alone does not trigger a pause if an eligible game admin remains available.

### 5.4 Start, pause and resume approvals

Any game participant or authorized board administrator can request a start, pause or resume action.

Ordinary actions require two distinct approvals:

1. One approval from an eligible admin.
2. One approval from a different, non-admin human game participant.

The eligible admin approver is:

- The current game admin; or
- A participating board admin.

Rules:

- If an admin requests the action, a different non-admin human participant must approve it.
- If a non-admin requests the action, the current game admin or a participating board admin must approve it.
- A participating board admin can fulfil the admin approval role.
- One account cannot satisfy both approvals.
- A requester can count as the approval from their own role category.
- A board admin who is not a game participant can initiate an action in their administrative capacity but does not count as a participating board-admin approver.
- A platform super-admin can execute the action immediately without either approval.
- An open request is shown/notified to eligible reviewers. Any eligible reviewer may respond while it remains open; response records are created only when someone responds, rather than pre-creating approval rows for every eligible reviewer.
- Once the required approvals are reached, the request closes and the action is executed exactly once. The notification is then closed for all recipients.
- A rejection is recorded but does not automatically veto the request while another eligible reviewer can still satisfy the required approval role. Close the request as rejected only when the approval threshold becomes impossible.

Actions are state-dependent:

- Start is allowed only in WAITING.
- Pause is allowed only in RUNNING.
- Resume is allowed only in PAUSED.

START, PAUSE and RESUME requests expire 60 seconds after creation by default. A request must be validated against the current game state when it takes effect. An expired or stale request must not execute against a changed game state.

### 5.5 Pause and resume behaviour

- Pausing stops number calling, claim processing and other game-changing operations.
- A paused game can remain paused indefinitely.
- Resuming continues from the persisted game state.
- The next number interval starts from the resume time.
- A board owner or platform super-admin can initiate an action but cannot bypass ordinary approvals unless acting as platform super-admin.

### 5.6 Missed number calls and recovery

- Number calls must be processed from persisted game state.
- If backend processing misses a scheduled number call by more than the configured delay grace period, the game automatically pauses.
- The initial delay grace default is **300 seconds (5 minutes)** and is configurable per board/game.
- Recovery must check whether the previous scheduled deadline was missed before issuing another number.
- The system must not catch up by calling multiple missed numbers in a burst.
- An authorized resume is required before number calling continues.
- The next number interval begins from the resume time.

### 5.7 Completion

A game completes when:

- Every prize category has been resolved and settled; or
- All 90 numbers have been called and final settlement has completed.

Calling number 90 does not cause immediate completion. The game waits until the next scheduled processing interval to perform final settlement. No 91st number is called.

After completion or cancellation, the next waiting game is created automatically using the board's then-current settings.

## 6. Tickets and number generation

### 6.1 Standard ticket structure

Every human and bot ticket uses a standard 90-ball Tambola layout:

- 3 rows × 9 columns.
- 15 numbers per ticket.
- Exactly 5 numbers per row.
- Exactly 5 numbers in each horizontal 3×3 block (three adjacent columns across all three rows).
- Column ranges:
  - Column 1: 1–9
  - Column 2: 10–19
  - Column 3: 20–29
  - Column 4: 30–39
  - Column 5: 40–49
  - Column 6: 50–59
  - Column 7: 60–69
  - Column 8: 70–79
  - Column 9: 80–90
- Numbers are arranged in ascending order within each column.
- No three consecutive blank cells are permitted horizontally or vertically.
- Every ticket must satisfy all layout constraints.

Identical number layouts are prohibited within the same game. Different games may reuse layouts.

### 6.2 Human ticket purchase

- A human must buy at least one ticket to join a game.
- The ticket entry fee is charged per ticket.
- The first ticket purchase and game participation registration happen together.
- Additional tickets are optional and subject to the board's ticket limit.
- Tickets cannot be purchased after the game starts.
- The ticket fee is reserved from the account wallet when the purchase succeeds; it is not yet Game Wallet revenue.
- At game start, the reservation is captured and the entry fee transfers into the Game Wallet.
- Before game start, a participant may withdraw from the WAITING game. Withdrawal voids all of that account’s human tickets in that game and releases their ticket-fee reservations. Any auto-mode token successfully consumed at purchase remains consumed.
- Withdrawal also cancels every bot offer in the WAITING game to which that account has contributed, whether as proposer or non-proposer. All contributors’ holds for each cancelled offer are released; no remaining contributor is required to absorb a larger share or continue funding the cancelled offer.
- A participant cannot withdraw after the game starts. Their ticket ownership and settlement rights remain valid even if they disconnect.
- A participant who still owns a paid human ticket or has an active bot contribution cannot leave the board. They must withdraw from the WAITING game first; after withdrawal completes and no active participation remains, they may leave the board.
- Disconnecting never counts as withdrawal and does not release reservations.

### 6.3 Ticket mode selection

Each human ticket uses one of two modes: **Manual** or **Automatic**.

The mode is selected when the ticket is purchased. Each ticket can have a different mode.

The selected mode is immutable after successful purchase.

**Manual mode**
- The player manually marks numbers as they are called.
- The player can update markings while the game is running.
- To claim a category, the player must mark all qualifying numbers and explicitly submit the category claim.
- Manual markings control displayed ticket progress and public potential-winner progress.
- Manual markings do not determine authoritative winner validity.

**Automatic mode**
- Requires one available auto-mode token per ticket.
- The token is consumed when the automatic-mode ticket purchase succeeds.
- A failed purchase must not consume the token.
- The system automatically marks called numbers on the ticket.
- The ticket is completely read-only to the human owner.
- The system evaluates eligibility and submits claims automatically for every qualifying category.
- The owner does not need to be online or watching.
- The ticket's displayed markings and progress update automatically.
- The owner retains normal human participation rights, including eligibility for minimum participation and cancellation voting.
- Automatic mode does not change ownership, entry fee or prize entitlement.
- Consumed auto-mode tokens are not refunded for successfully purchased tickets, including when a game is cancelled.

Automatic human tickets and bot tickets may share the same automated marking and claim-processing behaviour, but they remain separate ticket types:

- An automatic human ticket belongs to its human purchaser. Its winnings belong to that human.
- A bot ticket is funded by human contributors, has no human ticket owner and distributes winnings to its recorded contributors.

### 6.4 Ticket freezing and flips

At game start:

- Ticket layouts become immutable.
- Ticket modes become immutable.
- No tickets can be added, removed, replaced or modified.
- Manual markings can still change on manual tickets.
- Automatic ticket markings are updated by the system.

A flip:
- Replaces/regenerates one assigned ticket before game start.
- Cannot be used after game start.
- Does not change the ticket's selected mode.
- Does not refund a consumed auto-mode token.
- Consumes one account-level flip.
- Unused flips carry forward.

## 7. Fixes and completion rewards

### 7.1 Fixes

- A fix synchronizes one selected ticket's markings with all officially called numbers.
- It does not change the ticket layout or official number history.
- It can be used only while the game is running.
- It is primarily useful for correcting manual ticket markings.
- Unused fixes carry forward.
- A successfully consumed fix is not refunded if the game is cancelled.

### 7.2 Completion rewards

Each distinct human account that owns at least one manual human ticket in a completed game receives:

- One flip.
- One fix.

Rules:

- Rewards are per distinct account, not per ticket.
- Owning both manual and automatic tickets qualifies the account.
- Owning only automatic tickets does not qualify.
- Bot tickets never qualify.
- Disqualification of one or more tickets does not remove an otherwise eligible account's completion reward.
- Disconnecting or leaving the board after joining does not remove eligibility.
- Cancelled games grant no completion rewards.

Automatic-mode tokens, flips and fixes are account-level consumables. All grants and spending must be auditable.

## 8. Points economy, game wallet and prize pool

### 8.1 Points

- Signup grants 100 points.
- The initial human ticket entry fee is 10 points per ticket, configurable by board.
- Bot tickets cost exactly the same as human tickets on that board.
- Points can be granted by platform super-admins and earned through gameplay or achievements.
- Point purchasing and cash exchange are disabled initially.
- The product must not assume points will permanently have only one source or use.
- Points support two decimal places.

### 8.2 Account wallet and ledger

Every point grant, deduction, payment, refund, bot contribution, reward and payout must be auditable.

Rules:
- The transaction history is authoritative.
- Available points cannot become negative.
- Every transaction has a unique reference and relevant account, board, game or administrative context.
- Failed operations cannot leave partial deductions or credits.
- Duplicate requests cannot create duplicate transactions.
- Historical transactions cannot be silently edited or deleted.

### 8.3 Game wallet

Every game has its own Game Wallet.

The Game Wallet is the game-specific accounting record for all points collected and all obligations arising from that game. It is not merely a displayed balance.

Inflows include:
- Human ticket entry fees.
- Bot ticket contributions.

Outflows include:
- Human ticket refunds.
- Bot contribution refunds.
- Human prize payouts.
- Bot winnings distributed to contributors.
- Unawarded prize allocations.
- Other valid game-specific settlements.

Rules:
- Before game start, human ticket fees and bot contributions are held as account-wallet reservations, not Game Wallet inflows.
- At game start, valid reservations are captured atomically and the corresponding human ticket fees and bot contributions transfer into the Game Wallet.
- A pre-start withdrawal, offer recall or contribution adjustment releases the affected reservation; it does not create a Game Wallet refund transaction.
- The Game Wallet records each captured payment against its human account, ticket or bot offer.
- Prize awards can be determined and finalized during the game, but account-level credits are made during final game settlement.
- The Game Wallet tracks outstanding prize liabilities, bot contribution refunds, ticket refunds and unawarded allocations separately.
- A positive wallet balance must not be treated as entirely available prize money if some of it is already owed.
- All final payouts and refunds are credited to the relevant human account wallets.
- At final settlement, all game funds and obligations must reconcile. No points may disappear or be credited twice.

### 8.4 Prize pool

- 100% of human ticket entry fees and accepted bot contributions enter the common game prize pool.
- The platform retains no portion of the game pool.
- Board settings control prize allocation weights.

Initial allocation:

| Category | Weight | Share of a 100-point pool |
|---|---:|---:|
| Top Line | 1 | 10 |
| Middle Line | 1 | 10 |
| Bottom Line | 1 | 10 |
| Early Five | 1 | 10 |
| Four Corners | 2 | 20 |
| Full House | 4 | 40 |
| **Total** | **10** | **100** |

- Multiple valid winning tickets split the category allocation equally.
- Distribution is per ticket, not per player.
- A player with multiple winning tickets receives multiple shares.
- The same ticket can win multiple categories independently.
- Amounts support two decimal places.
- Rounding must be deterministic, with the entire allocation accounted for.

### 8.5 Unawarded allocations at game end

When all 90 numbers have been called, remaining unawarded category allocations are distributed equally across all paid tickets, including:

- Human tickets that have already won another category.
- Human tickets disqualified from further claims.
- Funded bot tickets.

Distribution is per ticket.

Bot-ticket allocations are distributed to that bot's recorded contributors according to their final contribution shares.

Disqualification prevents further category claims. It does not confiscate a ticket's economic participation or its share of unawarded allocations.

## 9. Optional bot participation

Bot participation is optional and separate from mandatory human ticket purchase.

### 9.1 Bot offers and limits

- Each board has a configurable maximum number of bots per game.
- Each bot offer represents one bot ticket.
- A bot ticket costs exactly the same as a human ticket on that board.
- A human game participant can propose a bot offer.
- The proposer is automatically the first contributor and is responsible for the full ticket price when creating the offer.
- Other users can independently accept or ignore the offer.
- The proposer does not need to separately accept their own offer.
- Each offer has its own contributor list and payment history.
- A bot ticket is created only if the offer remains valid when the game starts.

### 9.2 Bot contributions and payment reconciliation

Before game start, bot contributions use wallet holds. The Game Wallet receives funds only when the game starts and valid holds are captured.

Rules:
1. When the proposer creates an offer, they automatically reserve the full bot ticket price.
2. When another contributor accepts, the system calculates the proposed equal contribution share across all contributors then present.
3. An existing contributor’s accepted amount must never be silently changed. When a new contributor joins and would change existing shares, the revised shares are presented to all affected contributors for explicit re-acceptance. Holds are adjusted only after all affected contributors accept the revised amounts; until then, the existing accepted commitments and holds remain unchanged.
4. If any affected contributor declines the revised shares, the proposed revision is rejected, the new contribution is not applied, and the offer remains at its previous accepted state. If a contributor has not responded, the proposed revision remains pending; it does not alter accepted amounts or holds. At game start, any pending revision is discarded and the offer converts only if the previously accepted commitments exactly cover the full ticket price.
5. A contributor must have sufficient available points for the amount they explicitly accept.
6. At game start, the active accepted commitments must collectively equal the bot ticket price. The final accepted shares are frozen and all active holds are captured into the Game Wallet.
7. Shares are calculated to two decimal places. Any residual 0.01-point units are allocated in contributor acceptance order; account ID is the deterministic tie-breaker if acceptance sequence is identical.
8. Bot winnings are distributed according to the final recorded contribution shares.
9. If any contributor withdraws from the WAITING game, the entire bot offer is cancelled, all contributor commitments are removed, and all holds for that offer are released. Remaining contributors are not forced to absorb the withdrawing contributor’s share or continue funding the offer.

Example for a 10-point bot ticket:
- The proposer initially reserves 10 points.
- If a second contributor joins, the proposed equal share is shown to both contributors. Neither contributor’s accepted amount or hold changes until both explicitly accept the revised 5-point shares.
- If a third contributor joins, the proposed revised shares are shown to all affected contributors and require explicit acceptance before any hold changes.
- If any contributor withdraws from the WAITING game, the entire offer is cancelled and every contributor’s hold is released.
- At game start, the offer converts only if the active accepted commitments collectively equal the ticket price; those holds are captured.

### 9.3 Offer cancellation and conversion

- Only the proposer can manually cancel an active offer before game start.
- If any contributor (proposer or non-proposer) withdraws from the WAITING game, the offer is automatically recalled and all contributor holds are released immediately.
- Remaining contributors are not forced to absorb the withdrawing contributor’s share, have their accepted contribution changed, or continue with the cancelled offer.
- If nobody else accepts and the proposer does not recall the offer, it converts into a bot ticket funded entirely by the proposer.
- An offer cannot convert if the bot limit has been reached or its active accepted commitments do not exactly cover the ticket price.
- A bot slot is reserved when the offer is created, since the proposer is automatically its first contributor.
- Cancelling or recalling the offer releases that slot.
- At game start, valid offers convert into bot tickets and all contribution records become frozen.
- No new bot offers, contributors or contribution changes are permitted after game start.

### 9.4 Bot winnings

- Bots use standard tickets and can qualify for all applicable prize categories.
- Bots automatically mark numbers and submit claims.
- Bots have no independent wallet and never retain winnings.
- A bot's prize winnings are distributed among that bot's recorded human contributors according to their final contribution shares.
- A bot can win more or less than its original contribution.
- Each bot has its own contributor list and settlement.
- Bot contributions and winnings must be auditable.
- Bot tickets do not qualify for human account-level flip/fix completion rewards.

## 10. Claims and winner validation

### 10.1 Winning categories

Initial categories:

- **Top Line:** all five numbers in the top row have been called.
- **Middle Line:** all five numbers in the middle row have been called.
- **Bottom Line:** all five numbers in the bottom row have been called.
- **Early Five:** any five numbers on the ticket have been called.
- **Four Corners:** the leftmost and rightmost numbers in the top row and the leftmost and rightmost numbers in the bottom row have been called.
- **Full House:** all 15 numbers on the ticket have been called.

A ticket can win multiple categories, including categories that qualify on the same number. Winning one category does not prevent it from winning another.

### 10.2 Manual claims

For a manual ticket:

1. The player marks called numbers on the ticket.
2. The player marks all numbers required for the category.
3. The player explicitly selects and submits that category claim.
4. The backend validates the selected numbers, official ticket, called-number history, category conditions, ticket status and category closure boundary.

A displayed potential win is not itself a claim.

### 10.3 Automatic claims

For an automatic ticket:

- The system marks numbers as they are called.
- The system evaluates the ticket against all open categories.
- When the ticket qualifies, the system automatically submits the category claim.
- No player action or online presence is required.
- Automatic claims use the same authoritative validation and settlement rules as manual claims.
- Automatic mode ignores manual markings because the ticket is system-controlled and read-only.

### 10.4 Authoritative validation and disqualification

The backend validates every claim. Client-side state is never authoritative.

A well-formed, authorized claim that is invalid because its selected numbers, ticket, category or called-number requirements do not match results in:

- Rejection of the claim.
- Disqualification of the specific ticket used.
- The disqualified ticket becoming read-only.
- The disqualified ticket being prevented from submitting further category claims.

Other tickets owned by the same human account are unaffected.

Malformed requests, unauthorized requests and invalid API operations are rejected without automatically disqualifying a ticket.

Disqualification applies to a genuine claim attempt that is evaluated and found invalid.

A valid claim submitted after its category has closed is a soft rejection:
- The claim is rejected because the opportunity has passed.
- The ticket is not disqualified.

Disqualified tickets remain eligible for:
- Cancellation settlement and refunds.
- Their share of final unawarded allocations.
- Their owner's voting and other account-level participation rights.
- Their owner's completion rewards if the account has at least one manual ticket in a completed game.

### 10.5 Claim timing and category closure

For each ticket and category:

- **N** is the official call sequence at which the ticket first qualifies for the category.
- **M** is the call sequence at which the first valid claim for that category is accepted.

Rules:
1. A ticket whose first qualifying sequence is at or before M remains eligible to submit a claim.
2. A ticket whose first qualifying sequence is after M is not eligible for that category.
3. The first accepted valid claim establishes the category closure boundary at M.
4. The category remains open for eligible retrospective claims until the next number is drawn, M+1.
5. At M+1, the category closes permanently.
6. The category allocation is finalized at M+1 by splitting it across all accepted valid winning tickets.
7. A claim submitted after closure is rejected without disqualifying the ticket.

Claim acceptance and number calling must follow one authoritative event order. Client timestamps cannot determine whether a claim was accepted before a closing draw.

If M is the 90th and final number, the category remains pending until the next scheduled processing interval. Final settlement then resolves remaining claims and allocations. No 91st number is called.

If a valid claim is first submitted after number 90 but before final settlement, it remains pending for the final settlement interval.

## 11. Game cancellation

### 11.1 Eligibility and initiation

- Only a paused game can be cancelled through the ordinary cancellation process.
- Any game participant or authorized administrator can request cancellation.
- A platform super-admin can cancel immediately without a vote.
- An ordinary cancellation request starts a 60-second voting window.
- The electorate is frozen when voting begins.

Eligible game participants for cancellation voting are:
- Human accounts owning at least one paid human ticket.
- Human accounts contributing to at least one funded bot ticket.

Bot-only contributors may vote on cancellation but do not count toward minimum human participation.

A board admin is eligible to vote only when joined as a human player through a paid ticket. A platform super-admin is excluded from participant voting.

Disconnected or departed participants remain eligible if they met the eligibility rules when the vote began. One distinct account receives one vote, regardless of ticket count, contribution count or administrative roles.

### 11.2 Cancellation approval

- At least 50% of the frozen eligible electorate must approve.
- The eligible requester’s automatic APPROVE vote counts as their one participant vote; a requester outside the frozen electorate receives no participant vote.
- Exactly 50% is sufficient.
- No response is an abstention, not approval.
- Abstentions and non-responses remain in the denominator.
- A board admin or game admin does not receive additional voting weight.
- A participating board admin has one participant vote and can also fulfil the admin approval role for start, pause or resume.
- A platform super-admin does not vote; they can execute cancellation immediately using platform authority.
- If the threshold is not reached, cancellation is rejected and the game remains paused.
- A rejected cancellation does not automatically resume the game.

### 11.3 Cancellation settlement

When cancellation is approved:

- The game is marked CANCELLED and retained as historical data.
- Already-finalized category awards remain awarded and are paid during final settlement.
- Remaining unawarded pool value is distributed equally per paid ticket.
- Disqualified tickets remain eligible.
- Human ticket owners retain their cancellation settlement entitlement even if disconnected or departed.
- Bot tickets are included in the remaining-pool distribution.
- Bot allocations are distributed to their recorded contributors according to final contribution shares.
- Outstanding bot contribution overpayments are refunded at game settlement.
- Successfully consumed fixes, flips and auto-mode tokens are not refunded.
- Unused consumables remain in the account.
- No flip/fix completion rewards are granted for a cancelled game.
- All refunds, payouts and settlement transactions are recorded.
- The next waiting game is created automatically.

Cancellation settlement must not duplicate, reverse or silently modify already-finalized category awards.

## 12. Potential-winner visibility

Players can see indicative progress without exposing other players' missing numbers.

Example: **"[Player] needs just two numbers to claim Top Line."**

Rules:
- Other players see progress or remaining-number counts, not actual missing numbers.
- A player can request to see their own missing numbers.
- Manual-ticket progress is based on the player's manual markings.
- Automatic-ticket progress is based on the system's automatic markings.
- Automatic ticket markings are visible as read-only progress.
- Progress is indicative only and never proves a valid claim.
- Backend winner validation always uses the official ticket and called-number history.
- Future achievement-based visibility must preserve ticket privacy and game integrity.

## 13. Chat, presence and social features

### 13.1 Chat

- Each board has board-level chat.
- Each game has game-level chat.
- A user sees game chat history from the time they joined that game, not earlier messages.
- Board chat retention is configurable.
- Game chat retention is configurable separately.
- Chat history is separate from authoritative game events.

### 13.2 Quick messages

- Provide a normal chat input.
- Provide selectable predefined messages for common game interactions.
- A player can select and send a quick message without typing.

### 13.3 Presence

- Show online/offline status.
- Presence reflects connection state, not proof that a user is actively watching.
- Multiple tabs or devices for one account count as one online user.
- Presence informs admin availability and rotation.
- Presence does not determine ticket ownership, claim eligibility, prize entitlement or game participation.
- Automatic human tickets and bot tickets continue playing when their owners or contributors are offline.

## 14. Progression, achievements and leaderboards

The product should support future:

- Consecutive-game participation streaks.
- Board and platform leaderboards.
- Top-player awards.
- Achievements and badges.
- Configurable achievement rewards.
- Participation, winning and milestone rewards.

A participation streak counts games the account actually joined through a paid human ticket, not games played by other board members.

Completion rewards are granted once per distinct human account that owns at least one manual ticket in a completed game. Automatic-only accounts and bot tickets do not qualify.

Disqualification does not remove an otherwise eligible account's completion reward.

Automatic claim mode does not grant a gameplay advantage or additional reward.

The rules for earning auto-mode tokens beyond the initial signup grant are intentionally deferred.

## 15. Fairness, privacy and integrity

### 15.1 Number fairness

- Every number from 1 to 90 has equal probability of being called.
- No number is called more than once per game.
- Players and administrators cannot choose, reorder or silently alter calls.
- The complete number history and order remain auditable.
- The displayed three most recent numbers appear newest first.

### 15.2 Ticket privacy

- A player can access their own ticket details.
- Other players cannot access another player's missing numbers or private ticket data.
- Public progress exposes only permitted progress information.
- Automatic ticket markings may be displayed as read-only progress without exposing private ticket details beyond the intended game display.

### 15.3 Wallet and settlement integrity

- Available points cannot become negative.
- All game and account wallet movements are auditable.
- Pre-game ticket fees and bot contributions use account-wallet holds; only captured funds enter the Game Wallet.
- Outstanding liabilities cannot be counted as available prize money.
- Failed operations cannot leave partial financial-style changes.
- Repeated operations cannot duplicate deductions, refunds or payouts.
- All final settlements must reconcile collected funds, obligations and credits.
- Historical transactions cannot be silently rewritten.

### 15.4 Game integrity

- Official ticket layouts, called-number history, claim acceptance, category closure and settlement are authoritative.
- Manual markings and client-side displays cannot override official records.
- Claims and number draws have a deterministic authoritative ordering.
- Completed and cancelled results cannot be silently rewritten.
- Automatic and manual tickets use the same authoritative winner-validation rules.

## 16. Game history and retention

- Completed game results and winner records are retained as durable history.
- Cancelled games and their settlement history are retained.
- Game Wallet transaction and settlement history is retained.
- Account point transaction history is durable and auditable.
- Consumable grant and spending history is retained.
- Achievement and reward history is retained.
- Board chat, game chat and transient game events have separately configurable retention.
- Removing old chat or transient events must never erase wallet history, prize settlements, completed game records or cancellation records.

---

## 17. Confirmed product invariants

1. A human cannot join a game without purchasing at least one human ticket.
2. Bot contributions are optional and do not replace mandatory human ticket purchase for human participation.
3. One board has only one current game.
4. Game settings are snapshotted at game creation.
5. Ticket layouts and ticket modes freeze at successful purchase/start as specified.
6. Automatic human tickets continue marking and claiming while their owners are offline.
7. Automatic human tickets and bot tickets share automated gameplay behaviour but remain distinct ownership and economic types.
8. Disqualification applies to the specific ticket, not the human account.
9. A disqualified ticket cannot claim further categories but retains its other economic and participation entitlements.
10. All paid tickets, including disqualified tickets and previous category winners, share final unawarded allocations.
11. Bot winnings belong to the recorded contributors of that specific bot.
12. Ordinary start, pause and resume actions require an admin approval and a separate non-admin participant approval; the requester may count for their own role category.
13. Ordinary cancellation requires at least 50% approval from the frozen eligible electorate.
14. Platform super-admins can override ordinary approval requirements.
15. Board admins vote only when they have joined as players; one account receives one vote.
16. The game pauses if no eligible game admin is available.
17. Official ticket data and called-number history determine winner validity.
18. Game Wallet accounting tracks collected funds and outstanding obligations separately.
19. Successfully spent consumables are not refunded on cancellation.
20. Only accounts with at least one manual human ticket receive flip/fix completion rewards.
21. Completed and cancelled games remain permanent historical records.
22. A participant may withdraw only while the game is WAITING; withdrawal voids their human tickets and releases ticket holds. Disconnect is not withdrawal.
23. Any contributor’s withdrawal cancels each bot offer they contributed to and releases every contributor’s hold for that offer; remaining contributors are not forced to fund it.
24. A contributor’s accepted amount is never silently changed. Revised equal shares require explicit re-acceptance from every affected contributor.
25. An account cannot leave a board while it still has active participation in that board’s current game; a WAITING-game withdrawal must complete first.

---

## 18. Confirmed operational defaults

The following initial defaults are confirmed. Boards may override configurable values where permitted by the product rules.

| Setting | Initial default |
|---|---:|
| Missed number-call delay grace | 300 seconds (5 minutes) |
| START / PAUSE / RESUME action-request expiry | 60 seconds |
| Cancellation voting window | 60 seconds |
| Minimum distinct human participants | 2 |
| Maximum human tickets per account per game | 2 |
| Maximum bot tickets per game | 2 |
| Number-calling interval | 5 seconds |
| Board/game chat retention | 3 days |
| Admin offline grace | 90 seconds (existing default) |

Bot contribution rounding is confirmed: shares are calculated to two decimal places, and any residual 0.01-point units are allocated in contributor acceptance order, with account ID as a deterministic tie-breaker if acceptance sequence is identical.

START, PAUSE and RESUME requests expire 60 seconds after creation. The CANCEL vote remains a separate 60-second voting window. A request that expires or becomes stale must not execute.

**End of Product Requirements Specification — Version 1.0**
