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

## Boundaries
- Separate unit, integration, browser smoke and true end-to-end tests in reporting.
- A navigation smoke test does not verify purchase, gameplay, claims or settlement.
- Report exact test command, environment, result and known gaps.
- Never mark a feature runtime-verified from static inspection or a narrow test.

## Completion
Add reproducible scenarios with explicit assertions. Update relevant test/workflow documentation only when coverage or verification evidence materially changes. Do not deploy or alter org data without authorization.
