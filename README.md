# Housie Salesforce DX

Salesforce DX project for Housie, built against the supplied `build.md`, `final_data_model.md` and `final_spec.md`.

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
- `manifest/package.xml`: routine application deployment (Apex, objects and LWC)
- `manifest/package-org-setup.xml`: permission sets, custom tabs and custom permissions
- `manifest/package-experience.xml`: Experience Cloud bundles and network configuration
- `scripts`: deploy, bootstrap and test scripts
- `docs`: architecture, data mapping, deployment fixes and build status

## GitHub Actions control centre

The Salesforce automation is split by responsibility. Each workflow has a single purpose; none of the validation workflows can deploy metadata.

| Workflow | Trigger | Purpose |
|---|---|---|
| `.github/workflows/salesforce-pr-validation.yml` | Pull request to `main` | Dry-run validates the application manifest and runs local Apex tests |
| `.github/workflows/salesforce-manual-validation.yml` | Manual dispatch from `main` | Validates a selected branch or PR ref against a selected manifest; never deploys |
| `.github/workflows/salesforce-deploy.yml` | Manual dispatch from `main` | Explicitly deploys one approved scope to the Developer Edition org |
| `.github/workflows/salesforce-org-sync.yml` | Manual dispatch from `main` | Retrieves the dedicated allowlist and opens a PR with org changes |

### Manual validation

Open **Actions → Salesforce Manual Validation → Run workflow**. Keep the workflow ref on `main`, then provide:

- `source_ref`: a branch such as `feature/my-change`, or a pull request ref such as `refs/pull/123/head`.
- `manifest_scope`: `application`, `org-setup`, `experience`, or `custom`.
- `custom_manifest`: required only for `custom`; must be an XML file beneath `manifest/`.
- `run_apex_tests`: normally leave enabled.

The workflow checks out the requested source ref, performs a Salesforce metadata dry run with `NoTestRun`, and optionally runs all local Apex tests separately. It has no deploy step. The workflow definition itself is taken from `main`, not from the branch being validated.

### Controlled deployment

Deployment is deliberately manual and only runs when the workflow is dispatched from `main`. Choose the metadata scope and type `DEPLOY` into the confirmation input. The job uses the `development` GitHub Environment, which should be configured with required reviewers and restricted to `main`. It performs a dry run and Apex tests before deployment, then runs Apex tests again afterward.

There is no automatic deployment on push to `main`. Branches and PRs can be validated, but unmerged code cannot be deployed through this workflow. This is intentional: deploying arbitrary feature branches into one shared Developer Edition org can overwrite newer work and make the org's state unpredictable. No bootstrap script is run as part of deployment.

### Org-to-Git sync

Open **Actions → Salesforce Org Metadata Sync → Run workflow** from `main`, type `SYNC`, and choose the retrieve manifest. The workflow retrieves only the members listed in that manifest, creates an `automation/org-sync-<run-id>` branch, commits the retrieved diff, and opens a PR against `main`. If there is no diff, it exits without creating a PR. It never commits directly to `main`.

The starter `manifest/package-retrieve.xml` retrieves only `Housie_Account__c`. This is intentionally narrow. Add exact metadata members to this file as the sync scope expands; do not replace it with wildcards unless you deliberately want every matching component in the org to enter the review stream. Org sync is a retrieval mechanism, not an automatic approval or deployment mechanism.

### Manifest boundaries and dependencies

The routine application manifest intentionally contains Apex classes, custom objects and Lightning Web Components. Permission sets, custom tabs and custom permissions are separated into the org-setup manifest. ExperienceBundle and Network are separated into the Experience Cloud manifest so they are not pushed to the Developer Edition org on every application merge.

These are release boundaries, not claims that the groups are dependency-free. Salesforce metadata validation catches many missing compile-time and metadata references when the selected package is validated against the target org. If validation reports a missing component or dependency, add that component to the same deployment manifest (or deliberately deploy its prerequisite first), then rerun validation.

A successful dry run does not catch every runtime dependency. For example, Apex code that looks up a Custom Permission by a string API name, or application behavior that assumes a permission set/site is configured, may not create a deploy-time dependency that Salesforce can detect. Keep runtime configuration and access dependencies documented and test the actual user journeys after deployment. Do not treat a green metadata dry run as proof that permissions or Experience Cloud setup are complete.

### Test and coverage behavior

This pipeline targets a Salesforce Developer Edition org. Developer Edition is a development environment, so metadata validation and deployment use `NoTestRun`; Apex tests are executed as a separate step using `sf apex run test --test-level RunLocalTests`. This keeps test execution mandatory without making the metadata command enforce the org-wide 75% deployment coverage threshold.

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

After configuring the secrets/variable and environment, open a pull request to `main` to exercise application validation. Merge only after validation succeeds. The merge push triggers the application deployment. Use manual workflow dispatch from `main` for the separately managed org-setup and Experience Cloud manifests. Review the GitHub Actions run and Salesforce deployment result before treating a release as successful.

**Important:** the application workflow deploys application metadata only. The singleton infrastructure-lock bootstrap is a separate one-time setup/repair operation. It does not create Experience Cloud sites, activate a site, provision users, configure domains, or set org-specific sharing/guest settings. Those remain controlled setup and security review tasks. The application is not production-ready until the outstanding functional and security blockers in `docs/BUILD_STATUS.md` are resolved.
