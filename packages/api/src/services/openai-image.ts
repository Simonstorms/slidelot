import OpenAI from "openai";
import { env } from "@marketing-ai/env/server";
import { db } from "@marketing-ai/db";
import { generationJobs } from "@marketing-ai/db/schema";
import { eq } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function generateSlideImage(
  sceneDescription: string,
  slidePurpose: string,
  slideNumber: number
): Promise<Buffer> {
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt: `Create a visually striking, high-quality photograph-style image for a TikTok slideshow.

SCENE: ${sceneDescription}
PURPOSE: This is slide ${slideNumber}/6 - ${slidePurpose}

CRITICAL RULES:
- Do NOT include any text, words, letters, numbers, or typography in the image
- Do NOT include any watermarks or logos
- The image should be clean with a clear focal point
- Use vibrant, scroll-stopping colors
- Leave the top 30% relatively clean (text will be overlaid there)
- Leave the bottom 20% relatively clean (TikTok UI overlay area)
- Portrait orientation, mobile-optimized composition`,
    size: "1024x1536",
    n: 1,
  });

  const imageData = response.data?.[0];
  if (!imageData) throw new Error("No image data returned from OpenAI");

  if (imageData.b64_json) {
    return Buffer.from(imageData.b64_json, "base64");
  }

  if (imageData.url) {
    const imageResponse = await fetch(imageData.url);
    return Buffer.from(await imageResponse.arrayBuffer());
  }

  throw new Error("No image data or URL returned from OpenAI");
}

const SLIDE_PURPOSES = [
  "Hook - grab attention, stop the scroll",
  "Problem - show the pain point or relatable situation",
  "Agitation - amplify the problem, make it feel urgent",
  "Solution - introduce the answer/method",
  "Proof - show evidence, results, or social proof",
  "CTA - call to action, next step",
];

export async function generateAllSlides(
  sceneDescription: string,
  slideTexts: string[],
  jobId: number,
  outputDir: string
): Promise<string[]> {
  await mkdir(outputDir, { recursive: true });
  const paths: string[] = [];
  const concurrency = 2;

  for (let i = 0; i < slideTexts.length; i += concurrency) {
    const batch = slideTexts.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (_, batchIdx) => {
        const slideIdx = i + batchIdx;
        const buffer = await generateSlideImage(
          sceneDescription,
          SLIDE_PURPOSES[slideIdx] ?? `Slide ${slideIdx + 1}`,
          slideIdx + 1
        );
        const path = join(outputDir, `slide-${slideIdx + 1}-raw.png`);
        await writeFile(path, buffer);
        return path;
      })
    );

    paths.push(...results);

    await db
      .update(generationJobs)
      .set({
        currentSlide: Math.min(i + concurrency, slideTexts.length),
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, jobId));
  }

  return paths;
}
