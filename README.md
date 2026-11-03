# Housie Salesforce DX

Salesforce DX project for Housie, built against the supplied build.md, final_data_model.md and final_spec.md.

## Quick start

Prerequisites: Salesforce CLI (sf), a Developer Org with Big Objects and Experience Cloud enabled/available, and an org alias.

    sf org login web --alias housie-dev --instance-url https://login.salesforce.com
    chmod +x scripts/*.sh
    ./scripts/deploy.sh housie-dev
    ./scripts/run-tests.sh housie-dev

The deploy script deploys the wildcard manifest and initializes the singleton infrastructure lock record.

After deployment:
1. Assign Housie_Super_Admin only to trusted platform operators.
2. Assign Housie_Developer only to developers.
3. Ensure the HOUSIE_SUPER_ADMIN and HOUSIE_DEVELOPER custom permissions remain restricted to the intended users.
4. Configure Experience Cloud pages and record context in the target org.
5. Ensure the user/site runtime can resolve the current Housie account context; do not solve this by granting broad guest read access to all account records.
6. Do not grant guest users account creation, wallet, admin or simulation permissions.
7. Configure account invitation/session security before public launch.

## Current vertical slices

- Account setup: admin account creation, default points/consumables and signup ledger grants. Account creation, Big Object grants and activation run in separate Apex requests.
- Boards: create a board and initial WAITING game, owner membership, private board-ID invitation, public directory search/join, active membership listing and leave checks.
- Human tickets: server-generated valid 90-ball layouts, manual/automatic purchase in WAITING games, account wallet holds, resource ledger entries, own-ticket display and pre-start human withdrawal/release. A DML-only command preparation, Big Object-only persistence and DML-only completion sequence keeps insertImmediate callouts out of transactions with pending record updates. A persistent per-game command gate prevents a second ticket/withdrawal command from running until the first is finalized; prepared commands remain visible and retryable. Withdrawal keeps points reserved until the Big Object hold releases are verified.

A purchased ticket is not yet playable: game-start approvals, hold capture, number calls, marking, claims and settlement remain unimplemented. The full scope and release gate are tracked in docs/BUILD_STATUS.md.

## Deployment errors

The 51-error deployment report and its mapping are documented in docs/DEPLOYMENT_ERRORS_FIXED.md.

## Architecture caveat

Big Objects are non-transactional. Apex validation, the infrastructure lock and operation journal provide serialized writes and fail-closed visibility; they do not provide rollback of successful Big Object writes. See docs/ARCHITECTURE.md and docs/BUILD_STATUS.md.

## Project layout

- force-app/main/default/objects: account, infrastructure lock and Big Object metadata
- force-app/main/default/classes: Apex services and tests
- force-app/main/default/lwc: Experience Cloud application, board hub, account admin and developer simulation
- force-app/main/default/permissionsets: permission-set starting points
- manifest/package.xml: deployment manifest
- scripts: deploy, bootstrap and test scripts
- docs: architecture, data mapping, deployment fixes and build status
