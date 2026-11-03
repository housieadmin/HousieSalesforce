# Salesforce development workstream

## Scope
Apex services, Lightning Web Components, Salesforce objects and fields, Big Objects, metadata, permission sets, security, deployment compatibility and org-facing implementation.

## Read for a small task
- The directly affected Apex/LWC/metadata files and nearby tests.
- Relevant SPEC section(s) for the behaviour being changed.
- Relevant DATA_MODEL section(s) only when data shape, relationships or integrity are affected.
- Existing callers and permission/access paths for the changed code.

Avoid reading the entire product spec, all status documents or unrelated workflows for a localized UI or Apex fix.

## Read for a feature or cross-cutting change
- Follow the affected request/data path across UI, controller/service, persistence and permissions.
- Inspect relevant tests, deployment manifests and metadata dependencies.
- Read `.project/ARCHITECTURE_DECISIONS.md` for transactional, Big Object, idempotency, wallet or security-sensitive work.
- Consult implementation status, traceability and known issues only for the affected feature area.

## Boundaries and invariants
- Current Salesforce source/metadata is authoritative for what is implemented; docs do not prove runtime behaviour.
- Big Object writes are not transactional with ordinary Salesforce DML. Preserve documented phase separation and recovery semantics.
- Preserve idempotency, wallet accounting, append-only history, snapshot semantics and authorization boundaries where applicable.
- Do not infer live org configuration from repository metadata.
- A successful compile or deployment is not an end-to-end runtime verification.

## Completion and handoff
Add or update focused tests. Record exactly what was tested and what remains unverified. Update status/traceability only when implementation evidence materially changes. Do not deploy unless explicitly authorized.
