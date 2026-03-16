import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { getRequiredApiKey, onReset } from "./api-keys";

let cachedClient: Anthropic | null = null;

async function getClient(): Promise<Anthropic> {
  if (!cachedClient) {
    const apiKey = await getRequiredApiKey("ANTHROPIC_API_KEY");
    cachedClient = new Anthropic({ apiKey });
  }
  return cachedClient;
}

onReset(() => {
  cachedClient = null;
});

export interface PinterestPin {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  description: string;
}

export async function generateSearchQuery(
  slideText: string,
  sceneDescription: string
): Promise<string> {
  const anthropic = await getClient();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: `Generate a specific Pinterest search query (3-5 words) to find a photo that matches this slide.

Slide text: "${slideText}"
Scene description: "${sceneDescription}"

Return ONLY the search query, nothing else. Be specific about the visual scene, mood, and subject.`,
      },
    ],
  });

  const block = response.content[0];
  return block && block.type === "text" ? block.text.trim() : sceneDescription;
}

export async function searchPinterest(
  query: string,
  limit = 6
): Promise<PinterestPin[]> {
  const apiKey = await getRequiredApiKey("RAPIDAPI_KEY");

  const url = new URL(
    "https://unofficial-pinterest-api.p.rapidapi.com/pinterest/pins/relevance"
  );
  url.searchParams.set("keyword", query);
  url.searchParams.set("num", String(limit));

  const response = await fetch(url.toString(), {
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "unofficial-pinterest-api.p.rapidapi.com",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Pinterest API error: ${response.status} ${response.statusText} - ${body}`
    );
  }

  const body = (await response.json()) as {
    data?: Record<string, unknown>[];
  };
  const items = body.data ?? [];

  return items
    .filter((item) => item.type === "pin" && item.images)
    .slice(0, limit)
    .map((pin) => {
      const images = pin.images as Record<string, { url?: string; width?: number; height?: number }>;
      const orig = images.orig ?? images["736x"] ?? images["474x"];
      const thumb = images["236x"] ?? images["170x"];
      return {
        id: String(pin.id ?? ""),
        imageUrl: String(orig?.url ?? ""),
        thumbnailUrl: String(thumb?.url ?? orig?.url ?? ""),
        width: Number(orig?.width ?? 0),
        height: Number(orig?.height ?? 0),
        description: String(pin.grid_title ?? pin.title ?? ""),
      };
    })
    .filter((pin) => pin.imageUrl);
}

export async function downloadPinterestImage(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  return await sharp(buffer)
    .resize(1024, 1536, { fit: "cover" })
    .png()
    .toBuffer();
}
