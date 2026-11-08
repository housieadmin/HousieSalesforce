# Repository guidance

- Start with `.project/README.md`; verify branch, commit and open PRs before relying on prior context.
- Read only the relevant sections of `docs/SPEC.md`, `docs/DATA_MODEL.md` and affected source. Consult architecture, mapping, storage or workflow docs only when needed.
- A work session owns its task end-to-end where practical. Do not create a handoff merely because work crosses disciplines or a chat session ends.
- Design complete service behaviour before coding: authorization, state transitions, transaction boundaries, idempotency, concurrency, failure handling and audit/ledger effects.
- Keep a cohesive service implementation together. Use focused tests to validate changed behaviour; do not expand into broad coverage work unless explicitly prioritized.
- Distinguish source, test, deployment and runtime evidence. A compile, metadata validation or audit event does not prove a product workflow works.
- Preserve data integrity and security invariants. Verify technical documentation against current source when changing architecture.
- Keep detailed implementation decisions and validation evidence in the relevant PR. Update `docs/BUILD_STATUS.md` only when the factual implementation snapshot changes.
- Do not deploy, merge or change org/security settings without explicit authorization.
- Use `.project/sessions/SESSION_TEMPLATE.md` only for substantial unfinished work that genuinely needs a handoff.
