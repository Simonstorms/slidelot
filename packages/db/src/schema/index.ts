import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const hooks = sqliteTable("hooks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  formula: text("formula"),
  slideTexts: text("slide_texts", { mode: "json" }).$type<string[]>(),
  sceneDescriptions: text("scene_descriptions", { mode: "json" }).$type<string[]>(),
  caption: text("caption"),
  viewCount: integer("view_count").default(0),
  score: integer("score").default(0),
  scoreBreakdown: text("score_breakdown", { mode: "json" }).$type<{
    thumbStop: number;
    curiosityGap: number;
    emotionalTrigger: number;
    personaRecognition: number;
  }>(),
  status: text("status", {
    enum: ["draft", "untested", "winner", "loser"],
  })
    .notNull()
    .default("draft"),
  parentHookId: integer("parent_hook_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  hookId: integer("hook_id")
    .notNull()
    .references(() => hooks.id),
  status: text("status", {
    enum: ["generating", "pending", "approved", "posted", "rejected", "failed"],
  })
    .notNull()
    .default("generating"),
  slides: text("slides", { mode: "json" }).$type<string[]>(),
  cleanSlides: text("clean_slides", { mode: "json" }).$type<string[]>(),
  slideTextOverlays: text("slide_text_overlays", { mode: "json" })
    .$type<{ text: string; xPercent: number; yPercent: number; fontScale: number }[]>(),
  caption: text("caption"),
  postizId: text("postiz_id"),
  rejectionReason: text("rejection_reason"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const analytics = sqliteTable("analytics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  downloads: integer("downloads").default(0),
  trials: integer("trials").default(0),
  conversions: integer("conversions").default(0),
  revenue: integer("revenue").default(0),
  pulledAt: integer("pulled_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const learnings = sqliteTable("learnings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", {
    enum: ["hook_formula", "failure", "rule"],
  }).notNull(),
  content: text("content").notNull(),
  source: text("source", {
    enum: ["auto", "manual", "seed"],
  })
    .notNull()
    .default("auto"),
  hookId: integer("hook_id").references(() => hooks.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const imageTests = sqliteTable("image_tests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  prompt: text("prompt").notNull(),
  model: text("model").notNull(),
  style: text("style"),
  status: text("status", {
    enum: ["pending", "generating", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  imageUrl: text("image_url"),
  error: text("error"),
  hookId: integer("hook_id").references(() => hooks.id),
  batchId: text("batch_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const bgJobs = sqliteTable("bg_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", {
    enum: ["hook_generation", "slide_generation", "image_test"],
  }).notNull(),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  input: text("input", { mode: "json" }).$type<Record<string, unknown>>(),
  progress: integer("progress").default(0),
  total: integer("total").default(0),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const generationJobs = sqliteTable("generation_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  hookId: integer("hook_id")
    .notNull()
    .references(() => hooks.id),
  postId: integer("post_id").references(() => posts.id),
  status: text("status", {
    enum: ["pending", "generating", "processing", "captioning", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  currentSlide: integer("current_slide").default(0),
  totalSlides: integer("total_slides").default(4),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
