# Housie project continuity

This directory is the operational continuity layer for work across ChatGPT sessions and contributors. It is not a replacement for product or technical source documents.

## Read order for a new session

1. Read this file.
2. Read [PROJECT_STATE.md](PROJECT_STATE.md) for the current verified baseline and active work.
3. Read [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md) before proposing structural changes.
4. Read [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) and [REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md) before selecting work.
5. Read [KNOWN_ISSUES.md](KNOWN_ISSUES.md) before changing affected areas.
6. Read the relevant source files and tests. These project notes are an index, not a substitute for source inspection.

## Source-of-truth hierarchy

1. `docs/SPEC.md` — authoritative product behaviour and requirements.
2. `docs/DATA_MODEL.md` — authoritative logical entities, relationships and integrity rules.
3. Current source code and metadata under `force-app/` — authoritative implementation.
4. `docs/ARCHITECTURE.md`, `docs/DATA_MODEL_MAPPING.md` — technical mapping and architecture, subject to verification against current source.
5. `docs/BUILD_STATUS.md`, this `.project/` directory and other operational docs — status/continuity aids. Update them when implementation changes; they do not override the sources above.

If sources conflict, do not silently choose one. Record the conflict in `KNOWN_ISSUES.md`, identify the correct authority, and propose a correction.

## Working rules

- Work from the current repository state and branch. Verify the current default-branch SHA before relying on a recorded baseline.
- Separate **implemented**, **partially implemented**, **not implemented**, **verified at runtime**, and **not verified**. Compilation or PR validation is not runtime verification.
- Do not mark a feature complete because a schema, field, UI control, placeholder method or audit event exists.
- For each change, inspect callers, data model implications, permissions, tests, deployment workflow and runtime verification path.
- Preserve append-only history, idempotency, wallet integrity and Big Object consistency constraints.
- Do not claim org-side configuration or runtime behaviour has been inspected unless evidence is available.
- Keep session notes short and durable. Record decisions and state changes, not a transcript.
- Before ending a work session, update the relevant status/issue docs and add a handoff using `sessions/SESSION_TEMPLATE.md` when work is incomplete.

## Scope boundary

This continuity layer tracks the repository's product and engineering work. Separate debugging efforts are not automatically in scope. Only incorporate an external workstream when its owner supplies a status update and evidence; label it as externally managed rather than inferring its state.

## Starting prompt for a fresh session

> Continue work on Housie Salesforce. First read `.project/README.md`, `.project/PROJECT_STATE.md`, `.project/IMPLEMENTATION_STATUS.md`, `.project/REQUIREMENTS_TRACEABILITY.md`, `.project/ARCHITECTURE_DECISIONS.md`, and `.project/KNOWN_ISSUES.md`. Treat `docs/SPEC.md` and `docs/DATA_MODEL.md` as the authoritative product and logical-data baselines. Verify the current Git branch and commit before acting. Do not assume previous chat context is current. State what is verified, what is uncertain, and the smallest sensible next step before making changes. Do not deploy, merge, or modify external systems without explicit authorization.
