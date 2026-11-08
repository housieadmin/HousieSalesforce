# Salesforce Agent Architecture

## Decision

Use **Salesforce Agent** as the user-facing orchestration concept and keep the Salesforce CLI and Browser Agent as independent execution engines. Do not turn browser scenarios into wrappers around CLI commands or move deploy/retrieve semantics into the browser framework.

The repository already has the beginning of this facade: the owner-only `/sf` issue-command dispatcher validates requests and routes them to trusted GitHub Actions workflows. Keep that as the public command namespace.

## Capability boundaries

| Capability | Execution engine | Responsibilities |
|---|---|---|
| Metadata deploy, restore, retrieve, validation | Salesforce CLI workflows | Source selection, path safety, dry runs, deployment, retrieve, Apex tests |
| UI navigation, inspection, screenshots, browser assertions | Browser Agent / Playwright | Browser lifecycle, page actions, UI observations and evidence |
| End-to-end deploy and UI verification | Workflow composition | Run the CLI workflow first, then invoke the browser workflow only after deployment succeeds |

The two engines may share setup/authentication conventions, configuration, run identifiers, summaries and artifact conventions. They must not share engine-specific runtime objects: CLI jobs have an org alias/session; browser jobs have a browser context/page/session.

## Shared infrastructure

- `.github/actions/setup-salesforce-cli` installs a configurable Salesforce CLI version.
- `.github/actions/salesforce-jwt-auth` accepts JWT credentials, instance URL, alias and default-org behavior as explicit inputs.
- Housie-specific defaults belong in workflow/repository configuration, not in the composite actions. Set `SF_ORG_ALIAS` to override the Housie default.
- Authentication is job-scoped. A downstream job must authenticate independently; GitHub Actions does not share a CLI session between jobs.
- Operation-specific validation, permissions, confirmations and deployment behavior remain in the calling workflow.

## Command and workflow policy

- Keep `/sf deploy`, `/sf restore` and `/sf retrieve` as CLI-oriented commands.
- Keep `/sf deploy-and-verify` as a composed workflow: successful CLI deployment followed by browser verification.
- Add new CLI operations as dedicated CLI workflows/commands, not as browser scenarios.
- Add browser-only commands only when they provide distinct value; do not duplicate the existing combined workflow.
- Treat GitHub Actions as one execution provider. The generic browser framework should remain independently runnable and should not depend on GitHub Actions internals.

## Migration sequence

1. Land the reusable CLI setup/authentication actions (this PR).
2. After browser framework PR #46 is integrated, switch the browser workflow to these same actions while preserving its browser-only runtime and frontdoor URL handling.
3. Keep `/sf deploy-and-verify` as the cross-engine composition point and validate that CLI failure prevents browser execution.
4. Rename browser-facing labels only if needed for discoverability; keep the internal browser engine clearly named and independently testable.
