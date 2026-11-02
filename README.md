# Housie Salesforce DX

Salesforce DX baseline for Housie, built around the supplied `build.md`, `final_data_model.md` and `final_spec.md`.

## Quick start

Prerequisites: Salesforce CLI (`sf`), a Developer Org with Big Objects and Experience Cloud enabled/available, and an org alias.

```bash
sf org login web --alias housie-dev --instance-url https://login.salesforce.com
chmod +x scripts/*.sh
./scripts/deploy.sh housie-dev
./scripts/run-tests.sh housie-dev
```

After deployment:
1. Assign `Housie_Super_Admin` only to trusted platform operators.
2. Assign `Housie_Developer` only to developers.
3. Configure the `HOUSIE_SUPER_ADMIN` and `HOUSIE_DEVELOPER` custom permissions referenced by Apex (create matching Custom Permissions and include them in the permission sets before production use).
4. Configure Experience Cloud and add `housieApp` to a site page.
5. Configure the `Housie_Account__c` record page for authenticated account administration.
6. Do not grant guest users account creation, wallet, admin or simulation permissions.
7. Configure token/session security before public launch.

## Architecture caveat

Big Objects are non-transactional. Apex validation and the operation journal provide serialized writes and fail-closed visibility; they do not provide rollback of successful Big Object writes. See `docs/ARCHITECTURE.md` and `docs/BUILD_STATUS.md`.

## Files

- `force-app/main/default/objects`: account, lock, and Big Object metadata
- `force-app/main/default/classes`: Apex services and tests
- `force-app/main/default/lwc`: Experience Cloud app shell, account admin, simulation panel
- `force-app/main/default/permissionsets`: permission-set starting points
- `manifest/package.xml`: deployment manifest
- `scripts`: deploy, bootstrap and test scripts
- `docs`: architecture, data mapping and implementation status
