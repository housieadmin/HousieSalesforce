# Housie project context router

This is a lightweight continuity layer for work across ChatGPT sessions. Start from the task, not from the full project history.

## How to use the workstreams

The four workstreams are **context groupings, not separate teams or mandatory workflow stages**. One person may use several ChatGPT Projects to keep sessions focused; the repository is the shared source of truth.

A session should normally stay with its task until it reaches a useful stopping point. It can investigate, implement, test, deploy when explicitly authorized, and debug iteratively—even when the work touches more than one discipline. Do not create a handoff or involve another workstream merely because the task crosses a category boundary.

Use another workstream or session when it provides a concrete benefit: parallel investigation, specialist context, independent verification, or a genuinely different task. Consultation is optional, not a gate.

## Start here

1. Read this file and the repository rules in `AGENTS.md`.
2. Verify the current branch and commit.
3. Select the **primary context** below and read its guide.
4. Inspect only the affected source, tests and relevant requirement sections.
5. Add other context only when it helps solve the task.

## Workstream routing

| Task concerns | Read |
|---|---|
| Product behaviour, requirements, scope, UX and logical entities | [Product](workstreams/product.md) |
| Apex, LWC, Salesforce metadata, permissions and data access | [Salesforce development](workstreams/salesforce.md) |
| Test strategy, browser agent, QA scenarios and regression evidence | [QA & automation](workstreams/qa.md) |
| GitHub Actions, issue/PR commands, branching, validation and release | [Release engineering](workstreams/release-engineering.md) |

For a task spanning multiple areas, start with the most useful guide and add only the context needed. Do not read all four by default.

## Sources of truth

- `docs/SPEC.md` — authoritative product behaviour and requirements.
- `docs/DATA_MODEL.md` — authoritative logical entities, relationships and integrity rules.
- Current source and metadata — authoritative implementation.
- Technical documentation — useful context; verify it against current source.
- GitHub issues, commits and PRs — durable record of task status, decisions and evidence.

Read relevant SPEC/DATA_MODEL sections, not the entire files, unless the task is broad or cross-cutting. If sources conflict, identify the conflict instead of silently choosing one.

## Context depth

- **Small/local change:** this router, one workstream guide, affected files and nearby tests.
- **Feature/multi-file change:** also inspect relevant SPEC/DATA_MODEL sections, callers, dependencies, permissions and tests.
- **Cross-cutting/architectural change:** expand to the relevant technical architecture docs and any additional project evidence the task requires.
- **Unclear task:** ask one focused clarification rather than preloading the repository.

## Working rules

- **PR-first Git rule:** Never commit or use the GitHub Contents API to write directly to `main`, including for documentation, session notes, or emergency cleanup. Create or use a task-specific feature branch from the latest `main`, make all related changes there, and open/update a PR targeting `main`. Keep follow-up edits on that PR branch. Do not rewrite or force-update `main`; do not merge without explicit authorization and required checks.
- **Task-scope rule:** The user's stated objective defines the task scope. Do not expand the work into unrelated bug fixes, refactoring, or coding-practice improvements. If an unrelated issue is discovered, report it with evidence and wait for authorization before changing it.
- Treat workstreams as optional context aids, not ownership boundaries. A session may carry a task end-to-end.
- Keep iterative debugging in the active session; do not create formal handoffs for every change, deployment or test cycle.
- Use QA scenarios and independent review when they add confidence. They are not mandatory approval stages for every fix.
- Use release-engineering context when GitHub/deployment mechanics are the problem, not for every deployment performed during development.
- Preserve useful findings in GitHub or the relevant source docs when they are durable and likely to help future sessions. Do not record every failed attempt or transient debugging detail.
- Distinguish source implementation, automated test coverage, deployment and runtime verification.
- A schema, UI control, placeholder method or audit event does not prove a feature works.
- Preserve relevant data-integrity and security constraints.
- Never claim org-side configuration or runtime behaviour was inspected without evidence.
- Update only continuity notes materially affected by the change. Avoid documentation churn for trivial edits.
- Do not deploy, merge or change external systems without explicit authorization.
- For substantial incomplete work that genuinely needs another session to continue, leave a concise handoff using `sessions/SESSION_TEMPLATE.md`.

## Fresh-session prompt

> Work on the specific Housie task I provide. Start with `AGENTS.md` and `.project/README.md`, select the most relevant workstream guide, verify the current branch and commit, then inspect only the necessary files and requirement sections. Stay with the task through investigation, implementation and verification where useful; bring in other workstream context only when it adds value. State evidence and verification limits clearly. Do not deploy, merge or modify external systems without explicit authorization.
