import { fal } from "@fal-ai/client";
import { db } from "@slidelot/db";
import { generationJobs } from "@slidelot/db/schema";
import { eq } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getRequiredApiKey, onReset } from "./api-keys";

let falConfigured = false;

async function ensureFalConfig() {
  if (!falConfigured) {
    const apiKey = await getRequiredApiKey("FAL_API_KEY");
    fal.config({ credentials: apiKey });
    falConfigured = true;
  }
}

onReset(() => {
  falConfigured = false;
});

const FAL_MODELS = {
  "flux-schnell": "fal-ai/flux/schnell",
  "flux-dev": "fal-ai/flux/dev",
  "flux-realism": "fal-ai/flux-realism",
  "flux-2-flex": "fal-ai/flux-2-flex",
  "recraft-v3": "fal-ai/recraft/v3/text-to-image",
  "recraft-v4-pro": "fal-ai/recraft/v4/pro/text-to-image",
  "nano-banana-2": "fal-ai/nano-banana-2",
  "gpt-image-1.5": "fal-ai/gpt-image-1.5",
  "imagen-4": "fal-ai/imagen4/preview",
} as const;

export type FalModel = keyof typeof FAL_MODELS;

export const FAL_MODEL_OPTIONS: { id: FalModel; label: string; cost: string }[] = [
  { id: "flux-schnell", label: "FLUX.1 Schnell", cost: "$0.005" },
  { id: "flux-dev", label: "FLUX.1 Dev", cost: "$0.04" },
  { id: "flux-realism", label: "FLUX Realism", cost: "$0.055" },
  { id: "flux-2-flex", label: "FLUX.2 Flex", cost: "$0.08" },
  { id: "recraft-v3", label: "Recraft V3", cost: "$0.04" },
  { id: "recraft-v4-pro", label: "Recraft V4 Pro", cost: "$0.25" },
  { id: "nano-banana-2", label: "Nano Banana 2", cost: "$0.08" },
  { id: "gpt-image-1.5", label: "GPT Image 1.5", cost: "$0.20" },
  { id: "imagen-4", label: "Google Imagen 4", cost: "$0.04" },
];

export const PROMPT_STYLES = [
  {
    id: "natural",
    label: "Natural language",
    build: (scene: string) =>
      `A single photograph of ${scene}. Soft natural lighting, clean composition, one clear subject. Shot on full-frame camera, 50mm lens, f/2.8, shallow depth of field.`,
  },
  {
    id: "cinematic",
    label: "Cinematic detail",
    build: (scene: string) =>
      `Cinematic still frame: ${scene}. Shot on Sony A7IV, 35mm f/1.4, golden hour side lighting, film grain, shallow depth of field, warm color grade. Single subject, editorial composition.`,
  },
  {
    id: "editorial",
    label: "Editorial studio",
    build: (scene: string) =>
      `High-end editorial photograph. Subject: ${scene}. Three-point studio lighting, soft key light from 45 degrees, clean background, 85mm portrait lens at f/2, commercial quality, magazine cover composition.`,
  },
  {
    id: "raw",
    label: "Raw minimal",
    build: (scene: string) => scene,
  },
  {
    id: "lifestyle",
    label: "Lifestyle iPhone",
    build: (scene: string) =>
      `Candid lifestyle photo taken on iPhone. ${scene}. Natural available light, authentic and unposed, slightly warm tones, real-life setting, relatable everyday moment. 4:5 aspect ratio feel.`,
  },
  {
    id: "pinterest",
    label: "Pinterest moodboard",
    build: (scene: string) =>
      `Pinterest-style aesthetic photograph of ${scene}. Muted warm tones, soft diffused window light, curated flat lay or lifestyle vignette, tactile textures, neutral color palette with one warm accent. Clean and aspirational.`,
  },
];

function getModelId(model: FalModel) {
  return FAL_MODELS[model];
}

function buildInput(prompt: string, model: FalModel) {
  if (model === "recraft-v3" || model === "recraft-v4-pro") {
    return { prompt, style: "realistic_image", image_size: "portrait_4_3" };
  }
  if (model === "nano-banana-2") {
    return { prompt, resolution: "1K", aspect_ratio: "2:3", output_format: "png" };
  }
  if (model === "gpt-image-1.5") {
    return { prompt, image_size: "1024x1536", quality: "high", output_format: "png" };
  }
  if (model === "imagen-4") {
    return { prompt, aspect_ratio: "2:3", output_format: "png", resolution: "1K" };
  }
  return { prompt, image_size: { width: 1024, height: 1536 }, num_inference_steps: model === "flux-schnell" ? 4 : 28 };
}

async function callFal(prompt: string, model: FalModel) {
  await ensureFalConfig();
  const modelId = getModelId(model);

  const result = await fal.subscribe(modelId, {
    input: buildInput(prompt, model),
  });

  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) throw new Error(`No image returned from fal.ai (${model})`);
  return imageUrl;
}

function buildSlidePrompt(sceneDescription: string) {
  return JSON.stringify({
    subject: sceneDescription,
    lighting: {
      setup: "Soft natural light, realistic shadow falloff.",
      technical_specs: "Global illumination, ray-traced reflections, 8k texture resolution.",
    },
    camera: {
      format: "9:16 vertical aspect ratio",
      technical: "35mm full-frame, f/2.8, natural bokeh, zero lens distortion.",
      render_quality: "Photorealistic, indistinguishable from real photograph.",
    },
    negative_constraints: [
      "no text",
      "no words",
      "no letters",
      "no logos",
      "no watermark",
      "no multiple images",
      "no grids",
      "no collages",
      "no AI artifacts",
      "no stock photo feel",
    ],
  });
}

export async function generateSlideImage(
  sceneDescription: string,
  model: FalModel = "nano-banana-2"
): Promise<Buffer> {
  const prompt = buildSlidePrompt(sceneDescription);
  const imageUrl = await callFal(prompt, model);
  const response = await fetch(imageUrl);
  return Buffer.from(await response.arrayBuffer());
}

export async function generateAllSlides(
  sceneDescriptions: string[],
  slideTexts: string[],
  jobId: number,
  outputDir: string,
  model: FalModel = "nano-banana-2"
): Promise<string[]> {
  await mkdir(outputDir, { recursive: true });
  const paths: string[] = [];
  const concurrency = 2;

  for (let i = 0; i < slideTexts.length; i += concurrency) {
    const batch = slideTexts.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (_, batchIdx) => {
        const slideIdx = i + batchIdx;
        const scene = sceneDescriptions[slideIdx] ?? sceneDescriptions[0] ?? "";
        const buffer = await generateSlideImage(scene, model);
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

export async function generateTestImage(
  prompt: string,
  model: FalModel = "nano-banana-2"
): Promise<string> {
  return callFal(prompt, model);
}

export function buildPromptWithStyle(sceneDescription: string, styleId: string) {
  const style = PROMPT_STYLES.find((s) => s.id === styleId);
  const base = style ? style.build(sceneDescription) : sceneDescription;
  return `${base}. Do not generate multiple images, grids, collages, or split frames. Do not include any text, words, letters, numbers, typography, watermarks, or logos. Portrait orientation.`;
}
