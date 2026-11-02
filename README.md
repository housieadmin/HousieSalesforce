# Housie Salesforce DX

Salesforce DX project for Housie, built against the supplied `build.md`, `final_data_model.md` and `final_spec.md`.

## Quick start

Prerequisites: Salesforce CLI (`sf`), a Developer Org with Big Objects and Experience Cloud enabled/available, and an org alias.

```bash
sf org login web --alias housie-dev --instance-url https://login.salesforce.com
chmod +x scripts/*.sh
./scripts/deploy.sh housie-dev
./scripts/run-tests.sh housie-dev
```

The deploy script deploys the manifest and initializes the singleton infrastructure lock record.

After deployment:
1. Assign `Housie_Super_Admin` only to trusted platform operators.
2. Assign `Housie_Developer` only to developers.
3. Ensure the `HOUSIE_SUPER_ADMIN` and `HOUSIE_DEVELOPER` custom permissions remain restricted to the intended users.
4. Configure Experience Cloud and add `housieApp` to a site page.
5. Configure the `Housie_Account__c` record page for authenticated account administration.
6. Do not grant guest users account creation, wallet, admin or simulation permissions.
7. Configure account invitation/session security before public launch.

## Current vertical slice

The board hub supports board creation, initial WAITING-game creation, owner membership, current membership listing, private board-ID invitations, public board search/join and leaving when no active game participation exists. The board ID is the invitation secret; do not share an account key as a board invitation.

## Deployment errors

The attached 51-error deployment report has been analyzed and patched in this branch. The exact mapping is in `docs/DEPLOYMENT_ERRORS_FIXED.md`.

## Architecture caveat

Big Objects are non-transactional. Apex validation, the infrastructure lock and operation journal provide serialized writes and fail-closed visibility; they do not provide rollback of successful Big Object writes. See `docs/ARCHITECTURE.md` and `docs/BUILD_STATUS.md`.

## Project layout

- `force-app/main/default/objects`: account, infrastructure lock and Big Object metadata
- `force-app/main/default/classes`: Apex services and tests
- `force-app/main/default/lwc`: Experience Cloud application, board hub, account admin and developer simulation
- `force-app/main/default/permissionsets`: permission-set starting points
- `manifest/package.xml`: deployment manifest
- `scripts`: deploy, bootstrap and test scripts
- `docs`: architecture, data mapping, deployment fixes and build status
