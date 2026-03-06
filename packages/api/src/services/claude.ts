import Anthropic from "@anthropic-ai/sdk";
import { env } from "@marketing-ai/env/server";
import { db } from "@marketing-ai/db";
import { hooks, learnings } from "@marketing-ai/db/schema";
import { eq } from "drizzle-orm";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

interface GeneratedHook {
  text: string;
  formula: string;
  slideTexts: string[];
  sceneDescription: string;
}

interface HookScore {
  total: number;
  thumbStop: number;
  curiosityGap: number;
  emotionalTrigger: number;
  personaRecognition: number;
  diagnosis: string;
}

interface Settings {
  niche: string;
  productName: string;
  productDescription: string;
  targetAudience: string;
  ctaStyle: string;
  productUrl: string;
}

function extractText(response: Anthropic.Message): string {
  const block = response.content[0];
  return block && block.type === "text" ? block.text : "";
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned);
}

async function getLearningsContext() {
  const allLearnings = await db.select().from(learnings);

  const formulas = allLearnings
    .filter((l) => l.type === "hook_formula")
    .map((l) => l.content);
  const rules = allLearnings
    .filter((l) => l.type === "rule")
    .map((l) => l.content);
  const failures = allLearnings
    .filter((l) => l.type === "failure")
    .map((l) => l.content);

  return { formulas, rules, failures };
}

export async function generateHooks(
  settings: Settings,
  count: number
): Promise<GeneratedHook[]> {
  const context = await getLearningsContext();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a viral TikTok content strategist. Generate ${count} unique hooks for TikTok photo carousel slideshows.

PRODUCT INFO:
- Niche: ${settings.niche}
- Product: ${settings.productName}
- Description: ${settings.productDescription}
- Target Audience: ${settings.targetAudience}
- CTA Style: ${settings.ctaStyle}

PROVEN FORMULAS TO USE (pick different ones):
${context.formulas.map((f, i) => `${i + 1}. ${f}`).join("\n")}

${context.rules.length > 0 ? `RULES LEARNED FROM PAST PERFORMANCE:\n${context.rules.join("\n")}` : ""}

${context.failures.length > 0 ? `AVOID THESE PATTERNS (they failed before):\n${context.failures.join("\n")}` : ""}

For each hook, provide:
1. "text" - The hook text (first slide text that stops the scroll)
2. "formula" - Which formula pattern you used
3. "slideTexts" - Array of exactly 6 slide texts (including the hook as slide 1, building curiosity, and ending with a CTA)
4. "sceneDescription" - A visual scene description for AI image generation (NO text in images, just the visual scene/mood/setting)

RULES FOR SLIDE TEXTS:
- Each slide should be 4-8 words max
- Build a narrative arc: hook → problem → agitation → solution → proof → CTA
- The CTA should naturally mention ${settings.productName} without being salesy
- Last slide CTA style: ${settings.ctaStyle}

Respond with a JSON array of objects. Only output valid JSON, no other text.`,
      },
    ],
  });

  return parseJson<GeneratedHook[]>(extractText(response));
}

export async function scoreHook(
  hookText: string,
  slideTexts: string[],
  settings: Settings
): Promise<HookScore> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Score this TikTok hook on 4 criteria (0-10 each).

HOOK: "${hookText}"
SLIDE TEXTS: ${JSON.stringify(slideTexts)}
TARGET AUDIENCE: ${settings.targetAudience}
NICHE: ${settings.niche}

CRITERIA:
1. thumbStop (0-10): Would this make someone stop scrolling? Pattern interrupts, bold claims, relatable scenarios
2. curiosityGap (0-10): Does it create an information gap that demands resolution?
3. emotionalTrigger (0-10): Does it trigger emotion - fear, excitement, FOMO, validation, frustration?
4. personaRecognition (0-10): Would the target audience instantly feel "this is for me"?

Also provide a brief diagnosis of what works and what could improve.

Respond with JSON only: {"thumbStop": N, "curiosityGap": N, "emotionalTrigger": N, "personaRecognition": N, "diagnosis": "..."}`,
      },
    ],
  });

  const parsed = parseJson<Omit<HookScore, "total">>(extractText(response));

  return {
    ...parsed,
    total: Math.round(
      (parsed.thumbStop +
        parsed.curiosityGap +
        parsed.emotionalTrigger +
        parsed.personaRecognition) /
        4
    ),
  };
}

export async function improveHook(
  hookText: string,
  slideTexts: string[],
  score: HookScore,
  settings: Settings
): Promise<GeneratedHook> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Improve this TikTok hook based on the score diagnosis.

ORIGINAL HOOK: "${hookText}"
ORIGINAL SLIDES: ${JSON.stringify(slideTexts)}
SCORE: ${score.total}/10
DIAGNOSIS: ${score.diagnosis}

WEAK AREAS: ${score.thumbStop < 7 ? "Thumb-stop power is weak. " : ""}${score.curiosityGap < 7 ? "Curiosity gap needs work. " : ""}${score.emotionalTrigger < 7 ? "Emotional trigger is missing. " : ""}${score.personaRecognition < 7 ? "Persona recognition is low. " : ""}

PRODUCT: ${settings.productName} - ${settings.productDescription}
AUDIENCE: ${settings.targetAudience}
NICHE: ${settings.niche}

Rewrite the hook and all 6 slide texts to address the weak areas. Keep what works, fix what doesn't.

Respond with JSON only: {"text": "...", "formula": "...", "slideTexts": ["...", "...", "...", "...", "...", "..."], "sceneDescription": "..."}`,
      },
    ],
  });

  return parseJson<GeneratedHook>(extractText(response));
}

export async function generateWithRecursiveImprovement(
  settings: Settings,
  count: number,
  maxIterations = 3,
  minScore = 7.5
) {
  const generated = await generateHooks(settings, count);
  const results: Array<GeneratedHook & { score: number; scoreBreakdown: HookScore }> = [];

  for (const hook of generated) {
    let current = hook;
    let bestScore: HookScore = { total: 0, thumbStop: 0, curiosityGap: 0, emotionalTrigger: 0, personaRecognition: 0, diagnosis: "" };

    for (let i = 0; i < maxIterations; i++) {
      const score = await scoreHook(current.text, current.slideTexts, settings);
      bestScore = score;

      if (score.total >= minScore) break;
      if (i < maxIterations - 1) {
        current = await improveHook(
          current.text,
          current.slideTexts,
          score,
          settings
        );
      }
    }

    results.push({
      ...current,
      score: bestScore.total,
      scoreBreakdown: bestScore,
    });
  }

  return results;
}

export async function generateCaption(
  hookText: string,
  slideTexts: string[],
  settings: Settings
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Write a TikTok caption for this photo carousel slideshow.

HOOK: "${hookText}"
SLIDES: ${JSON.stringify(slideTexts)}
PRODUCT: ${settings.productName} (${settings.productUrl})
NICHE: ${settings.niche}

RULES:
- Start with a storytelling hook that complements (not repeats) the slide text
- Naturally mention ${settings.productName} as part of the story
- Include a soft CTA
- Add 3-5 relevant hashtags at the end
- Keep under 300 characters total
- Conversational, not salesy

Return only the caption text, nothing else.`,
      },
    ],
  });

  return extractText(response);
}

export async function generateWinnerVariations(
  hookId: number,
  settings: Settings
): Promise<GeneratedHook[]> {
  const [hook] = await db.select().from(hooks).where(eq(hooks.id, hookId));
  if (!hook) throw new Error("Hook not found");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `This TikTok hook performed well. Generate 3 variations that preserve what worked.

WINNING HOOK: "${hook.text}"
FORMULA: ${hook.formula}
SLIDE TEXTS: ${JSON.stringify(hook.slideTexts)}
VIEWS: ${hook.viewCount}

PRODUCT: ${settings.productName} - ${settings.productDescription}
AUDIENCE: ${settings.targetAudience}
NICHE: ${settings.niche}

Create 3 variations:
1. Same formula, different angle
2. Same emotional trigger, different hook structure
3. Amplified version (bolder claim, stronger emotion)

Each variation needs: text, formula, slideTexts (6 items), sceneDescription

Respond with a JSON array of 3 objects. Only valid JSON.`,
      },
    ],
  });

  return parseJson<GeneratedHook[]>(extractText(response));
}

interface PostWithAnalytics {
  hookText: string;
  slideTexts: string[];
  views: number;
  likes: number;
  comments: number;
  shares: number;
  conversions: number;
}

interface DiagnosisResult {
  hookText: string;
  quadrant: "winner" | "wrong_audience" | "weak_hook" | "dud";
  diagnosis: string;
  newLearnings: string[];
}

export async function runDiagnosis(
  posts: PostWithAnalytics[],
  medianViews: number,
  medianConversions: number,
  settings: Settings
): Promise<DiagnosisResult[]> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Analyze these TikTok slideshow posts and diagnose each one.

POSTS:
${posts.map((p, i) => `${i + 1}. Hook: "${p.hookText}" | Views: ${p.views} | Likes: ${p.likes} | Comments: ${p.comments} | Shares: ${p.shares} | Conversions: ${p.conversions}`).join("\n")}

THRESHOLDS:
- Median Views: ${medianViews}
- Median Conversions: ${medianConversions}

2x2 MATRIX:
- High views + high conversions = "winner" (keep iterating)
- High views + low conversions = "wrong_audience" (rotate CTA/positioning)
- Low views + high conversions = "weak_hook" (test stronger hooks)
- Low views + low conversions = "dud" (drop, log failure)

NICHE: ${settings.niche}
PRODUCT: ${settings.productName}

For each post provide:
1. "hookText" - the original hook
2. "quadrant" - one of: winner, wrong_audience, weak_hook, dud
3. "diagnosis" - specific explanation of why it landed in this quadrant
4. "newLearnings" - array of actionable rules/insights to apply to future content

Respond with a JSON array. Only valid JSON.`,
      },
    ],
  });

  return parseJson<DiagnosisResult[]>(extractText(response));
}
