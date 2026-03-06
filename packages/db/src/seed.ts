import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../apps/server/.env"), override: true });

const { db } = await import("./index");
const { learnings } = await import("./schema");

const hookFormulas = [
  "POV: [relatable situation that hooks persona] — Start with a specific scenario your target audience lives daily",
  "I spent [time] testing [thing] so you don't have to — Authority + time investment creates instant credibility",
  "Stop [common mistake]. Do this instead — Pattern interrupt + solution creates curiosity gap",
  "The [thing] nobody talks about in [niche] — Insider knowledge framing triggers FOMO",
  "If you're still [old way], you're behind — Creates urgency through fear of missing out",
  "I found the [superlative] way to [desired outcome] — Promise of best solution drives clicks",
  "[Number] signs you need [product/solution] — Self-diagnosis format is irresistible to target personas",
  "This changed my [area] forever — Transformation hook with emotional weight",
  "Why [popular thing] is actually [contrarian take] — Contrarian hooks drive engagement through disagreement",
  "The truth about [common belief in niche] — Truth-reveal format creates anticipation",
  "[Persona], this is for you — Direct address creates immediate personal connection",
  "I was today years old when I learned [surprising fact] — Discovery format triggers share impulse",
  "Hot take: [bold opinion about niche] — Polarizing hooks drive comments and shares",
  "Before vs After using [product/method] — Visual transformation promises drive saves",
  "Things I wish I knew before [experience] — Regret-based hooks create empathy and curiosity",
];

console.log("Seeding hook formulas...");

for (const formula of hookFormulas) {
  await db.insert(learnings).values({
    type: "hook_formula",
    content: formula,
    source: "seed",
  });
}

console.log(`Seeded ${hookFormulas.length} hook formulas`);
