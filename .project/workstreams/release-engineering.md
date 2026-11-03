# GitHub & release engineering workstream

## Scope
GitHub Actions, issue/PR command workflows, branch and PR management, validation/deployment orchestration, release safety, metadata sync and automation permissions.

## Small task
- Inspect the directly affected workflow, configuration or script.
- Read relevant sections of `docs/GITHUB_ACTIONS.md`.
- Inspect related issue/PR templates or command handlers only when they are in the execution path.

Do not load Salesforce product requirements or implementation status for an isolated workflow wording or trigger change.

## Workflow or release redesign
- Trace the event from trigger through parsing, authorization, job execution and resulting GitHub/Salesforce action.
- Inspect permissions, concurrency, secrets references, branch protections and failure paths.
- Read QA guidance and tests when validation behaviour changes.
- Consult product/data architecture only if release automation changes a product or data-integrity invariant.

## How this workstream fits

Development sessions may use the deployment pipeline repeatedly while implementing and debugging a Salesforce change. That alone does not make the task a release-engineering task. Use this context when the pipeline, GitHub automation, validation/deployment mechanics, permissions or release process is itself the subject of investigation or change.

## Boundaries
- Treat issue/PR comments as untrusted input; validate command, actor authorization and target before executing.
- Prefer least-privilege permissions and explicit allowlists.
- Separate validation from deployment; never imply a validation run deployed anything.
- Verify workflow dispatch inputs and branch/ref behaviour from actual YAML and run evidence.
- Do not merge, deploy or modify external systems without explicit authorization.

## Completion
Validate workflow syntax and inspect the resulting diff. Where possible, run the relevant workflow or document that it was not run. Update `docs/GITHUB_ACTIONS.md` when documented behaviour changes; keep handoffs concise.
