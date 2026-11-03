# Repository guidance for AI contributors

Before making changes, read:

1. `.project/README.md`
2. `.project/PROJECT_STATE.md`
3. `.project/IMPLEMENTATION_STATUS.md`
4. `.project/REQUIREMENTS_TRACEABILITY.md`
5. `.project/ARCHITECTURE_DECISIONS.md`
6. `.project/KNOWN_ISSUES.md`

Treat `docs/SPEC.md` and `docs/DATA_MODEL.md` as the authoritative product and logical-data baselines. Treat the continuity files as dated snapshots: verify the current branch, commit, source and tests before relying on them.

Do not claim that a feature is implemented because its schema or UI exists. Distinguish source implementation, automated test coverage, deployment and runtime verification. Do not deploy, merge, or change external systems without explicit authorization.

When changing product behaviour, identify affected SPEC and DATA_MODEL requirements, preserve documented invariants, add appropriate tests, and update the relevant continuity/status documentation in the same change. Record unresolved discrepancies in `.project/KNOWN_ISSUES.md`.

For incomplete work, add a concise handoff using `.project/sessions/SESSION_TEMPLATE.md`. Do not infer the status of separately managed workstreams; incorporate them only when their owner provides an explicit update.
