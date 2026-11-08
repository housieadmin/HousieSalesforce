# Milestone 1 — Experience route and Network security review

**Status: ROUTES AND CURRENT SETTINGS VERIFIED; NO NETWORK DEPLOYMENT OR SITE ACTIVATION APPROVED.**

Read-only inspection [run #42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673) retrieved the current Developer Org ExperienceBundle, Network, FlexiPage and CustomTab metadata. The corrected XML parser produced non-empty, verified Network settings.

## Verified ExperienceBundle routes

- Public root view: `c:housieApp` (plus Salesforce's SEO assistant component).
- Account detail view: `c:housieBoardHub`, with `recordId: {!recordId}`.
- `config/housie.json`: `isAvailableToGuests=true`.
- `Housie_Account_Admin` custom tab targets the `Housie_Account_Admin` FlexiPage, which contains `housieAccountAdmin`.
- Retrieved Housie FlexiPages include Account Admin, Developer Simulation and Local UtilityBar.

## Verified Network settings

| Setting | Current Developer Org value | Decision |
|---|---|---|
| Status | `UnderConstruction` | Keep; do not activate without explicit approval. |
| Guest file access | `true` | Do not broaden; review and disable before any public launch unless a documented feature requires it. |
| Guest member visibility | `false` | Keep restrictive. |
| Guest Chatter | `false` | Keep restrictive. |
| Self-registration | `false` | Keep restrictive; Housie signup is app-managed. |
| Email sender | `sumit.gupta@salesforce.com` | Not Housie-owned; replace with a verified Housie sender before any Network activation. |
| ExperienceBundle guest availability | `true` | Public root route is guest-available; this does not mean the site is Live. |

Evidence: the route/security scenario's structured diagnostics in artifact [#13423708327](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673/artifacts/13423708327).

## Deployment and launch decision

- No ExperienceBundle or Network metadata was deployed by this review.
- Do not change `UnderConstruction` to `Live`, activate the site, or broaden guest access in PR #42.
- Do not use the Salesforce default sender address for Housie notifications.
- Before public launch, require a separate SPEC-reviewed security plan, verified Housie-owned sender, explicit guest-file-access decision, and explicit user approval.
- Route identification and current-setting inspection are complete for Milestone 1. Network remediation/activation remains separate launch/security work and is not a reason to mix risky metadata changes into the paid-ticket acceptance PR.

## Remaining user decision

No site-availability or Network-setting change is requested or authorized by this review. Keep the site under construction and the current guest restrictions unchanged until the user explicitly approves a separate remediation/activation plan.
