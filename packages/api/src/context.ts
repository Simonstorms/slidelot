import type { Context as HonoContext } from "hono";
import { db } from "@slidelot/db";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext(_opts: CreateContextOptions) {
  return {
    session: null,
    db,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
