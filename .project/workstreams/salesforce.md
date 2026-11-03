# Salesforce development workstream

## Scope
Apex services, Lightning Web Components, Salesforce objects and fields, Big Objects, metadata, permission sets, security, deployment compatibility and org-facing implementation.

## Small task
- Inspect directly affected Apex/LWC/metadata files and nearby tests.
- Read relevant SPEC section(s) for the behaviour being changed.
- Read relevant DATA_MODEL section(s) only when data shape, relationships or integrity are affected.
- Inspect callers and permission/access paths for changed code.

Avoid loading the entire product spec or unrelated workflow documentation for a localized fix.

## Feature or cross-cutting change
- Follow the affected request/data path across UI, controller/service, persistence and permissions.
- Inspect relevant tests, deployment manifests and metadata dependencies.
- Consult `docs/ARCHITECTURE.md` and `docs/DATA_MODEL_MAPPING.md` for relevant technical constraints, verifying them against source.
- Inspect current implementation/status evidence only for the affected feature area.

## Iterative problem-solving

This session can own a Salesforce issue end-to-end: reproduce and diagnose it, inspect org/repository constraints, change code or metadata, run tests, deploy when explicitly authorized, and continue debugging based on observed results. Repeated fix/deploy/verify cycles are normal for complex Salesforce problems; do not turn each cycle into a formal handoff.

Use QA scenarios or another session for independent reproduction/review when that will expose assumptions or increase confidence. Use release-engineering context when the deployment pipeline or GitHub automation itself needs investigation. Neither is a mandatory gate for ordinary development work.

Keep the issue/PR updated with durable findings, the relevant commit/build, test evidence and remaining uncertainty. Do not dump every transient attempt into project documentation.

## Boundaries
- Current Salesforce source/metadata is authoritative for what is implemented; docs do not prove runtime behaviour.
- Big Object writes are not transactional with ordinary Salesforce DML. Preserve the actual transaction and recovery semantics.
- Preserve idempotency, wallet accounting, append-only history, snapshot semantics and authorization boundaries where applicable.
- Do not infer live org configuration from repository metadata.
- A successful compile or deployment is not end-to-end runtime verification.

## Completion
Add or update focused tests. Record exactly what was tested and what remains unverified. Update continuity notes only when implementation evidence materially changes. Do not deploy unless explicitly authorized.
