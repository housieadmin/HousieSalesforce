import { queryBigObject as querySharedBigObject } from "sf-augment";

export function queryBigObject<T extends Record<string, unknown>>(soql: string, targetOrgAlias?: string): T[] {
  return querySharedBigObject(soql, {
    targetOrg: targetOrgAlias || process.env.SF_TARGET_ORG_ALIAS || "housie-browser-tests",
    projectRoot: process.cwd()
  }) as T[];
}
