import path from "node:path";
import type { Page } from "@playwright/test";
import {
  captureAuraErrors as captureSharedAuraErrors,
  openLightningTab as openSharedLightningTab,
  queryBigObject as querySharedBigObject
} from "sf-augment";

const projectRoot = () => path.resolve(process.cwd());
const targetOrg = (value?: string) => value || process.env.SF_TARGET_ORG_ALIAS || "housie-browser-agent";

export async function openLightningTab(
  page: Page,
  lightningPath: string,
  targetOrgAlias?: string
): Promise<void> {
  return openSharedLightningTab(page, lightningPath, {
    targetOrg: targetOrg(targetOrgAlias),
    projectRoot: projectRoot()
  });
}

export async function redactAccountKey(page: Page, required = true): Promise<void> {
  const keyLine = page.getByText(/Account key:/).first();
  if (await keyLine.count() && await keyLine.isVisible().catch(() => false)) {
    await keyLine.evaluate(element => { element.textContent = "Account key: [REDACTED]"; });
    return;
  }
  if (required) {
    await keyLine.waitFor({ state: "visible", timeout: 60000 });
    await keyLine.evaluate(element => { element.textContent = "Account key: [REDACTED]"; });
  }
}

export interface AuraResponseSummary {
  status: number;
  errors: string[];
}

export function captureAuraErrors(page: Page): {
  snapshot(): Promise<AuraResponseSummary[]>;
  stop(): void;
} {
  return captureSharedAuraErrors(page) as {
    snapshot(): Promise<AuraResponseSummary[]>;
    stop(): void;
  };
}

export function queryBigObject<T extends Record<string, unknown>>(
  soql: string,
  targetOrgAlias?: string
): T[] {
  return querySharedBigObject(soql, {
    targetOrg: targetOrg(targetOrgAlias),
    projectRoot: projectRoot()
  }) as T[];
}
