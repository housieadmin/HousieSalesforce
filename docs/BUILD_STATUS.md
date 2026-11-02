# Build status and release gate

This branch adds the first usable board-management vertical slice and repairs the deployment failures reported in `deploy_errors.txt`. It is still not a verified production release: no Salesforce CLI or connected Developer Org was available in this environment, so compilation, deployment and Apex runtime tests remain unverified.

## Implemented in this branch

- Salesforce DX project layout, package manifest, deploy/bootstrap scripts and test runner.
- Authenticated Housie account custom object and infrastructure-only operation-lock custom object.
- Big Object metadata for the 15 non-account logical entities plus technical `Operation_Journal__b`.
- Apex-generated 128-bit random account/context keys and 32-character record IDs.
- Apex Big Object persistence, operation journal, single-row write lock and commit-status reads.
- Account creation service and route-context resolver.
- Board lifecycle slice:
  - create board with a configuration snapshot;
  - create its initial `WAITING` game;
  - create the owner's `BOARD_ADMIN` membership;
  - list a user's active board memberships;
  - join a board using its random board ID as the private invitation token;
  - list and search public boards, then join without a private invitation;
  - leave a board only when it has no active game participation.
- Experience Cloud application shell and board hub LWC.
- Developer-only simulation panel and permission-set starting points.
- Ticket-layout and wallet/share helper tests.

## Deployment errors addressed

See `docs/DEPLOYMENT_ERRORS_FIXED.md`. The repair covers the reserved Apex method name, all callers, Big Object journal query/index alignment, malformed index metadata, duplicate journal field, LongTextArea visible-line metadata and the misnamed custom-object tab file.

## Not yet implemented / production blockers

- Full human ticket purchase, wallet holds, withdrawal and withdrawal-driven bot-offer cancellation.
- Bot offer creation, equal-share revision acceptance, hold adjustment and conversion.
- Start/pause/resume approval requests and frozen cancellation electorate/voting.
- Number-call engine, admin presence/rotation and pause/recovery.
- Manual/automatic ticket marking, claims, closure boundaries, disqualification and payouts.
- Game-wallet ledger settlement, cancellations, refunds, rewards and reconciliation.
- Experience Cloud site/ExperienceBundle, site activation, page routing, guest profile deployment and branding; site setup is org-specific.
- Account URL token expiry, revocation, authentication and replay controls. The current random account key acts as a bearer secret and must be protected.
- Durable repair worker for `PENDING` operation journals.
- Full integration/security/concurrency/load testing in the target Developer Org.

Do not expose guest access or process points/financial-style operations until these workflows and controls are completed and verified.

## Consistency note

Big Object writes are non-transactional and `Database.insertImmediate()` permits partial success. Apex serializes business commands through the infrastructure lock and writes a `COMMITTED` journal marker last. Application reads reject records belonging to non-committed operation IDs. This is fail-closed application visibility, not rollback or native multi-record atomicity. An interrupted operation can leave physically stored records behind under a `PENDING` journal entry.
