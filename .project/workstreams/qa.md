# QA & automation workstream

## Scope
Apex tests, browser-agent scenarios, test data, regression coverage, smoke tests, test evidence and quality gates.

## Small task
- Inspect the specific test/scenario file and the code path it exercises.
- Read the relevant acceptance criteria in SPEC.
- Inspect the relevant workflow only if test invocation or reporting changes.

Do not treat the existence of browser-agent infrastructure as proof of end-to-end coverage.

## Suite or strategy change
- Map scenarios to acceptance criteria and user-visible outcomes.
- Inspect test setup/fixtures, permissions, test isolation and cleanup.
- Inspect existing test files and source paths to identify coverage gaps.
- Read release-engineering guidance if CI execution, artifacts or gates change.

## How QA fits into development

QA is a capability that can be used by the active development session or in a separate session when independent scrutiny is useful. It is not a separate team, a mandatory stage, or a requirement to hand every fix back and forth.

For a difficult or high-risk defect, QA work may happen alongside development: identify a reliable reproduction, design assertions, probe alternate paths and challenge whether the proposed fix addresses the underlying behaviour. The development session can continue implementing and debugging; it should not wait for a formal QA handoff unless the user explicitly wants independent verification before proceeding.

Prefer reusable scenarios and durable test evidence over repeated manual retelling between sessions. If a separate session finds a failure, report the exact commit/build, environment, scenario, expected and actual result, and reproduction evidence in the relevant issue/PR. The active development work can then continue from that evidence.

## Boundaries
- Separate unit, integration, browser smoke and true end-to-end tests in reporting.
- A navigation smoke test does not verify purchase, gameplay, claims or settlement.
- Report exact test command, environment, result and known gaps.
- Never mark a feature runtime-verified from static inspection or a narrow test.
- QA can identify defects and propose test changes; implementation ownership is not implied by this guide.

## Completion
Add reproducible scenarios with explicit assertions. Update relevant test/workflow documentation only when coverage or verification evidence materially changes. Do not deploy or alter org data without authorization.
