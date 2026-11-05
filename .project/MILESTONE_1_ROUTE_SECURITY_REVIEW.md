# Milestone 1 — Experience route and Network security review

**Status: VERIFIED — NO NETWORK DEPLOYMENT OR SITE ACTIVATION IN MILESTONE 1.** Read-only Developer Org inspection passed in [#42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673). The current settings below are authoritative for that run. Keep the site under construction; do not activate it or broaden guest access as part of this PR.

## Retrieved ExperienceBundle route configuration

The retrieved `Housie1` ExperienceBundle snapshot contains:

- Public root/home view: `c:housieApp`.
- Account detail view: `c:housieBoardHub`, with `recordId: {!recordId}`.
- `config/housie.json`: `isAvailableToGuests: true`.

The root and account-context flows have separate browser evidence in the Milestone 1 tracker. A fresh read-only inspection scenario is included in this continuation to re-confirm the current org bundle and Network settings.

## Retrieved Network settings — verified 2026-11-05

The corrected read-only inspection returned these exact values:

| Setting | Current value | Milestone 1 decision |
|---|---|---|
| Status | `UnderConstruction` | Keep unchanged. Do not activate the site in this PR. |
| Guest file access | `true` | Security exposure to review; do not broaden or deploy this setting. Disable before any approved public launch unless a documented feature requires it. |
| Guest member visibility | `false` | Keep restrictive. |
| Guest Chatter | `false` | Keep restrictive. |
| Self-registration | `false` | Keep restrictive; Housie signup is app-managed. |
| Email sender | `sumit.gupta@salesforce.com` | Not a Housie-owned sender. Replace with a verified Housie-owned address before enabling notifications or activating the Network. |
| ExperienceBundle `isAvailableToGuests` | `true` | Public root is guest-available in metadata. Do not treat this flag as approval to launch or expose the site. |

The public root view contains `c:housieApp`; the Account Detail view contains `c:housieBoardHub` and passes `recordId: {!recordId}`. The `Housie_Account_Admin` custom tab resolves to the `Housie_Account_Admin` FlexiPage, which contains `housieAccountAdmin`.

Evidence: [#42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673), read-only route/Network inspection passed. No Network or ExperienceBundle deployment was performed.

## Deployment decision

- **No Network or ExperienceBundle deployment in Milestone 1.** This PR makes no change to the current org settings.
- Keep Network status `UnderConstruction`; do not activate or expose the site as part of this PR.
- Do not use the Salesforce sender address for Housie notifications.
- Before any future Network activation, obtain an explicit site-availability decision, supply a verified Housie-owned sender address, and approve a SPEC-reviewed guest-access remediation. Default guest file access to disabled unless a documented feature requires it.
- Preserve the current restrictive guest member visibility, guest Chatter and self-registration settings.

## Deferred follow-up

Route identification and the read-only security decision are complete for Milestone 1. Actual Network remediation, sender replacement and any activation are separate, explicitly approved work; they are not prerequisites for this PR because the chosen decision is to keep the site under construction and make no Network deployment.