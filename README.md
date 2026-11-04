# Housie Salesforce DX

Salesforce DX project for Housie. The canonical product requirements are in [`docs/SPEC.md`](docs/SPEC.md), and the technology-independent logical data model is in [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

## Quick start

Prerequisites: Salesforce CLI (`sf`), a Developer Org with Big Objects and Experience Cloud enabled/available, and an org alias.

```bash
sf org login web --alias housie-dev --instance-url https://login.salesforce.com
chmod +x scripts/*.sh
./scripts/deploy.sh housie-dev
sf apex run --target-org housie-dev --file scripts/bootstrap.apex  # initial setup only
./scripts/run-tests.sh housie-dev
```

The deploy script deploys the application manifest. Bootstrap the singleton infrastructure lock once during initial setup (or explicitly when repairing/reinitializing infrastructure).

After deployment:
1. Assign `Housie_Super_Admin` only to trusted platform operators.
2. Assign `Housie_Developer` only to developers.
3. Ensure the `HOUSIE_SUPER_ADMIN` and `HOUSIE_DEVELOPER` custom permissions remain restricted to the intended users.
4. Configure Experience Cloud and add `housieApp` to a site page.
5. Configure the `Housie_Account__c` record page for authenticated account administration.
6. Do not grant guest users account creation, wallet, admin or simulation permissions.
7. Configure account invitation/session security before public launch.

## Implemented source slices

- **Account setup:** admin account creation, default points/consumables and signup ledger grants. Account creation, Big Object grants and activation run in separate Apex requests.
- **Boards:** create a board and initial WAITING game, owner membership, private board-ID invitation, public directory search/join, active membership listing and leave checks.
- **Human tickets:** server-generated 90-ball layouts, manual/automatic mode selection, WAITING-game purchase, account wallet holds and resource ledger entries, own-ticket display, and pre-start human withdrawal/release. Ticket purchase/withdrawal uses DML-only preparation, Big Object-only persistence and DML-only completion, with a durable per-game command gate and retryable prepared commands.

These are implemented source paths, not a claim that the product is playable. The current game command endpoint only records a COMMAND_RECEIVED event; it does not execute start, pause, resume, draw, marking, claim or settlement actions. HousieScheduler now dispatches recovery work when scheduled; it is not a game runtime, and this PR does not install a CronTrigger. See the [recovery runbook](docs/RECOVERY.md).

**A purchased ticket is not yet playable.** Game-start approvals and wallet capture, bot funding, number calling, marking, claims and settlement remain incomplete. See [build status](docs/BUILD_STATUS.md) and the [delivery milestones](.project/MILESTONES.md).


## Architecture caveat

Big Object writes are non-transactional. The writer uses `Database.insertImmediate()` and a PENDING/COMMITTED operation journal; it does not acquire the standard-object infrastructure lock. DML-only preparation/finalization paths may use that lock, and ticket purchase/withdrawal uses a durable per-game command gate where cross-request ordering is required. The journal provides fail-closed visibility, not database rollback or multi-record atomicity. See [architecture](docs/ARCHITECTURE.md).

## Project layout

- `force-app/main/default/objects`: account, infrastructure lock and Big Object metadata
- `force-app/main/default/classes`: Apex services and tests
- `force-app/main/default/lwc`: Experience Cloud application, board hub, account admin and developer simulation
- `force-app/main/default/permissionsets`: permission-set starting points
- `manifest/package.xml`: routine application deployment (Apex, objects and LWC)
- `manifest/package-org-setup.xml`: permission sets, custom tabs and custom permissions
- `manifest/package-experience.xml`: Experience Cloud bundles and network configuration
- `scripts`: deploy, bootstrap and test scripts
- `docs`: product specification, data model, architecture, workflow operations, recovery runbook and build status
- `.project/MILESTONES.md`: ordered delivery roadmap and acceptance criteria

## GitHub Actions

Salesforce CI/CD separates PR validation, manual validation, feature-branch AI iteration deployments/restores, controlled release deployment, browser verification and org-to-Git metadata sync. Owner-only issue-comment commands on issue #11 support deploy, deploy-and-verify, restore and retrieve operations.

See the [GitHub Actions operations guide](docs/GITHUB_ACTIONS.md) for workflow usage, command formats, required GitHub/Salesforce configuration, security boundaries, test limitations and troubleshooting.
