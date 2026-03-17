import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@slidelot/api/context";
import { appRouter, recoverOrphanedJobs } from "@slidelot/api/routers/index";
import { env } from "@slidelot/env/server";
import { db } from "@slidelot/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";

await recoverOrphanedJobs(db);

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.use("/uploads/*", serveStatic({ root: "./" }));


app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

export default app;
