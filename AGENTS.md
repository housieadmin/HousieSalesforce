# Repository guidance

- Start with `.project/README.md`; verify branch, commit and open PRs before relying on prior context.
- Read relevant sections of `docs/SPEC.md`, `docs/DATA_MODEL.md` and affected source. Consult other docs only when needed.
- Design complete service behavior before coding: authorization, state transitions, transaction boundaries, idempotency, concurrency, failure handling and audit/ledger effects.
- Keep cohesive implementations together. Use focused tests; avoid unrelated cleanup.
- Distinguish source, test, deployment and runtime evidence. A compile or metadata validation does not prove a product workflow works.
- Preserve data integrity and security invariants. Verify technical documentation against source when changing architecture.
- Record implementation decisions and validation in the relevant PR. Update `docs/BUILD_STATUS.md` only when the factual implementation snapshot changes.
- Do not deploy, merge or change org/security settings without explicit authorization.

## Salesforce automation

- Housie owns its pages, business flows, scenarios, assertions, manifests, org settings and project configuration. Put Housie Node code in `src/`; add subfolders only when real module boundaries need them.
- `packages/sf-augment` owns reusable, project-independent Salesforce capabilities. Never add Housie names, org aliases, credentials, paths or business rules there.
- Before adding code, inspect the relevant Housie code, `packages/sf-augment`, package manifests and existing Salesforce CLI/Playwright capabilities. Reuse or extend before creating.
- Pass org names, paths, URLs and policies as configuration. Never hardcode credentials.
- Keep GitHub workflows limited to triggers, permissions, checkout, runtime setup, secret/environment mapping, artifact handling and invoking repository code. Put parsing, validation, Salesforce commands and browser behavior in tested code.
- Keep Playwright Test as the browser test runner. Housie scenarios and product assertions stay in Housie.
- Run `npm test` after Node changes. Run browser E2E only against the explicitly configured org. Do not deploy, merge or change org/security settings without explicit authorization.
