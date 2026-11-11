import type { Page } from "@playwright/test";
import { openLightningTab as openSharedLightningTab } from "sf-augment";

export async function openLightningTab(page: Page, lightningPath: string, targetOrgAlias?: string): Promise<void> {
  return openSharedLightningTab(page, lightningPath, {
    targetOrg: targetOrgAlias || process.env.SF_TARGET_ORG_ALIAS || "housie-browser-agent",
    projectRoot: process.cwd()
  });
}
