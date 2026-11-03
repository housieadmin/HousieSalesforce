# GitHub Actions operations guide

This guide explains how to operate the Salesforce workflows in this repository. The workflows are deliberately separated: validating code, deploying metadata, and retrieving metadata from the org are different operations with different permissions and risks.

## Workflow overview

| Workflow | Trigger | What it does | What it does not do |
|---|---|---|---|
| **Salesforce PR Validation** | Pull request targeting `main` | Checks out the PR head, dry-run validates `manifest/package.xml`, then runs local Apex tests in the Developer Edition org | Does not deploy metadata |
| **Salesforce Manual Validation** | Manually dispatched from `main` | Validates a selected branch or PR ref against a selected manifest; can optionally run local Apex tests | Does not deploy metadata |
| **Salesforce AI Iteration Deploy** | Manually dispatched from `main` | Deploys explicitly selected source paths from a pushed feature branch or commit to Developer Edition | Does not merge code or write to `main`; does not deploy the whole project by default |
| **Salesforce AI Iteration Restore** | Manually dispatched from `main` | Redeploys explicitly selected metadata paths from a known-good Git ref | Does not reverse data changes, Apex side effects, or destructive metadata changes |
| **Salesforce Controlled Deployment** | Manually dispatched from `main` | Deploys one selected release manifest after explicit confirmation and pre-deployment checks | Does not deploy arbitrary feature branches; does not run automatically on merge |
| **Salesforce Org Metadata Sync** | Manually dispatched from `main` | Retrieves an allowlisted manifest from Salesforce and opens a PR with changes | Does not write directly to `main` or approve/deploy retrieved changes |

All workflow definitions are taken from `main` when manually dispatched. Keep workflow changes reviewed and merged before relying on them operationally.

## 1. Pull request validation

When a PR targets `main`, **Salesforce PR Validation**:

1. Checks out the PR head commit.
2. Installs Salesforce CLI and authenticates to the configured Developer Edition org.
3. Runs a metadata dry run for `manifest/package.xml` using `NoTestRun`.
4. Runs `sf apex run test --test-level RunLocalTests` against tests already present in the org.

A successful dry run means Salesforce accepted the selected metadata for validation against the target org. It is not a deployment.

**Security boundary:** this workflow authenticates to Salesforce while processing PR code. GitHub does not expose repository secrets to ordinary fork-originated `pull_request` workflows, but same-repository PR workflows can access configured secrets. Treat branches and contributors with access to this workflow as trusted. Do not enable this pattern for untrusted contributors without redesigning validation so untrusted PR code cannot access Salesforce credentials.

## 2. Manual validation

Use this when you want to validate a branch/PR ref or a manifest other than the default application manifest without deploying it.

1. Open **Actions → Salesforce Manual Validation → Run workflow**.
2. Keep the workflow branch/ref set to `main`. The workflow definition must come from `main`.
3. Set **Source ref** to a branch name (for example, `feature/my-change`) or a pull request head ref (for example, `refs/pull/123/head`).
4. Select **Manifest scope**:
   - `application`: `manifest/package.xml`
   - `org-setup`: `manifest/package-org-setup.xml`
   - `experience`: `manifest/package-experience.xml`
   - `custom`: a specific XML manifest under `manifest/`
5. For `custom`, provide a safe path under `manifest/` ending in `.xml`.
6. Choose whether to run local Apex tests, then start the workflow.

The metadata operation is a dry run with `NoTestRun`. The optional Apex step runs local tests already deployed in the Developer Edition org. The workflow has no deployment step. Custom manifest paths are constrained to the `manifest/` directory.

## 3. AI iteration deployment

Use this workflow for the fast edit-deploy-test loop on a feature branch. It deploys selected source paths to the shared Developer Edition org without merging the branch or opening a PR.

1. Push the current working changes to a feature branch. The workflow cannot deploy uncommitted files from a ChatGPT session or local workspace.
2. Open **Actions → Salesforce AI Iteration Deploy → Run workflow**. The workflow ref must be `main`; this selects the trusted workflow definition.
3. Set **Source ref** to the pushed feature branch or exact commit SHA.
4. Enter one or more comma-separated or newline-separated paths, all under `force-app/`. Examples:
   - `force-app/main/default/classes/HousieBoardService.cls` — the workflow also includes its `-meta.xml` companion when present.
   - `force-app/main/default/lwc/housieBoardHub` — deploys the selected LWC bundle.
   - `force-app/main/default/objects/Housie_Account__c` — deploys the selected object's source folder.
   - Multiple paths can be supplied together, e.g. `force-app/main/default/classes/HousieBoardService.cls,force-app/main/default/lwc/housieBoardHub`.
5. Select the Apex test mode:
   - `none`: no Apex tests (appropriate for an isolated LWC-only change, but run relevant UI checks separately).
   - `specified`: enter one Apex test class name per line. The classes must be present in the deployed org after the metadata deployment.
   - `local`: run all local Apex tests already deployed in the org.
6. Type exactly `DEPLOY` and run the workflow.

The workflow validates the selected paths, performs a metadata dry run, deploys only those paths, then runs the selected test mode. It records the source ref, resolved commit, paths, and test mode in the run summary. It serializes with the controlled deployment and restore workflows so two runs cannot deploy to the shared org concurrently.

**Important:** push before dispatching. ChatGPT Desktop can edit locally, but GitHub Actions can only deploy a commit that exists in the repository. The AI session should commit/push its current iteration branch, dispatch this workflow, inspect the run and test output, then continue editing and repeat. Do not merge merely to test.

## 4. AI iteration restore

Use **Actions → Salesforce AI Iteration Restore → Run workflow** when a deployed component needs to be restored to a known-good version.

1. Set the workflow ref to `main`.
2. Enter a known-good branch, tag, or commit SHA in **Restore ref**.
3. Enter the exact component paths to restore, under `force-app/`.
4. Optionally run all local Apex tests after the restore.
5. Type exactly `RESTORE` and run the workflow.

This redeploys the selected source paths as they exist at the known-good ref. It is not a general rollback engine: it does not undo database/data changes, Apex execution side effects, external integrations, or destructive metadata changes. It also cannot restore a component that did not exist at the selected restore ref. For a newly created component that must be removed, use a separately reviewed destructive-change operation; do not infer deletion from an absent file.

Treat the Developer Edition org as shared mutable state. Concurrent AI sessions working on overlapping components can overwrite one another. The workflows serialize deployments, but they cannot prevent a later run from intentionally deploying a different version.

## 5. Controlled deployment

Deployment is intentionally manual. There is no push-to-`main` deployment trigger.

1. Merge the reviewed change to `main` only after required PR checks pass.
2. Open **Actions → Salesforce Controlled Deployment → Run workflow**.
3. Ensure the workflow ref is `main`.
4. Select one scope:
   - `application`: `manifest/package.xml`
   - `org-setup`: `manifest/package-org-setup.xml`
   - `experience`: `manifest/package-experience.xml`
5. Type exactly `DEPLOY` in the confirmation field and run the workflow.
6. Review the dry-run result, pre-deployment Apex test result, deployment result, and post-deployment Apex test result.

The job is restricted to `main`, uses the GitHub `development` Environment, and serializes deployments to avoid overlapping changes to the shared Developer Edition org. Configure required reviewers and branch restrictions on that Environment. A failed post-deployment test means the deployment may already have happened; investigate and repair forward rather than assuming the deployment was rolled back.

The workflow deploys only the selected metadata manifest. It does not run the infrastructure-lock bootstrap script, create or activate Experience Cloud sites, provision users, configure domains, or complete org-specific sharing and guest-user setup. Those remain explicit setup and security tasks.

## 6. Org-to-Git metadata sync

Use this when metadata in Salesforce needs to be brought back into source control.

1. Confirm the desired metadata members are explicitly listed in `manifest/package-retrieve.xml` (or another reviewed manifest under `manifest/`).
2. Open **Actions → Salesforce Org Metadata Sync → Run workflow** from `main`.
3. Type exactly `SYNC` and provide the retrieve manifest path.
4. Review the generated `automation/org-sync-<run-id>` branch and PR.

The workflow retrieves only the selected manifest. If there are no changes under `force-app/`, it exits without creating a PR. Otherwise it commits the retrieved metadata to an automation branch and opens a PR against `main`. Review the diff like any other code change; retrieval is not approval.

The starter retrieve manifest contains only `Housie_Account__c`. Expand it with exact members deliberately. Avoid wildcards unless broad retrieval is an intentional decision.

For this workflow to open PRs, repository Actions settings must allow read/write workflow permissions and allow GitHub Actions to create pull requests. The workflow itself requests only `contents: write` and `pull-requests: write`.

## 7. One-time GitHub configuration

Under **Settings → Secrets and variables → Actions**, configure:

| Name | Type | Purpose |
|---|---|---|
| `SF_CLIENT_ID` | Secret | OAuth consumer key for the Salesforce Connected App / External Client App |
| `SF_USERNAME` | Secret | Dedicated Salesforce integration-user username |
| `SF_JWT_KEY` | Secret | PEM private key matching the certificate uploaded to the Salesforce app |
| `SF_INSTANCE_URL` | Variable | Developer Edition My Domain login URL, e.g. `https://your-domain.my.salesforce.com` |

Also:

- Create **Settings → Environments → development** and restrict it to deployments from `main`; use required reviewers for controlled release deployments.
- Create **Settings → Environments → development-iteration** and restrict it to `main`. This environment is intentionally separate and should not require manual reviewers for every iteration; the workflow requires the explicit `DEPLOY` confirmation and serializes changes to the same Developer Edition org.
- For org sync, enable **Settings → Actions → General → Workflow permissions → Read and write permissions** and allow GitHub Actions to create pull requests.
- Use a dedicated integration user with only the permissions needed to deploy metadata and run Apex tests. Do not use a personal administrator account.
- Configure Salesforce JWT bearer OAuth, upload the matching public certificate, enable the flow, and authorize the integration user.
- Keep the private key only in GitHub Secrets. Never commit it to the repository.

The secrets and variable are read at repository scope. The `development` Environment is an additional deployment gate; it does not replace secret hygiene or least-privilege Salesforce permissions.

## 8. Understanding validation and Apex test results

Do not conflate these three checks:

- **Metadata dry run:** Salesforce validates the selected metadata against the target org without committing the deployment.
- **RunLocalTests:** executes tests already deployed in the Developer Edition org. It is useful as an org regression smoke test.
- **Branch-specific test execution:** the current workflows do **not** execute new or modified Apex test classes that exist only in an un-deployed branch/PR. A dry run can validate/compile metadata, but it does not run those branch test classes.

To execute branch-specific tests properly, use a disposable sandbox/scratch org or design a `RunSpecifiedTests` deployment validation that includes the branch's test classes and satisfies Salesforce per-class coverage rules. Do not claim that a green current PR run proves the new test classes passed.

This pipeline is configured for a Developer Edition development org. It uses `NoTestRun` for metadata validation/deployment and runs `RunLocalTests` separately. This is not a production deployment policy. Before deploying to production, use the required Salesforce deployment test level and meet applicable coverage requirements.

## 9. Troubleshooting

| Symptom | Likely cause / action |
|---|---|
| Authentication fails | Verify all three secrets and `SF_INSTANCE_URL`; check the JWT certificate, connected app authorization, username, and integration-user permissions |
| Manifest not found | Confirm the selected ref contains the manifest and the path is under `manifest/` |
| Dry run reports missing metadata | Add the missing dependency to the same manifest or deploy its prerequisite deliberately, then validate again |
| Apex tests fail | Inspect the test output and failing class; remember that `RunLocalTests` executes tests already in the org |
| Deployment is blocked before starting | Confirm dispatch from `main`, exact `DEPLOY` confirmation, Environment branch restrictions, and required approvals |
| Org sync cannot push/open a PR | Check workflow permissions, allow GitHub Actions to create pull requests, and confirm the workflow token has the requested permissions |
| Org sync reports no changes | The selected manifest may already match the org, or the retrieved differences may not affect tracked files under `force-app/` |

A green workflow is evidence only for the checks it actually ran. It does not prove end-to-end user journeys, Experience Cloud configuration, guest-user security, or production readiness. Track those separately in [BUILD_STATUS.md](BUILD_STATUS.md).

## Operating rules

- Never commit directly to `main`; use a feature or automation branch and a PR.
- Do not deploy unmerged feature branches into the shared Developer Edition org.
- Do not broaden retrieve manifests casually.
- Review org-sync diffs before merging.
- Treat the Developer Edition org as shared mutable state; avoid overlapping deployments and manual changes during a release.
- Never interpret a dry run as a deployment or an Apex smoke test as branch-specific test coverage.
