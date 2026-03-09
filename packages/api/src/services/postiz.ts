import { readFile } from "node:fs/promises";
import { getApiKey } from "./api-keys";

const POSTIZ_BASE = "https://app.postiz.com/api/v1";

async function getHeaders() {
  const apiKey = await getApiKey("POSTIZ_API_KEY");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export async function postDraft(
  slidePaths: string[],
  caption: string,
  uploadsDir: string
): Promise<string> {
  const apiKey = await getApiKey("POSTIZ_API_KEY");
  const integrationId = await getApiKey("POSTIZ_INTEGRATION_ID");

  if (!apiKey || !integrationId) {
    throw new Error("Postiz API key and integration ID required");
  }

  const headers = await getHeaders();
  const mediaIds: string[] = [];

  for (const slidePath of slidePaths) {
    const fullPath = `${uploadsDir}/${slidePath}`;
    const fileBuffer = await readFile(fullPath);
    const base64 = fileBuffer.toString("base64");

    const uploadResponse = await fetch(`${POSTIZ_BASE}/media`, {
      method: "POST",
      headers,
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
    headers,
    body: JSON.stringify({
      integration: integrationId,
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
  const apiKey = await getApiKey("POSTIZ_API_KEY");
  if (!apiKey) {
    throw new Error("Postiz API key required");
  }

  const headers = await getHeaders();
  const response = await fetch(`${POSTIZ_BASE}/posts/${postizId}/analytics`, {
    headers,
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
