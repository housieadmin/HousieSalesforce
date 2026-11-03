# Housie project context router

This is a lightweight continuity layer for work across sessions. Start from the task, not from the full project history.

## Start here

1. Read this file and the repository rules in `AGENTS.md`.
2. Verify the current branch and commit.
3. Select the **one primary workstream** below and read its guide.
4. Inspect only the affected source, tests and relevant requirement sections.
5. Expand context only when the task crosses workstreams or changes an architectural constraint.

## Workstream routing

| Task concerns | Read |
|---|---|
| Product behaviour, requirements, scope, UX and logical entities | [Product](workstreams/product.md) |
| Apex, LWC, Salesforce metadata, permissions and data access | [Salesforce development](workstreams/salesforce.md) |
| Test strategy, browser agent, QA scenarios and regression evidence | [QA & automation](workstreams/qa.md) |
| GitHub Actions, issue/PR commands, branching, validation and release | [Release engineering](workstreams/release-engineering.md) |

For a task spanning multiple areas, start with the primary guide and add only the other guide(s) needed. Do not read all four by default.

## Sources of truth

- `docs/SPEC.md` — authoritative product behaviour and requirements.
- `docs/DATA_MODEL.md` — authoritative logical entities, relationships and integrity rules.
- Current source and metadata — authoritative implementation.
- Technical documentation — useful context; verify it against current source.

Read relevant SPEC/DATA_MODEL sections, not the entire files, unless the task is broad or cross-cutting. If sources conflict, identify the conflict instead of silently choosing one.

## Context depth

- **Small/local change:** this router, one workstream guide, affected files and nearby tests.
- **Feature/multi-file change:** also inspect relevant SPEC/DATA_MODEL sections, callers, dependencies, permissions and tests.
- **Cross-cutting/architectural change:** expand to the relevant technical architecture docs and any additional project evidence the task requires.
- **Unclear task:** ask one focused clarification rather than preloading the repository.

## Working rules

- Distinguish source implementation, automated test coverage, deployment and runtime verification.
- A schema, UI control, placeholder method or audit event does not prove a feature works.
- Preserve relevant data-integrity and security constraints.
- Never claim org-side configuration or runtime behaviour was inspected without evidence.
- Update only continuity notes materially affected by the change. Avoid documentation churn for trivial edits.
- Do not deploy, merge or change external systems without explicit authorization.
- Do not infer the status of independently managed workstreams; incorporate them only after their owner supplies an explicit handoff.
- For substantial incomplete work, leave a concise handoff using `sessions/SESSION_TEMPLATE.md`.

## Fresh-session prompt

> Work on the specific Housie task I provide. Start with `AGENTS.md` and `.project/README.md`, select the relevant workstream guide, verify the current branch and commit, then inspect only the necessary files and requirement sections. Expand context only if the task is cross-cutting. State evidence and verification limits clearly. Do not deploy, merge or modify external systems without explicit authorization.
