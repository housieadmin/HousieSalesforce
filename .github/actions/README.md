# Reusable Salesforce GitHub Actions

These composite actions provide shared Salesforce CLI setup and JWT authentication. They intentionally do not implement deploy, retrieve, Apex test, or browser behavior; each workflow owns its operation and safety gates.

## Setup

```yaml
- uses: ./.github/actions/setup-salesforce-cli
  with:
    version: latest # Pin a tested CLI version when reproducibility requires it.

- uses: ./.github/actions/salesforce-jwt-auth
  with:
    jwt_key: ${{ secrets.SF_JWT_KEY }}
    client_id: ${{ secrets.SF_CLIENT_ID }}
    username: ${{ secrets.SF_USERNAME }}
    instance_url: ${{ vars.SF_INSTANCE_URL }}
    alias: ${{ vars.SF_ORG_ALIAS || 'housie-dev' }}
```

## Configuration contract

- Required secrets: `SF_JWT_KEY`, `SF_CLIENT_ID`, `SF_USERNAME`.
- Required repository/environment variable: `SF_INSTANCE_URL`.
- Optional variable: `SF_ORG_ALIAS`; Housie's workflows default it to `housie-dev`. Other projects should set their own alias.
- The JWT action accepts all credentials, endpoint, alias, and default-org behavior as inputs. No Housie-specific org name is embedded in either composite action.
- Authentication state is scoped to the GitHub Actions runner/job. A later job must authenticate independently; do not assume org sessions are shared across jobs.
- The JWT key is written with restrictive permissions to the runner temp directory and removed after authentication.

## Capability boundaries

- Salesforce CLI workflows own metadata deployment, restore, retrieve, validation and Apex tests.
- Browser workflows own Playwright/browser navigation and UI evidence.
- Cross-capability workflows compose reusable workflows in sequence. They should pass configuration explicitly and retain separate CLI and browser execution contexts.
