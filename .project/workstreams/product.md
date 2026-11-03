# Product & architecture workstream

## Scope
Product behaviour, requirements interpretation, feature prioritization, user journeys, UX decisions, domain concepts and the technology-independent logical data model.

## Small task
- Read the relevant section(s) of `docs/SPEC.md`.
- Read relevant `docs/DATA_MODEL.md` sections only when entities, relationships or integrity rules are involved.
- Inspect affected UI/source only when needed to understand current behaviour.

Do not read the full specification for a wording clarification or isolated product decision.

## Feature or broad design
- Read related SPEC and DATA_MODEL sections, including connected flows and invariants.
- Consult `docs/ARCHITECTURE.md` or `docs/DATA_MODEL_MAPPING.md` only when Salesforce constraints affect the decision.
- Inspect current implementation/status evidence for the affected feature before describing what exists.

## Boundaries
- `docs/SPEC.md` is the product behaviour authority; `docs/DATA_MODEL.md` is the logical schema authority.
- Keep product requirements technology-independent unless a Salesforce constraint is explicitly part of the decision.
- Distinguish required behaviour from current implementation and future proposals.
- Record only durable decisions that materially constrain future work.

## Completion
Update SPEC/DATA_MODEL only when canonical requirements or the logical model change. Leave implementation details to Salesforce development and release mechanics to release engineering.
