# Housie project continuity

Keep this directory small. Product requirements and technical design live in `docs/`; implementation details, decisions and verification evidence live in the PR that changes the code.

## Start a work session

1. Read this file and `AGENTS.md`.
2. Check the current branch, commit and open PRs. Resume the active work package; do not create a new PR just because a chat session changed.
3. Read the relevant sections of `docs/SPEC.md` and `docs/DATA_MODEL.md`, then inspect the affected source and callers. Read architecture/mapping/workflow docs only when the task needs them.
4. Read `.project/DELIVERY_BACKLOG.md` only to select or scope delivery work. Read `docs/BUILD_STATUS.md` only for a quick implementation snapshot.
5. Keep the PR title and description accurate as implementation evolves. The PR is the detailed record of scope, decisions, code changes, validation evidence, limitations and remaining gates. Do not create parallel session trackers or duplicate change logs.

## Work-package and PR rules

- A PR represents one cohesive, user-visible capability or complete service boundary—not a chat session, file batch or arbitrary small coding step.
- Design the service contract and end-to-end behaviour before implementation: authorization, state transitions, transaction boundaries, idempotency, concurrency, failure handling and audit/ledger effects.
- Implement the complete coherent service in one focused coding package, including required supporting code and focused tests. Do not fragment service design across sessions.
- Separate costly org/browser acceptance from implementation only when it is independently executable and does not require splitting the service itself.
- Keep validation proportional to changed behaviour. Do not turn coverage uplift or E2E test activity into a separate delivery goal.
- A package ends when its stated acceptance outcome is implemented and the required focused validation is complete, or when a genuine external approval/dependency blocks it. Report the exact boundary.
- Do not merge, deploy or change org/security settings without explicit authorization.

## Durable sources

- `docs/SPEC.md` and `docs/DATA_MODEL.md` are authoritative product requirements and logical data model.
- Current source and metadata define what is implemented.
- Technical docs explain constraints; verify them against source when changing architecture.
- GitHub PRs own implementation history and evidence. Git history preserves old session notes and trackers; do not recreate them in active project documentation.
- `docs/BUILD_STATUS.md` is a short factual snapshot, not a change log or roadmap.

For an unfinished package that genuinely needs another session, use `.project/sessions/SESSION_TEMPLATE.md`. Otherwise leave continuity in the active PR.
