import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.string().min(1),
    CORS_ORIGIN: z.url(),

    ANTHROPIC_API_KEY: z.string().optional(),
    FAL_API_KEY: z.string().optional(),

    POSTIZ_API_KEY: z.string().optional(),
    POSTIZ_INTEGRATION_ID: z.string().optional(),

    REVENUECAT_API_KEY: z.string().optional(),

    UPLOADS_DIR: z.string().default("./uploads"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
