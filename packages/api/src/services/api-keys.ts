import { db } from "@slidelot/db";
import { settings } from "@slidelot/db/schema";
import { eq, like } from "drizzle-orm";

const API_KEY_NAMES = [
  "ANTHROPIC_API_KEY",
  "FAL_API_KEY",
  "POSTIZ_API_KEY",
  "POSTIZ_INTEGRATION_ID",
  "REVENUECAT_API_KEY",
] as const;

export type ApiKeyName = (typeof API_KEY_NAMES)[number];

export async function getApiKey(name: ApiKeyName): Promise<string | undefined> {
  const envValue = process.env[name];
  if (envValue) return envValue;

  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, `apiKey.${name}`))
    .get();

  return row?.value || undefined;
}

export async function getRequiredApiKey(name: ApiKeyName): Promise<string> {
  const value = await getApiKey(name);
  if (!value) {
    throw new Error(
      `${name} is not configured. Set it via environment variable or in Settings > API Keys.`
    );
  }
  return value;
}

export async function getAllApiKeyStatuses(): Promise<
  Record<ApiKeyName, { masked: string | null; source: "env" | "db" | "missing" }>
> {
  const dbRows = await db
    .select()
    .from(settings)
    .where(like(settings.key, "apiKey.%"));

  const dbMap = new Map<string, string>();
  for (const row of dbRows) {
    dbMap.set(row.key, row.value);
  }

  const result = {} as Record<
    ApiKeyName,
    { masked: string | null; source: "env" | "db" | "missing" }
  >;

  for (const name of API_KEY_NAMES) {
    const envValue = process.env[name];
    if (envValue) {
      result[name] = {
        masked: `****${envValue.slice(-4)}`,
        source: "env",
      };
      continue;
    }

    const dbValue = dbMap.get(`apiKey.${name}`);
    if (dbValue) {
      result[name] = {
        masked: `****${dbValue.slice(-4)}`,
        source: "db",
      };
      continue;
    }

    result[name] = { masked: null, source: "missing" };
  }

  return result;
}

let resetCallbacks: (() => void)[] = [];

export function onReset(cb: () => void) {
  resetCallbacks.push(cb);
}

export function resetCachedClients() {
  for (const cb of resetCallbacks) cb();
}
