# Milestone 1 — Experience route and Network security review

**Status: REVIEWED, NOT APPROVED FOR NETWORK DEPLOYMENT.** This is a non-deployable review record. Do not copy the retrieved Network metadata into a deployment manifest without explicit approval.

## Retrieved ExperienceBundle route configuration

The retrieved `Housie1` ExperienceBundle snapshot contains:

- Public root/home view: `c:housieApp`.
- Account detail view: `c:housieBoardHub`, with `recordId: {!recordId}`.
- `config/housie.json`: `isAvailableToGuests: true`.

The root and account-context flows have separate browser evidence in the Milestone 1 tracker. A fresh read-only inspection scenario is included in this continuation to re-confirm the current org bundle and Network settings.

## Retrieved Network settings

The last retrieved `Housie.network-meta.xml` snapshot reports:

| Setting | Retrieved value | Assessment |
|---|---|---|
| Status | `UnderConstruction` | Keep unchanged; do not activate the site without explicit launch approval. |
| Guest file access | `true` | Unnecessary for the current Housie app flow unless a verified file feature depends on it; should be disabled before public launch. |
| Guest member visibility | `false` | Keep restrictive. |
| Guest Chatter | `false` | Keep restrictive. |
| Self-registration | `false` | Keep restrictive; Housie signup is handled by the app. |
| Email sender | `sumit.gupta@salesforce.com` | Not a Housie-owned sender; must be replaced with a verified Housie address before Network activation. |

## Deployment decision

- Do not deploy the retrieved Network metadata as-is.
- Do not change `UnderConstruction` to `Live` or otherwise expose/activate the site without explicit user approval.
- Do not use the Salesforce sender address above for Housie notifications.
- Before any Network deployment, confirm a verified Housie-owned sender address and validate whether any feature genuinely requires guest file access. Default to guest file access disabled.
- ExperienceBundle route source may be curated after the fresh inspection confirms exact routes. Any deployment of it must retain the current guest-access boundary and must not broaden public data access.

## Remaining user decision

Milestone 1 route identification is complete once the fresh inspection passes. Network security remediation/activation remains blocked until the user confirms the intended site availability and supplies a verified Housie sender address.