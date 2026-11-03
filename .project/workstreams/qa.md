# QA & automation workstream

## Scope
Apex tests, browser-agent scenarios, test data, regression coverage, smoke tests, test evidence and quality gates.

## Read for a small task
- The specific test/scenario file and the code path it exercises.
- The relevant acceptance criteria in SPEC.
- The relevant workflow only if the task changes how tests are invoked or reported.

Do not treat the existence of browser-agent infrastructure as proof of end-to-end coverage.

## Read for a suite or strategy change
- Map scenarios to acceptance criteria and user-visible outcomes.
- Inspect test setup/fixtures, permissions, test isolation and cleanup.
- Read `.project/IMPLEMENTATION_STATUS.md` and `.project/REQUIREMENTS_TRACEABILITY.md` for coverage gaps in the affected feature.
- Read release-engineering guidance if CI execution, artifacts or gates change.

## Boundaries and invariants
- Separate unit, integration, browser smoke and true end-to-end tests in reporting.
- A navigation smoke test does not verify purchase, gameplay, claims or settlement.
- Report exact test command, environment, result and known gaps.
- Never mark a feature runtime-verified from static inspection or a narrow test.

## Completion and handoff
Add reproducible scenarios with explicit assertions. Update QA documentation/status only when coverage or verification evidence materially changes. Do not deploy or alter org data without authorization.
