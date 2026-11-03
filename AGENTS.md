# Repository guidance for AI contributors

Start with `.project/README.md` and route the task to the relevant guide under `.project/workstreams/`. Do **not** read every continuity document by default.

For each task:
- Verify the current branch, working tree and commit before relying on prior notes.
- Read only the relevant workstream guide, directly affected source files/tests, and exact SPEC/DATA_MODEL sections needed.
- Expand to other workstream guides only when the change crosses those boundaries.
- For architectural or cross-cutting changes, consult `.project/ARCHITECTURE_DECISIONS.md` and the relevant status/traceability/known-issue notes.
- Distinguish source implementation, automated test coverage, deployment and runtime verification.
- Do not claim a feature works because its schema, UI, placeholder method or audit event exists.
- Preserve data integrity, idempotency, security and other documented invariants.
- Update relevant continuity/status docs when evidence or project state materially changes; avoid documentation churn for trivial edits.
- Do not deploy, merge, or change external systems without explicit authorization.
- Do not infer the status of independently managed workstreams; incorporate them only after their owner supplies an explicit handoff.
- For incomplete substantial work, use `.project/sessions/SESSION_TEMPLATE.md` to leave a concise handoff.
