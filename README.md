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

## GitHub Actions deployment

The repository includes `.github/workflows/salesforce.yml`:

- Pull requests targeting `main` authenticate to the Developer Edition org, perform a metadata dry-run, and then run all local Apex tests.
- A push to `main` deploys the manifest to the GitHub Environment named `development`, bootstraps the infrastructure lock, and runs all local Apex tests.
- A manual workflow dispatch runs validation only; Developer Edition deployment remains restricted to pushes to `main`.

### Test and coverage behavior

This pipeline targets a Salesforce Developer Edition org. Developer Edition is a development environment, so the metadata deployment uses `NoTestRun`; Apex tests are then executed as a separate required step using `sf apex run test --test-level RunLocalTests`. This keeps test execution mandatory without making the deployment command enforce the org-wide 75% deployment coverage threshold.

This is an intentional development-org workflow, not a production deployment policy. Before deploying Apex to a production org, restore Salesforce's required deployment test level and satisfy the applicable 75% coverage requirements. A green CI run here does not certify production deployment readiness.

### One-time GitHub configuration

Configure these repository or environment settings before enabling the workflow:

**Repository Actions secrets**
- `SF_CLIENT_ID`: Salesforce Connected App / External Client App consumer key.
- `SF_USERNAME`: Salesforce integration user username.
- `SF_JWT_KEY`: the PEM private key matching the certificate uploaded to the Salesforce app.

**Repository Actions variable**
- `SF_INSTANCE_URL`: the Developer Edition org's My Domain login URL (for example, `https://your-domain.my.salesforce.com`).

Set the three secrets and the variable under **Settings → Secrets and variables → Actions**. Also create **Settings → Environments → development** and restrict deployments to the `main` branch. The workflow reads the secrets and variable at repository scope; the environment is used to gate deployment to `main`. Use a dedicated integration user with only the permissions required to deploy metadata and execute tests. Do not use a personal admin account.

### Salesforce JWT setup

Create a Salesforce Connected App (or External Client App) configured for OAuth JWT bearer flow. Upload the public certificate corresponding to `SF_JWT_KEY`, enable the JWT bearer flow, and authorize the integration user for the app. Confirm the user's profile/permission sets allow metadata deployment and Apex test execution. The private key must exist only in GitHub Actions secrets, never in the repository.

### First deployment

After configuring the secrets/variable and environment, open a pull request to `main` to exercise validation. Merge only after validation succeeds. The merge push triggers the Developer Edition deployment. Review the GitHub Actions run and Salesforce deployment result before treating the release as successful.

**Important:** the workflow deploys metadata plus the singleton infrastructure-lock bootstrap only. It does not create Experience Cloud sites, activate a site, provision users, configure domains, or set org-specific sharing/guest settings. Those remain manual org setup and security review tasks. The application is not production-ready until the outstanding functional and security blockers in `docs/BUILD_STATUS.md` are resolved.
