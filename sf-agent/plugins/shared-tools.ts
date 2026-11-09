import type { JsonObject, UtilityPlugin } from "@sf-agent/core";

export interface SharedTools {
  requireText(value: unknown, fieldName: string): string;
}

export function createPlugin(_options: JsonObject = {}): UtilityPlugin<JsonObject, SharedTools> {
  return {
    id: "shared-tools",
    create() {
      return {
        requireText(value, fieldName) {
          if (typeof value !== "string" || !value.trim()) {
            throw new Error(`${fieldName} must be a non-empty string.`);
          }
          return value.trim();
        }
      };
    }
  };
}
