# Known issues and gaps

**Snapshot:** `main` at `5637e00fd0461ecc02f89c3db7b74d2407ee4ea9` (2026-11-03).  
This list is limited to issues independently established from repository review. Recheck before acting.

## KI-001 — README points to obsolete specification filenames

- **Evidence:** README introduction references `build.md`, `final_data_model.md` and `final_spec.md`.
- **Expected:** `docs/SPEC.md` and `docs/DATA_MODEL.md` are the authoritative files.
- **Impact:** New contributors/sessions may start from missing or obsolete documents.
- **Suggested action:** Correct README source references in a focused documentation change.

## KI-002 — BUILD_STATUS opening and validation claims are stale

- **Evidence:** `docs/BUILD_STATUS.md` says a feature branch is awaiting PR validation and makes no successful deployment claim, while repository history and current workflow state have advanced beyond that description.
- **Impact:** Readers cannot reliably determine the current baseline from the document.
- **Suggested action:** Replace time-sensitive narrative with a dated snapshot and explicit evidence links; maintain current status in `.project/IMPLEMENTATION_STATUS.md`.

## KI-003 — Test coverage is too narrow for the implemented vertical slices

- **Evidence:** Only `HousieDomainRulesTest` was found in the reviewed source; `scripts/run-tests.sh` targets that class.
- **Impact:** Service workflows, negative paths, retry/idempotency, permission boundaries and concurrency are not adequately covered by the visible Apex suite.
- **Suggested action:** Add service-level tests around account creation, board membership, purchase, withdrawal, retries and wallet invariants.

## KI-004 — Browser smoke tests can be mistaken for product E2E

- **Evidence:** Browser-agent framework is present and at least a basic account-record navigation scenario has passed historically; that is not evidence for purchase/gameplay/settlement.
- **Impact:** Green browser runs can overstate product readiness if scenario coverage is not stated.
- **Suggested action:** Label scenarios by journey and assertions; report deployed commit, data prerequisites and exact outcome.

## KI-005 — Experience Cloud source/configuration is incomplete in repository

- **Evidence:** Manifest references ExperienceBundle/Network metadata, but no ExperienceBundle source was present in the reviewed tree.
- **Impact:** Site routing, guest/auth access and activation remain org-specific and cannot be reproduced solely from the repository.
- **Suggested action:** Document the org setup boundary and decide which configuration can safely be source-controlled.

## KI-006 — Documentation and code mapping can drift

- **Evidence:** `docs/ARCHITECTURE.md`, `docs/DATA_MODEL_MAPPING.md` and `docs/BUILD_STATUS.md` are manually maintained; existing status text is already stale.
- **Impact:** Fresh sessions may trust outdated implementation claims.
- **Suggested action:** Update the status snapshot in the same PR as meaningful feature changes and include evidence links.

## Not included

No issue is recorded here for separately managed debugging or deployment work unless its owner explicitly supplies a status update and asks for it to be incorporated.
