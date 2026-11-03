# Product & architecture workstream

## Scope
Product behaviour, requirements interpretation, feature prioritization, user journeys, UX decisions, domain concepts and technology-independent logical data model.

## Read for a small task
- The relevant section(s) of `docs/SPEC.md`.
- The affected product/UI documentation or source only if needed to understand current behaviour.
- Relevant section(s) of `docs/DATA_MODEL.md` only when entities, relationships or integrity rules are involved.

Do not read the full specification or implementation status matrix for a wording clarification or isolated product decision.

## Read for a feature or broad design
- Relevant SPEC and DATA_MODEL sections, including related flows and invariants.
- `.project/ARCHITECTURE_DECISIONS.md` if the decision constrains implementation.
- `.project/IMPLEMENTATION_STATUS.md` and `.project/REQUIREMENTS_TRACEABILITY.md` to understand current coverage.
- Relevant technical architecture docs when Salesforce constraints affect the product choice.

## Boundaries and invariants
- `docs/SPEC.md` is the product behaviour authority; `docs/DATA_MODEL.md` is the logical schema authority.
- Keep product requirements technology-independent unless a Salesforce constraint is explicitly part of the decision.
- Distinguish required behaviour from current implementation and from future proposals.
- Record durable cross-cutting decisions; do not turn every discussion into an architecture decision record.

## Completion and handoff
Update SPEC/DATA_MODEL only when the canonical requirement or logical model changes. Update traceability/status when a material feature status changes. Leave implementation details to the Salesforce workstream and release mechanics to release engineering.
