# Repository guidance for AI contributors

Start with `.project/README.md` and use the relevant guide under `.project/workstreams/` as a context aid. The workstreams are not separate teams, ownership boundaries or mandatory workflow stages.

For each task:
- Verify the current branch, working tree and commit before relying on prior notes.
- Read the most relevant workstream guide, directly affected source files/tests, and exact SPEC/DATA_MODEL sections needed.
- A session may investigate, implement, test and debug a task end-to-end. Do not force a handoff just because work crosses workstream categories.
- Bring in another guide or session only when parallel work, specialist context or independent verification provides a concrete benefit.
- For architectural or cross-cutting changes, inspect the relevant technical architecture docs and supporting source evidence.
- Distinguish source implementation, automated test coverage, deployment and runtime verification.
- Do not claim a feature works because its schema, UI, placeholder method or audit event exists.
- Preserve data integrity, idempotency, security and other relevant invariants.
- Update continuity notes only when project state materially changes; avoid documentation churn for trivial edits or transient debugging attempts.
- Do not deploy, merge, or change external systems without explicit authorization.
- For incomplete substantial work that genuinely needs continuation by another session, use `.project/sessions/SESSION_TEMPLATE.md` for a concise handoff.
