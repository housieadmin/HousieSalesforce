# Build status and release gate

This is a generated Salesforce DX implementation baseline, not a verified production release.

Implemented in this project:
- DX project layout and package manifest.
- Account and infrastructure-lock custom objects.
- Big Object metadata for the 15 non-account entities plus technical operation journal.
- Apex ID generation, wallet/ticket validation helpers, dynamic Big Object persistence, operation journal, account creation, route resolution, command/simulation entry points.
- LWC application shell, authenticated account-admin component and developer simulation component.
- Permission-set starting points, test class, bootstrap and deploy scripts.

Not yet complete / must be finished before production:
- Full business workflows for every requirement in `final_spec.md` (ticket purchase/holds, board membership, bot offer acceptance revisions, draw engine, admin rotation/presence, claims closure, voting thresholds, wallet settlement, chat retention).
- Correct latest-version/projection read model for each Big Object and committed-journal filtering in every read path.
- Recovery/reconciliation worker for PENDING operations.
- Experience Cloud ExperienceBundle, site, route configuration, guest profile permissions and branding; site setup is org-specific.
- Invitation/session security (expiry, revocation, authentication, replay protection); the current opaque account key must not be treated as a secure login.
- End-to-end concurrency, governor-limit, partial-write, guest-user and deployment testing in a real Developer Org.
- Review and correct any metadata/API-version incompatibilities surfaced by target-org validation.

Do not expose guest access or run financial operations until these items are completed and tested.
