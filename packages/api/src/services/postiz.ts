import { env } from "@marketing-ai/env/server";
import { readFile } from "node:fs/promises";

const POSTIZ_BASE = "https://app.postiz.com/api/v1";

function getHeaders() {
  return {
    Authorization: `Bearer ${env.POSTIZ_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function postDraft(
  slidePaths: string[],
  caption: string,
  uploadsDir: string
): Promise<string> {
  if (!env.POSTIZ_API_KEY || !env.POSTIZ_INTEGRATION_ID) {
    throw new Error("Postiz API key and integration ID required");
  }

  const mediaIds: string[] = [];

  for (const slidePath of slidePaths) {
    const fullPath = `${uploadsDir}/${slidePath}`;
    const fileBuffer = await readFile(fullPath);
    const base64 = fileBuffer.toString("base64");

    const uploadResponse = await fetch(`${POSTIZ_BASE}/media`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        file: `data:image/webp;base64,${base64}`,
      }),
    });

    if (!uploadResponse.ok) {
      throw new Error(`Media upload failed: ${uploadResponse.statusText}`);
    }

    const uploadData = (await uploadResponse.json()) as { id: string };
    mediaIds.push(uploadData.id);
  }

  const postResponse = await fetch(`${POSTIZ_BASE}/posts`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      integration: env.POSTIZ_INTEGRATION_ID,
      content: caption,
      media: mediaIds,
      type: "carousel",
      draft: true,
    }),
  });

  if (!postResponse.ok) {
    throw new Error(`Post creation failed: ${postResponse.statusText}`);
  }

  const postData = (await postResponse.json()) as { id: string };
  return postData.id;
}

export async function getPostAnalytics(postizId: string) {
  if (!env.POSTIZ_API_KEY) {
    throw new Error("Postiz API key required");
  }

  const response = await fetch(`${POSTIZ_BASE}/posts/${postizId}/analytics`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Analytics fetch failed: ${response.statusText}`);
  }

  return (await response.json()) as {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
}
