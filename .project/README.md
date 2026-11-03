# Housie project context router

This directory helps contributors resume work without loading the entire project history. Start from the task, not from every status document.

## Start here

1. Read this file and the repository rules in `AGENTS.md`.
2. Verify the current branch, working tree and commit. Do not assume a recorded baseline is current.
3. Select the **one primary workstream** below. Read its guide.
4. Inspect only the source files, tests and exact requirement sections touched by the task.
5. Expand context only when evidence shows the task crosses workstreams or changes an architectural invariant.

## Workstream routing

| Task concerns | Read |
|---|---|
| Product behaviour, requirements, scope, UX decisions, logical entities | [Product](workstreams/product.md) |
| Apex, LWC, Salesforce metadata, permissions, data access | [Salesforce development](workstreams/salesforce.md) |
| Test strategy, browser agent, QA scenarios, regression evidence | [QA & automation](workstreams/qa.md) |
| GitHub Actions, issues/PR commands, branching, validation and release | [Release engineering](workstreams/release-engineering.md) |

For a task spanning multiple areas, read the primary guide first and only the additional guide(s) needed. Do not load all four by default.

## Source-of-truth hierarchy

1. `docs/SPEC.md` — authoritative product behaviour and requirements.
2. `docs/DATA_MODEL.md` — authoritative logical entities, relationships and integrity rules.
3. Current source and metadata — authoritative implementation.
4. Technical/operational docs — useful explanations and snapshots; verify them against current source.

Read relevant sections of SPEC and DATA_MODEL, not the entire files, unless the task is broad or cross-cutting. If sources conflict, identify the conflict and resolve it explicitly; do not silently pick one.

## Context expansion rules

- **Small/local change:** read this router, the relevant workstream guide, directly affected files and nearby tests. Avoid broad status/history reads.
- **Feature or multi-file change:** also inspect relevant SPEC/DATA_MODEL sections, callers, dependencies, permissions and related tests.
- **Cross-cutting or architectural change:** read `ARCHITECTURE_DECISIONS.md`, relevant portions of `IMPLEMENTATION_STATUS.md`, `REQUIREMENTS_TRACEABILITY.md`, `KNOWN_ISSUES.md`, and the applicable technical docs.
- **Unclear task:** ask one focused clarification rather than preloading the repository.

## Durable project notes

These are reference material, not a mandatory startup bundle:

- `PROJECT_STATE.md` — compact repository/product snapshot; verify its baseline.
- `ARCHITECTURE_DECISIONS.md` — invariants and accepted design decisions.
- `IMPLEMENTATION_STATUS.md` — feature-level implementation status.
- `REQUIREMENTS_TRACEABILITY.md` — requirement-to-implementation index.
- `KNOWN_ISSUES.md` — confirmed documentation/implementation discrepancies.
- `sessions/SESSION_TEMPLATE.md` — handoff format for incomplete or substantial work.
- `TASK_BRIEF_TEMPLATE.md` — optional way to scope a task before handing it to another session.

## Working rules

- Distinguish source implementation, automated test coverage, deployment and runtime verification.
- A schema, UI control, placeholder method or audit event does not prove a feature works.
- Inspect callers and affected dependencies; preserve documented data-integrity and security invariants.
- Never claim org-side configuration or runtime behaviour was inspected without evidence.
- Update only the relevant status/continuity notes when the change materially changes them. Do not create documentation churn for trivial edits.
- Do not deploy, merge, or change external systems without explicit authorization.
- Do not infer the status of independently managed workstreams. Incorporate them only after their owner supplies an explicit handoff.

## Fresh-session prompt

> Work on the specific Housie task I provide. Start with `AGENTS.md` and `.project/README.md`, select the relevant workstream guide, verify the current branch and commit, then inspect only the necessary files and requirement sections. Expand context only if the task is cross-cutting. State evidence and verification limits clearly. Do not deploy, merge, or modify external systems without explicit authorization.
