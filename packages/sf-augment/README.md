# sf-augment

Reusable, project-independent Salesforce development and automation helpers.

- Keep project names, org aliases, paths, URLs, credentials and policies in the consuming application.
- Prefer Salesforce CLI, Playwright and npm directly; add code only for reusable gaps.
- Keep each exported function focused and independently testable.
- Pass project-specific values as arguments or environment variables.
- Run `npm test` before contributing.

## Reuse

This is a standalone npm workspace package. To reuse it in another Salesforce repository, copy the `sf-augment` directory into that repository's `packages/` directory, add `packages/*` to npm workspaces, and declare the package as a dependency.

The canonical source is maintained in the standalone `housieadmin/sf-augment` repository. Keep this embedded copy synchronized with that source.
