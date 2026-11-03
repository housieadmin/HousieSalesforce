# Scenario authoring

AI sessions create Playwright files in this directory. One workflow execution can run multiple files.

Import the shared fixture:
import { test, expect } from "../core";

Each test receives the standard Playwright page and a housie helper:
- housie.login() opens the authenticated Salesforce frontdoor session.
- housie.navigate(pathOrUrl) navigates to an absolute URL or a path relative to the configured Salesforce org.
- housie.screenshot(name) saves and attaches a full-page screenshot.
- housie.note(message) adds context to the diagnostics file.

Use normal Playwright APIs for all other actions and observations. Scenarios may contain multiple test blocks. Adapt selectors and URLs to the actual application; no sample selectors are assumed to work.

Never put credentials, access tokens or other secrets in scenario files.