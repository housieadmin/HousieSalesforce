# GitHub & release engineering workstream

## Scope
GitHub Actions, issue/PR command workflows, branch and PR management, validation/deployment orchestration, release safety, metadata sync and automation permissions.

## Read for a small task
- The directly affected workflow/configuration/script.
- `docs/GITHUB_ACTIONS.md` sections relevant to that workflow.
- Related issue/PR templates or command handlers only when they are in the execution path.

Do not load Salesforce product requirements or implementation matrices for an isolated workflow wording or trigger change.

## Read for a workflow or release redesign
- Trace the event from trigger through parsing, authorization, job execution and resulting GitHub/Salesforce action.
- Inspect permissions, concurrency, secrets references, branch protections and failure paths.
- Read relevant QA guide and tests when validation behaviour changes.
- Read `.project/ARCHITECTURE_DECISIONS.md` only if release automation changes a product or data-integrity invariant.

## Boundaries and invariants
- Treat issue/PR comments as untrusted input; validate command, actor authorization and target before executing.
- Prefer least-privilege permissions and explicit allowlists.
- Separate validation from deployment; never imply a validation run deployed anything.
- Verify workflow dispatch inputs and branch/ref behaviour from the actual YAML and run evidence.
- Do not merge, deploy or modify external systems without explicit authorization.

## Completion and handoff
Validate workflow syntax and inspect the resulting diff. Where possible, run the relevant workflow or document that it was not run. Update `docs/GITHUB_ACTIONS.md` when documented behaviour changes; keep handoffs concise.
